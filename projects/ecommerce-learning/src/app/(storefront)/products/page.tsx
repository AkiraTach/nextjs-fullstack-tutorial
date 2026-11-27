import { products } from '@/features/catalog/server/queries';
import { ProductCard } from '@/features/catalog/components/product-card';
export default async function Page({ searchParams }: {
  searchParams: Promise<{
    q?: string;
    category?: string;
  }>;
}) {
  const { q = '', category = '' } = await searchParams;
  const list = await products(typeof q === 'string' ? q.slice(0, 100) : '', typeof category === 'string' ? category : '');
  return <>
    <h1>全部商品</h1>
    <form className="row">
      <input
        name="q"
        placeholder="搜索商品"
        defaultValue={q}
      />
      <select name="category" defaultValue={category}>
        <option value="">全部分类</option>
        {['生活', '家居', '文具', '数码'].map(x => <option key={x}>
          {x}
        </option>)}
      </select>
      <button>搜索</button>
    </form>
    <p>找到 {list.length} 件商品</p>
    <div className="grid">
      {list.map(p => <ProductCard key={p.id} p={p} />)}
    </div>
  </>;
}
