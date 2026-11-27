import { requireUser } from '@/features/auth/server/session';
import { allProducts } from '@/features/catalog/server/queries';
import { updateProduct } from '@/features/catalog/server/actions';
export default async function Page() {
  await requireUser(true);
  const list = await allProducts();
  return <>
    <h1>商品与库存</h1>
    <div className="grid">
      {list.map(p => <form
        className="card stack"
        key={p.id}
        action={updateProduct}
      >
        <h2>{p.icon} {p.name}</h2>
        <input
          type="hidden"
          name="id"
          value={p.id}
        />
        <label>价格（日元）<input
          name="price"
          type="number"
          min="0"
          max="1000000"
          defaultValue={p.price}
          required
        /></label>
        <label>库存<input
          name="stock"
          type="number"
          min="0"
          max="1000000"
          defaultValue={p.stock}
          required
        /></label>
        <button>保存</button>
      </form>)}
    </div>
  </>;
}
