import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { cartItems, products } from "@/server/db/schema";
import { sumCents } from "@/lib/money";
import { findCartId } from "./cart-store";

export type CartLine = {
  productId: string;
  slug: string;
  name: string;
  imageUrl: string | null;
  unitPriceCents: number;
  quantity: number;
  stock: number;
};

export type Cart = {
  id: string | null;
  lines: CartLine[];
  count: number;
  subtotalCents: number;
};

export async function getCart(): Promise<Cart> {
  const cartId = await findCartId();
  if (!cartId) return { id: null, lines: [], count: 0, subtotalCents: 0 };

  const lines = await db
    .select({
      productId: products.id,
      slug: products.slug,
      name: products.name,
      imageUrl: products.imageUrl,
      unitPriceCents: products.priceCents,
      quantity: cartItems.quantity,
      stock: products.stock,
    })
    .from(cartItems)
    .innerJoin(products, eq(cartItems.productId, products.id))
    .where(eq(cartItems.cartId, cartId))
    .orderBy(products.name);

  return {
    id: cartId,
    lines,
    count: lines.reduce((n, l) => n + l.quantity, 0),
    subtotalCents: sumCents(lines),
  };
}
