# 第 11 章 结账事务与防超卖（全书核心）

## 本章目标

- 理解下单为什么必须是一个数据库事务，以及事务里到底放哪些步骤
- 掌握防超卖的两种打法：条件 UPDATE（A）与行锁 FOR UPDATE（B）
- 理解幂等键为什么能防住「重复下单」，以及 outbox 的位置

这一章是两个项目共同的重心。下单是电商系统里唯一「错了就要赔钱」的流程：超卖要退款道歉，重复扣款要被投诉，价格算错直接亏钱。两个项目用了不同的机制守同一批不变量，对照着读收获最大。

## 11.1 不变量先行

先把下单必须保证的事列清楚，机制都是为它们服务的：

1. **不超卖**：库存永远不能扣成负数，哪怕一百个请求同时抢最后一件。
2. **不重复**：用户双击、网络重试、浏览器刷新，不能生成两张订单、扣两次库存。
3. **价格可信**：金额按服务端数据库里的价格算（第 4 章）。
4. **要么全成，要么全不成**：扣了库存却没生成订单（或反过来）是最坏的中间态。

## 11.2 项目 A：条件 UPDATE —— 让数据库原子地判断

A 的结账 action 在一个事务里逐行扣库存（`src/features/checkout/actions.ts`）：

```ts
orderId = await db.transaction(async (tx) => {
  // 1) 逐行原子扣库存：UPDATE ... WHERE stock >= qty
  for (const line of cart.lines) {
    const updated = await tx
      .update(products)
      .set({ stock: sql`${products.stock} - ${line.quantity}` })
      .where(and(
        eq(products.id, line.productId),
        eq(products.active, true),
        gte(products.stock, line.quantity),       // ← 关键：库存够才更新
      ))
      .returning({ id: products.id });
    if (updated.length === 0) throw new OutOfStockError(line.name);  // 抛错 = 整个事务回滚
  }
  // 2) 按服务端价格建订单、写订单项快照
  // 3) 清空购物车
  return order.id;
});
```

精髓在 `WHERE stock >= qty` 这一句：**判断和扣减是同一条 SQL**。两个并发事务同时抢最后 1 件：数据库逐个执行这条 UPDATE，第一个把库存扣到 0，第二个执行时 `stock >= 1` 不成立、更新 0 行，代码检查到 `updated.length === 0` 就抛错回滚。不需要先 SELECT 再判断——「先查后改」之间永远有竞态窗口，条件更新把窗口关死了。

任何一行失败 → 抛异常 → 整个事务回滚：已扣的其他商品库存自动还原，订单不会生成，购物车原样保留。用户收到「『某商品』库存不足，请返回购物车调整」。这就是不变量 4 的落地方式：**失败处理不是写一堆补偿代码，而是让事务回滚**。

## 11.3 项目 B：行锁 —— 把并发排成队

B 的下单是一个独立的 workflow（`src/workflows/place-order.ts`），打法是先上锁、再安心地查和改：

```ts
return transaction(async (c) => {
  // 锁顾客行：同一顾客的购物车操作与结账串行化
  await c.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [userId]);

  // 幂等：同请求键已有订单 → 直接返回那张订单
  const prior = (await c.query('SELECT id FROM orders WHERE user_id=$1 AND request_key=$2',
    [userId, input.key])).rows[0];
  if (prior) return prior.id;

  // 按商品 ID 顺序锁定全部涉及的库存行
  const { rows } = await c.query(
    'SELECT p.id,p.name,p.price,p.stock,p.active,ci.quantity FROM cart_items ci JOIN products p ON p.id=ci.product_id WHERE ci.user_id=$1 ORDER BY p.id FOR UPDATE OF p',
    [userId]);
  if (!rows.length) throw new Error('EMPTY_CART');
  for (const r of rows)
    if (!r.active || r.stock < r.quantity) throw new Error('INSUFFICIENT_STOCK');

  const t = totals(/* 服务端价格算小计 */, input.code);
  // 建订单（状态直接 paid，因为模拟支付在事务内）→ 写快照 → 扣库存
  // → 记录支付 → 清购物车 → 写 outbox → COMMIT
});
```

