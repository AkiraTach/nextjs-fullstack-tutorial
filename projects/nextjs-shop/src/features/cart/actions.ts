"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db/client";
import { cartItems, carts, products } from "@/server/db/schema";
import { getOrCreateCartId, findCartId } from "./cart-store";

const MAX_PER_LINE = 20;

const addSchema = z.object({
  productId: z.uuid(),
  quantity: z.coerce.number().int().min(1).max(MAX_PER_LINE).default(1),
});

export async function addToCart(formData: FormData) {
  const parsed = addSchema.safeParse({
    productId: formData.get("productId"),
    quantity: formData.get("quantity") ?? 1,
  });
  if (!parsed.success) return;
  const { productId, quantity } = parsed.data;

  const [product] = await db
    .select({ stock: products.stock, active: products.active })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);
  if (!product || !product.active || product.stock < 1) return;

  const cartId = await getOrCreateCartId();
  const [existing] = await db
    .select({ quantity: cartItems.quantity })
    .from(cartItems)
    .where(and(eq(cartItems.cartId, cartId), eq(cartItems.productId, productId)));

  // 数量不能超过库存，也不超过单行上限
  const next = Math.min((existing?.quantity ?? 0) + quantity, product.stock, MAX_PER_LINE);
  await db
    .insert(cartItems)
    .values({ cartId, productId, quantity: next })
    .onConflictDoUpdate({
      target: [cartItems.cartId, cartItems.productId],
      set: { quantity: next },
    });
  await db.update(carts).set({ updatedAt: new Date() }).where(eq(carts.id, cartId));

  revalidatePath("/", "layout");
}

const updateSchema = z.object({
  productId: z.uuid(),
  quantity: z.coerce.number().int().min(0).max(MAX_PER_LINE),
});

export async function updateCartQuantity(formData: FormData) {
  const parsed = updateSchema.safeParse({
    productId: formData.get("productId"),
    quantity: formData.get("quantity"),
  });
  if (!parsed.success) return;
  const { productId, quantity } = parsed.data;

  const cartId = await findCartId();
  if (!cartId) return;

  if (quantity === 0) {
    await db
      .delete(cartItems)
      .where(and(eq(cartItems.cartId, cartId), eq(cartItems.productId, productId)));
  } else {
    const [product] = await db
      .select({ stock: products.stock })
      .from(products)
      .where(eq(products.id, productId));
    if (!product) return;
    await db
      .update(cartItems)
      .set({ quantity: Math.min(quantity, product.stock) })
      .where(and(eq(cartItems.cartId, cartId), eq(cartItems.productId, productId)));
  }
  revalidatePath("/", "layout");
}
