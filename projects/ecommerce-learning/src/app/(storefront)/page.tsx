import Link from 'next/link';
import { products } from '@/features/catalog/server/queries';
import { ProductCard } from '@/features/catalog/components/product-card';
export default async function Home() {
  const list = await products();
  return <>
    <section className="hero">
      <p className="muted">EVERYDAY ESSENTIALS / DEMO STORE</p>
      <h1>为日常生活，挑选好物。</h1>
      <p>从商品浏览到订单退款，体验一套完整的核心电商交易流程。</p>
      <Link className="button" href="/products">浏览商品</Link>
    </section>
    <h2>精选商品</h2>
    <div className="grid">
      {list.map(p => <ProductCard key={p.id} p={p} />)}
    </div>
  </>;
}
