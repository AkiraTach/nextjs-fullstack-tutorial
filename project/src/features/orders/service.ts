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
