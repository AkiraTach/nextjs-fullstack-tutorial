import type { Metadata } from "next";
import Link from "next/link";
import { updateCartQuantity } from "@/features/cart/actions";
import { getCart } from "@/features/cart/queries";
import { ProductImage } from "@/features/catalog/components/product-card";
import { SubmitButton } from "@/components/ui/submit-button";
import { formatMoney, lineTotal } from "@/lib/money";

export const metadata: Metadata = { title: "购物车" };

export default async function CartPage() {
  const cart = await getCart();

  if (cart.lines.length === 0) {
    return (
      <div className="card text-center">
        <p className="text-zinc-500">购物车是空的</p>
        <Link href="/products" className="btn mt-4">去逛逛</Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">购物车</h1>
      <div className="grid gap-6 md:grid-cols-[1fr_320px]">
        <ul className="space-y-3">
          {cart.lines.map((l) => (
            <li key={l.productId} className="card flex items-center gap-4">
              <ProductImage src={l.imageUrl} alt={l.name} className="w-20 shrink-0 rounded-lg" />
              <div className="flex-1">
                <Link href={`/products/${l.slug}`} className="font-medium hover:underline">
                  {l.name}
                </Link>
                <p className="text-sm text-zinc-500">{formatMoney(l.unitPriceCents)}</p>
                {l.stock < l.quantity && (
                  <p className="text-xs text-red-600">库存仅剩 {l.stock} 件，请调整数量</p>
                )}
              </div>
              <form action={updateCartQuantity} className="flex items-center gap-2">
                <input type="hidden" name="productId" value={l.productId} />
                <input
                  type="number"
                  name="quantity"
                  defaultValue={l.quantity}
                  min={0}
                  max={Math.min(l.stock, 20)}
                  className="input w-16"
                  aria-label="数量"
                />
                <SubmitButton variant="outline" pendingText="…">更新</SubmitButton>
              </form>
              <p className="w-24 text-right font-semibold">
                {formatMoney(lineTotal(l.unitPriceCents, l.quantity))}
              </p>
            </li>
          ))}
        </ul>

        <aside className="card h-fit space-y-3">
          <div className="flex justify-between">
            <span>小计（{cart.count} 件）</span>
            <span className="font-semibold">{formatMoney(cart.subtotalCents)}</span>
          </div>
          <p className="text-xs text-zinc-500">运费与税费：演示站点免运费</p>
          <Link href="/checkout" className="btn w-full">去结算</Link>
        </aside>
      </div>
    </div>
  );
}
