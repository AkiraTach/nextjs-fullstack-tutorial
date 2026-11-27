import Link from "next/link";
import { logout } from "@/features/auth/actions";
import { getCart } from "@/features/cart/queries";
import { getSession } from "@/server/auth/session";

export async function Header() {
  const [session, cart] = await Promise.all([getSession(), getCart()]);

  return (
    <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
        <Link href="/" className="text-lg font-bold tracking-tight">
          NextShop
        </Link>
        <nav className="flex flex-1 items-center gap-5 text-sm text-zinc-600">
          <Link href="/products" className="hover:text-zinc-900">
            全部商品
          </Link>
          {session?.role === "admin" && (
            <Link href="/admin" className="hover:text-zinc-900">
              后台
            </Link>
          )}
        </nav>

        <form action="/products" className="hidden sm:block">
          <input
            name="q"
            placeholder="搜索商品…"
            className="input w-48"
            aria-label="搜索商品"
          />
        </form>

        <Link href="/cart" className="relative text-sm font-medium hover:underline">
          购物车
          {cart.count > 0 && (
            <span className="ml-1 rounded-full bg-zinc-900 px-1.5 py-0.5 text-xs text-white">
              {cart.count}
            </span>
          )}
        </Link>

        {session ? (
          <div className="flex items-center gap-3 text-sm">
            <Link href="/account/orders" className="hover:underline">
              {session.name}
            </Link>
            <form action={logout}>
              <button className="text-zinc-500 hover:text-zinc-900">退出</button>
            </form>
          </div>
        ) : (
          <div className="flex items-center gap-3 text-sm">
            <Link href="/login" className="hover:underline">
              登录
            </Link>
            <Link href="/register" className="btn">
              注册
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
