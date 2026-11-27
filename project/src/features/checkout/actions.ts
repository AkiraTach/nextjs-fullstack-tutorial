"use server";

import { and, eq, gte, sql } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { CATALOG_TAG } from "@/features/catalog/queries";
import { getCart } from "@/features/cart/queries";
import { cancelOrderAndRestock, markOrderPaid } from "@/features/orders/service";
import { siteUrl, stripeConfigured } from "@/lib/env";
import { getSession } from "@/server/auth/session";
import { db } from "@/server/db/client";
import { cartItems, orderItems, orders, products } from "@/server/db/schema";
import { getStripe } from "@/server/payments/stripe";
import type { FormState } from "@/features/auth/schemas";
import { checkoutSchema } from "./schemas";

class OutOfStockError extends Error {
  constructor(public productName: string) {
    super(`「${productName}」库存不足`);
  }
}

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
  }

  revalidateTag(CATALOG_TAG, "max"); // 库存变了，商品缓存失效
  revalidatePath("/", "layout");

  // 4) 发起支付：配了 Stripe 就走 Checkout，否则进入本地"模拟支付"页
  const stripe = getStripe();
  if (!stripe) redirect(`/checkout/mock/${orderId}`);

  let checkoutUrl: string | null = null;
  try {
    const checkout = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: parsed.data.email,
      client_reference_id: orderId,
      metadata: { orderId },
      line_items: cart.lines.map((l) => ({
        quantity: l.quantity,
        price_data: {
          currency: "usd",
          unit_amount: l.unitPriceCents,
          product_data: { name: l.name },
        },
      })),
      success_url: `${siteUrl()}/checkout/success?order=${orderId}`,
      cancel_url: `${siteUrl()}/account/orders`,
    });
    await db.update(orders).set({ stripeSessionId: checkout.id }).where(eq(orders.id, orderId));
    checkoutUrl = checkout.url;
  } catch (e) {
    console.error("Stripe checkout 创建失败", e);
    await cancelOrderAndRestock(orderId);
    revalidateTag(CATALOG_TAG, "max");
    return { error: "支付服务暂时不可用，请稍后再试" };
  }
  if (!checkoutUrl) return { error: "无法创建支付会话" };
  redirect(checkoutUrl);
}

/** 模拟支付：仅在没配置 Stripe 时可用，用来在本地走通完整流程。 */
export async function payMockOrder(formData: FormData) {
  if (stripeConfigured()) throw new Error("已配置 Stripe，模拟支付已禁用");
  const orderId = z.uuid().parse(formData.get("orderId"));
  await markOrderPaid(orderId);
  revalidatePath("/", "layout");
  redirect(`/checkout/success?order=${orderId}`);
}

export async function cancelMockOrder(formData: FormData) {
  const orderId = z.uuid().parse(formData.get("orderId"));
  await cancelOrderAndRestock(orderId);
  revalidateTag(CATALOG_TAG, "max");
  redirect("/cart");
}
