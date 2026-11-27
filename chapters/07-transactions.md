---
layout: default
title: "07 · 事务、并发与幂等"
---

[返回目录](../index.md)

# 07 · 事务、并发与幂等

## 原则
将必须同时成功的数据库操作放进一个事务。将并发条件放进数据库语句，不要只依赖先读取再判断的 JavaScript 逻辑。

源码：`src/features/checkout/actions.ts`（第 24–84 行）

```ts
export async function placeOrder(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = checkoutSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  const cart = await getCart();
  if (!cart.id || cart.lines.length === 0) return { error: "购物车是空的" };

  const session = await getSession();
  let orderId: string;

  try {
    orderId = await db.transaction(async (tx) => {
      // 1) 逐行原子扣库存：UPDATE ... WHERE stock >= qty。
      //    条件更新保证并发下库存不会被扣成负数（超卖）。
      for (const line of cart.lines) {
        const updated = await tx
          .update(products)
          .set({ stock: sql`${products.stock} - ${line.quantity}` })
          .where(
            and(
              eq(products.id, line.productId),
              eq(products.active, true),
              gte(products.stock, line.quantity),
            ),
          )
          .returning({ id: products.id });
        if (updated.length === 0) throw new OutOfStockError(line.name);
      }

      // 2) 以服务端读到的价格为准计算金额，绝不信任前端传来的价格
      const [order] = await tx
        .insert(orders)
        .values({
          userId: session?.userId ?? null,
          totalCents: cart.subtotalCents,
          ...parsed.data,
        })
        .returning({ id: orders.id });

      await tx.insert(orderItems).values(
        cart.lines.map((l) => ({
          orderId: order.id,
          productId: l.productId,
          name: l.name,
          unitPriceCents: l.unitPriceCents,
          quantity: l.quantity,
        })),
      );

      // 3) 清空购物车
      await tx.delete(cartItems).where(eq(cartItems.cartId, cart.id!));
      return order.id;
    });
  } catch (e) {
    if (e instanceof OutOfStockError) {
      revalidatePath("/cart");
      return { error: `${e.message}，请返回购物车调整数量` };
    }
    throw e;
```

原项目通过条件 UPDATE 检查库存足够，再创建订单和订单项，最后清空购物车。任一操作抛错时事务回滚。订单项保存名称及价格快照。

## 并发时间线
```text
库存 = 1
请求 A：UPDATE ... WHERE stock >= 1 → 成功
请求 B：UPDATE ... WHERE stock >= 1 → 等待 A 完成后重新检查 → 0 行
```
这能防止该扣减路径把库存扣成负数，但不能防止所有业务并发错误。

源码：`src/features/orders/service.ts`

```ts
import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/server/db/client";
import { orderItems, orders, products } from "@/server/db/schema";

/**
 * 标记已支付。幂等：只有 pending -> paid 会生效，Stripe webhook 重复投递也不会出问题。
 * 返回 true 表示这次调用真正完成了状态变更。
 */
export async function markOrderPaid(orderId: string): Promise<boolean> {
  const updated = await db
    .update(orders)
    .set({ status: "paid", paidAt: new Date() })
    .where(and(eq(orders.id, orderId), eq(orders.status, "pending")))
    .returning({ id: orders.id });
  return updated.length > 0;
}

/** 取消订单并把预留的库存还回去（仅对 pending / paid 订单有效，shipped 不可取消）。 */
export async function cancelOrderAndRestock(
  orderId: string,
  allowed: ("pending" | "paid")[] = ["pending"],
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [order] = await tx
      .select({ id: orders.id, status: orders.status })
      .from(orders)
      .where(eq(orders.id, orderId))
      .for("update");
    if (!order || !(allowed as string[]).includes(order.status)) return false;

    await tx.update(orders).set({ status: "cancelled" }).where(eq(orders.id, orderId));

    const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId));
    for (const item of items) {
      if (!item.productId) continue;
      await tx
        .update(products)
        .set({ stock: sql`${products.stock} + ${item.quantity}` })
        .where(eq(products.id, item.productId));
    }
    return true;
  });
}

export async function getOrderWithItems(orderId: string) {
  const order = await db.query.orders.findFirst({
    where: eq(orders.id, orderId),
    with: { items: true },
  });
  return order ?? null;
}
```

`markOrderPaid` 使用状态条件实现重复调用安全。`cancelOrderAndRestock` 通过行锁与事务避免同一订单重复归还库存。

## 生产改进
- 购物车在事务外读取。并发提交同一购物车可能创建重复订单；应使用幂等键、锁定购物车并重新读取。
- 多商品扣减顺序应稳定，减少死锁；对可重试事务错误实施有限重试。
- `admin/actions.ts` 先查状态再无条件更新，存在竞争窗口。改为带旧状态条件的 UPDATE。
- 商品价格快照来自事务前的购物车查询。若业务要求提交瞬间价格，需在事务中重新读取或验证版本。

## 练习
使用独立 PostgreSQL 测试库并发执行两个下单请求。验证库存不为负、重复提交只创建一个订单（后者是改造目标，不是原项目保证）。模拟事务中途抛错，确认数据全部回滚。


---

[上一章：缓存、失效与数据新鲜度](06-cache.md) · [目录](../index.md) · [下一章：外部服务、Webhook 与一致性](08-integrations.md)
