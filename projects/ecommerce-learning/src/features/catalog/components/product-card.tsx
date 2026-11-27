import Link from 'next/link';
import type { Product } from '../server/queries';
import { money } from '@/shared/money';
import { addToCart } from '../../cart/server/actions';
export function ProductCard({ p }: {
  p: Product;
}) {
  return <article className="card">
    <Link href={'/products/' + p.slug}>
      <div className="product-icon" aria-hidden>
        {p.icon}
      </div>
      <h2>
        {p.name}
      </h2>
    </Link>
    <p className="muted">{p.category} · 库存 {p.stock}</p>
    <p className="price">
      {money(p.price)}
    </p>
    <form action={addToCart}>
      <input
        type="hidden"
        name="id"
        value={p.id}
      />
      <button disabled={!p.stock}>加入购物车</button>
    </form>
  </article>;
}
