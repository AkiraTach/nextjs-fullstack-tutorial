import { product } from '@/features/catalog/server/queries';
import { notFound } from 'next/navigation';
import { money } from '@/shared/money';
import { addToCart } from '@/features/cart/server/actions';
export default async function Page({ params }: {
  params: Promise<{
    slug: string;
  }>;
}) {
  const p = await product((await params).slug);
  if (!p)
    notFound();
  return <div className="split">
    <div className="product-icon" style={{ minHeight: 320, fontSize: 120 }}>
      {p.icon}
    </div>
    <section>
      <p className="muted">
        {p.category}
      </p>
      <h1>
        {p.name}
      </h1>
      <p>
        {p.description}
      </p>
      <p className="price">
        {money(p.price)}
      </p>
      <p>库存 {p.stock}</p>
      <form action={addToCart}>
        <input
          type="hidden"
          name="id"
          value={p.id}
        />
        <button disabled={!p.stock}>加入购物车</button>
      </form>
    </section>
  </div>;
}