三个细节值得放大看：

1. **`ORDER BY p.id` 再加锁**：多个订单锁同一批商品行时，如果加锁顺序不一致，会互相等成死锁。统一按 id 升序加锁，所有事务以相同顺序拿锁，死锁在结构上被避免。这是行锁打法的必备纪律。
2. **锁内可以放心地「先查后改」**：A 要用条件 UPDATE 是因为它没锁；B 锁住了行，查到的 stock 在事务结束前不会被别人改，所以直白的检查反而更易读。两种打法没有高下，看你更信任哪套心智模型。
3. **幂等键 + 唯一约束双保险**：结账表单里带一个 UUID `key`（每次打开结账页生成）。重复提交时，workflow 先按 `(user_id, request_key)` 查到已有订单直接返回；万一两个请求并发穿过检查，第 3 章那条 `UNIQUE(user_id, request_key)` 约束会让第二个插入失败。应用检查负责体验，数据库约束负责正确性——和第 3 章是同一课。

## 11.4 事务的边界：什么不该放进来

对比两家的事务范围，能看出一个共同判断：**慢的、外部的、不可回滚的操作不进事务**。

- B 的模拟支付只是一次本地 INSERT，可以进事务；它的架构文档专门写明：真实支付**不可**放进这个事务——要改成「事务内建待支付订单 + 预留库存 → 事务外调支付商 → webhook 幂等确认」。
- A 正是这么做的：事务只管扣库存、建 `pending` 订单、清购物车；调 Stripe 创建结账会话在事务**提交之后**。若 Stripe 调用失败，它的补偿是调用 `cancelOrderAndRestock` 取消订单退库存（一个显式的逆操作），而不是假装能回滚一件已经发生的事。

记住这个划分：**数据库事务只能回滚数据库里的东西**。凡是出了这个进程边界（支付、邮件、第三方 API），都要用「状态机 + 幂等 + 补偿动作」来处理，不能指望回滚。

## 11.5 outbox：事件和数据一起落地

B 在下单事务的最后写了一行 outbox：

```ts
await c.query('INSERT INTO outbox(topic,payload) VALUES($1,$2)',
  ['order.paid', JSON.stringify({ orderId: order.id })]);
```

要解决的问题是：订单提交成功了，但「发通知邮件/推送给仓库」这一步崩了，怎么办？把事件和业务数据写进**同一个事务**，两者同生共死；之后由一个后台投递器慢慢把 outbox 里的事件发出去（B 只记录未实现投递，并在 README 里明说了）。这是分布式系统里「事务性发件箱」的标准模式，在单体里同样成立。第 13 章的状态变更工作流也用了同样的手法。

## 常见误区

- **「先 SELECT 库存够不够，再 UPDATE 扣减」**：两步之间就是竞态窗口，并发下必超卖。要么条件更新，要么先锁行——不存在第三种靠运气的写法。
- **「防重复提交靠前端禁用按钮」**：刷新、重试、双标签页、直接重放请求都绕得过前端。幂等键 + 唯一约束才是服务端级别的答案（第 8 章的按钮禁用只是第一层辅助）。
- **「事务越大越安全，把支付也包进来」**：事务持有期间行锁一直占着，外部 API 一慢，锁就堵成串。事务要短、只包数据库操作。
- **「回滚能撤销一切」**：回滚只对本事务的数据库修改有效。已经发出的请求、已经扣的款，要靠补偿流程。

## 本章练习

1. 并发实测：把项目 B 某商品库存改成 1，用两个浏览器（或两个 curl）同时结账，验证只有一单成功、库存为 0、没有负数。
2. 给项目 A 的下单也加幂等：为结账表单生成请求键、订单表加唯一约束、action 里处理冲突。说说与 B 的实现差在哪。
3. 把 B 的 `ORDER BY p.id` 去掉，构造两个订单交叉锁定同样两个商品的场景，观察是否出现死锁报错（PostgreSQL 会主动检测并掐掉一个事务）。改完还原。
4. 思考题：A 的条件 UPDATE 打法如果要一次扣 20 行，其中第 19 行失败，前 18 行的扣减靠什么还原？
