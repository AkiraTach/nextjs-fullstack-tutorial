import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { useSecureCookies } from "@/lib/env";
import { db } from "@/server/db/client";
import { cartItems, carts } from "@/server/db/schema";
import { getSession } from "@/server/auth/session";

export const CART_COOKIE = "cart_id";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 读取当前访客的购物车 id（只读，渲染阶段也能调用）。 */
export async function findCartId(): Promise<string | null> {
  const session = await getSession();
  if (session) {
    const [cart] = await db
      .select({ id: carts.id })
      .from(carts)
      .where(eq(carts.userId, session.userId))
      .limit(1);
    return cart?.id ?? null;
  }
  const raw = (await cookies()).get(CART_COOKIE)?.value;
  if (!raw || !UUID_RE.test(raw)) return null;
  const [cart] = await db
    .select({ id: carts.id })
    .from(carts)
    .where(eq(carts.id, raw))
    .limit(1);
  return cart?.id ?? null;
}

/** 取得或创建购物车。会写 cookie，只能在 Server Action / Route Handler 里调用。 */
export async function getOrCreateCartId(): Promise<string> {
  const existing = await findCartId();
  if (existing) return existing;

  const session = await getSession();
  const [cart] = await db
    .insert(carts)
    .values({ userId: session?.userId ?? null })
    .returning({ id: carts.id });

  if (!session) {
    (await cookies()).set(CART_COOKIE, cart.id, {
      httpOnly: true,
      sameSite: "lax",
      secure: useSecureCookies(),
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }
  return cart.id;
}

/** 登录/注册后：把游客购物车合并进用户购物车，并清掉游客 cookie。 */
export async function mergeGuestCartInto(userId: string) {
  const store = await cookies();
  const guestId = store.get(CART_COOKIE)?.value;
  if (!guestId || !UUID_RE.test(guestId)) return;

  await db.transaction(async (tx) => {
    const [guest] = await tx
      .select({ id: carts.id, userId: carts.userId })
      .from(carts)
      .where(eq(carts.id, guestId))
      .limit(1);
    if (!guest || guest.userId) return;

    const [userCart] = await tx
      .select({ id: carts.id })
      .from(carts)
      .where(eq(carts.userId, userId))
      .limit(1);

    if (!userCart) {
      // 用户还没有购物车：直接把游客购物车"认领"过来
      await tx.update(carts).set({ userId }).where(eq(carts.id, guest.id));
      return;
    }

    const guestItems = await tx
      .select()
      .from(cartItems)
      .where(eq(cartItems.cartId, guest.id));
    for (const item of guestItems) {
      await tx
        .insert(cartItems)
        .values({ cartId: userCart.id, productId: item.productId, quantity: item.quantity })
        .onConflictDoUpdate({
          target: [cartItems.cartId, cartItems.productId],
          set: { quantity: sql`${cartItems.quantity} + ${item.quantity}` },
        });
    }
    await tx.delete(carts).where(and(eq(carts.id, guest.id)));
  });

  store.delete(CART_COOKIE);
}
