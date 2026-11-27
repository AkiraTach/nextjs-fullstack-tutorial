---
layout: default
title: "08 · 外部服务、Webhook 与一致性"
---

[返回目录](../index.md)

# 08 · 外部服务、Webhook 与一致性

## 原则
外部支付与本地数据库不共享事务。将外部调用放在数据库事务之外，使用状态机、幂等与补偿处理失败。

源码：`src/app/api/webhooks/stripe/route.ts`

```ts
import { revalidateTag } from "next/cache";
import { CATALOG_TAG } from "@/features/catalog/queries";
import { cancelOrderAndRestock, markOrderPaid } from "@/features/orders/service";
import { getStripe } from "@/server/payments/stripe";

export const runtime = "nodejs";

// 订单是否已支付，以 Stripe 的 webhook 为准，而不是浏览器回跳到 success 页。
export async function POST(req: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) return new Response("Stripe 未配置", { status: 501 });

  const signature = req.headers.get("stripe-signature");
  if (!signature) return new Response("缺少签名", { status: 400 });

  // 验签必须使用"原始请求体"，不能先 req.json()
  const body = await req.text();
  let event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch {
    return new Response("签名校验失败", { status: 400 });
  }

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
}
```

原项目在本地事务提交后创建 Stripe Checkout Session。Webhook 使用原始请求体和签名验证。浏览器返回 success 页面不是支付成功的凭据。

```text
本地事务提交 → pending
   ├─ Stripe 付款确认 → paid → shipped
   └─ 会话过期 → cancelled + 归还库存
```
原实现允许管理员取消 paid 状态，但没有实现 Stripe 退款。不要把本地取消等同于退款完成。

## 失败窗口与修复目标
| 失败窗口 | 处理设计 |
|---|---|
| Stripe 创建成功，本地保存 session id 失败 | 稳定幂等键、查询与对账，避免直接当作未付款 |
| 数据库提交后进程退出 | 定时扫描或持久化 outbox 工作任务 |
| Webhook 重复或乱序 | 事件去重、合法状态转换、对账 |
| 延迟支付方式 | 处理对应异步成功/失败事件，校验金额、币种和 session 归属 |
| 模拟支付无人处理 | 定时释放超时预留 |

原项目没有 outbox、事件收件箱、对账任务或完整退款流程。以上为扩展设计，不是已有功能。

## 练习
对同一个测试事件进行重复投递。检查订单只发生一次状态变更。模拟数据库写入失败，设计恢复流程。将该模式迁移到邮件通知或文件处理服务。


---

[上一章：事务、并发与幂等](07-transactions.md) · [目录](../index.md) · [下一章：测试策略与工程质量](09-testing.md)
