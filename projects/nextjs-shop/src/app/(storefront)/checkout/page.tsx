import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCart } from "@/features/cart/queries";
import { CheckoutForm } from "@/features/checkout/components/checkout-form";
import { formatMoney, lineTotal } from "@/lib/money";
import { stripeConfigured } from "@/lib/env";
import { getSession } from "@/server/auth/session";

export const metadata: Metadata = { title: "结算" };

export default async function CheckoutPage() {
  const [cart, session] = await Promise.all([getCart(), getSession()]);
  if (cart.lines.length === 0) redirect("/cart");

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">结算</h1>
      <div className="grid gap-6 md:grid-cols-[1fr_340px]">
        <div className="space-y-3">
          {!session && (
            <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
              你正在以游客身份结算。
              <Link href="/login?next=/checkout" className="underline">登录</Link>
              后可在「我的订单」中查看订单。
            </p>
          )}
          <CheckoutForm defaultEmail={session?.email ?? ""} defaultName={session?.name ?? ""} />
        </div>

        <aside className="card h-fit space-y-3 text-sm">
          <h2 className="text-lg font-semibold">订单摘要</h2>
          <ul className="space-y-2">
            {cart.lines.map((l) => (
              <li key={l.productId} className="flex justify-between gap-3">
                <span>{l.name} × {l.quantity}</span>
                <span>{formatMoney(lineTotal(l.unitPriceCents, l.quantity))}</span>
              </li>
            ))}
          </ul>
          <div className="flex justify-between border-t border-zinc-200 pt-3 text-base font-semibold">
            <span>合计</span>
            <span>{formatMoney(cart.subtotalCents)}</span>
          </div>
          <p className="text-xs text-zinc-500">
            支付方式：{stripeConfigured() ? "Stripe Checkout" : "模拟支付（未配置 Stripe）"}
          </p>
        </aside>
      </div>
    </div>
  );
}
