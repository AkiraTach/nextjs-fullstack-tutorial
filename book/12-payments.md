# 第 12 章 支付：以回调为准

## 本章目标

- 理解为什么「支付成功」只能以支付商的 webhook 为准，不能信浏览器回跳
- 看懂 webhook 的三件套：原始请求体验签、事件分发、处理幂等
- 理解 A 的「无密钥自动降级为模拟支付」与 B 的事务内模拟支付各自的边界

## 12.1 唯一事实来源：webhook

项目 A 接的是真实 Stripe。流程是：下单事务先建一张 `pending`（库存已预留）的订单 → 跳转 Stripe Checkout 付款 → Stripe 服务器向 `POST /api/webhooks/stripe` 发事件 → webhook 把订单标为已支付。

注意它**不**靠用户付款后浏览器跳回的 success 页来确认——那个页面只是给人看的。原因：

- 用户付完款关掉浏览器、不回跳，订单就永远 pending——但钱其实收到了。
- 回跳 URL 是用户可控的，伪造一个「成功回跳」不该让订单变已支付。
- webhook 是支付商服务器对服务器的通知，可验签、可重试，是唯一可信的信号。

## 12.2 webhook 的实现（项目 A）

`src/app/api/webhooks/stripe/route.ts`，逐段看：

```ts
export const runtime = "nodejs";

// 验签必须使用"原始请求体"，不能先 req.json()
const body = await req.text();
let event;
try {
  event = stripe.webhooks.constructEvent(body, signature, secret);
} catch {
  return new Response("签名校验失败", { status: 400 });
}
```

**原始请求体验签**是第一关：Stripe 的签名是对请求体原文算的，任何框架若先把 body 解析成 JSON 再序列化，字节就变了、验签必失败。所以这里用 `req.text()` 拿原文。这也是 webhook 路由要显式声明 `runtime = "nodejs"` 的原因之一：需要完整的 Node 环境来处理原始流与签名库。

第二关是**事件分发与幂等处理**：

```ts
switch (event.type) {
  case "checkout.session.completed": {
    const orderId = event.data.object.metadata?.orderId;
    if (orderId && event.data.object.payment_status === "paid") {
      await markOrderPaid(orderId); // 幂等
    }
    break;
  }
  case "checkout.session.expired": {
    const orderId = event.data.object.metadata?.orderId;
    if (orderId && (await cancelOrderAndRestock(orderId))) {
      revalidateTag(CATALOG_TAG, "max");
    }
    break;
  }
}
return Response.json({ received: true });
```

- 只处理关心的事件，其余一律回 200 表示收到——不回 200，Stripe 会不断重试，把你的日志打爆。
- `completed` 还要再查 `payment_status === "paid"`：会话完成不等于钱到账（某些支付方式是异步确认的）。
- `expired`（用户一直没付，会话过期）→ 取消订单并**退回预留库存**，同时让目录缓存失效。不处理这个事件，库存会被死订单永久占着。

幂等在服务层（`src/features/orders/service.ts`）：

```ts
/** 标记已支付。幂等：只有 pending -> paid 会生效，webhook 重复投递也不会出问题。 */
export async function markOrderPaid(orderId: string): Promise<boolean> {
  const updated = await db.update(orders)
    .set({ status: "paid", paidAt: new Date() })
    .where(and(eq(orders.id, orderId), eq(orders.status, "pending")))
    .returning({ id: orders.id });
  return updated.length > 0;
}
```

又见第 11 章的条件更新：`WHERE status = 'pending'` 让重复投递的 webhook 第二次更新 0 行、无副作用。Stripe 官方明确说 webhook 是**至少一次**投递、可能重复可能乱序——处理函数必须按「同一个事件会来 N 次」来写。取消退库存的 `cancelOrderAndRestock` 同理：先 `SELECT … FOR UPDATE` 锁订单行、确认状态在允许集合内，才改状态并逐项退库存（第 13 章还会见到它被后台复用）。

## 12.3 模拟支付：两个项目的降级设计

本地学习没有 Stripe 密钥怎么办？两家都做了模拟支付，但位置不同：

- **A：可切换的降级路径**。`getStripe()` 没配密钥就返回 `null`，结账 action 据此把用户送到站内「模拟支付」页，点确认就调同一个 `markOrderPaid`。守卫很关键：`payMockOrder` 开头检查 `if (stripeConfigured()) throw`——**一旦配了真 Stripe，模拟支付自动禁用**，杜绝「生产上有人白嫖模拟支付」的后门。降级路径和正式路径汇入同一个幂等服务函数，行为一致。
- **B：事务内模拟**。`captureMock` 只是一次 INSERT，且被环境开关锁死：

```ts
export async function captureMock(c: PoolClient, orderId: string, amount: number) {
  if (process.env.DEMO_MODE !== 'true') throw new Error('Mock payment requires DEMO_MODE');
  await c.query("INSERT INTO payments(order_id,amount,status) VALUES($1,$2,'captured')", [orderId, amount]);
}
```

B 的架构文档明确写了这只是教学简化：真实支付不能进数据库事务（第 11 章），生产化要改成 A 那种「待支付订单 + 事务外调用 + webhook 确认」的形状。**把两个项目的支付章连起来读，你看到的就是一条从教学实现通往生产实现的路。**

## 常见误区

- **「用户跳回 success 页 = 支付成功」**：回跳是体验，webhook 是事实。订单状态只认后者。
- **「webhook 处理里先查状态再更新就行」**：查与改之间有并发窗口；用带状态条件的原子更新（或锁行）才幂等。
- **「验签失败偶尔出现很正常，忽略即可」**：验签失败要么是配置错（secret 不对、body 被中间层改过），要么是伪造请求。必须 400 拒绝并查原因，不能放行。
- **「模拟支付留着没关系，反正没人知道」**：任何「假装成功」的入口在生产都是后门。要么用配置硬禁用（A、B 都做了），要么根本不带上生产构建。

## 本章练习

1. 本地用 Stripe CLI 把 webhook 转发到项目 A（README 有步骤），用测试卡 4242… 完成一单，观察订单从 pending 到 paid 的变化时机；再故意把 `STRIPE_WEBHOOK_SECRET` 改错，看结账与订单状态分别发生什么。
2. 对同一张订单手动重放两次「模拟支付确认」，验证第二次没有副作用，并指出是哪一行代码保证的。
3. 思考题：如果 webhook 和用户回跳同时到达，`markOrderPaid` 和 success 页的渲染会不会打架？为什么？
