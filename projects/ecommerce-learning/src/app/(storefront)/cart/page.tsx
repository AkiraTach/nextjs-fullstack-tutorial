import Link from 'next/link';
import { requireUser } from '@/features/auth/server/session';
import { cart } from '@/features/cart/server/queries';
import { setQuantity } from '@/features/cart/server/actions';
import { money } from '@/shared/money';
export default async function Page() {
  const u = await requireUser();
  const rows = await cart(u.id);
  return <>
    <h1>购物车</h1>
    {!rows.length ? <p>购物车为空。<Link href="/products">继续购物</Link></p> : <>
      <div className="scroll">
        <table>
          <thead>
            <tr>
              <th>商品</th>
              <th>单价</th>
              <th>数量（0 为删除）</th>
              <th>小计</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => <tr key={r.id}>
              <td>
                {r.name}
                {(!r.active || r.stock < r.quantity) && <p className="error">库存不足或已下架</p>}
              </td>
              <td>
                {money(r.price)}
              </td>
              <td>
                <form action={setQuantity} className="row">
                  <input
                    type="hidden"
                    name="id"
                    value={r.id}
                  />
                  <input
                    type="number"
                    name="quantity"
                    min="0"
                    max="99"
                    defaultValue={r.quantity}
                    style={{ width: 80 }}
                  />
                  <button className="quiet">更新</button>
                </form>
              </td>
              <td>
                {money(r.price * r.quantity)}
              </td>
            </tr>)}
          </tbody>
        </table>
      </div>
      <h2>商品合计 {money(rows.reduce((s, r) => s + r.price * r.quantity, 0))}</h2>
      <Link className="button" href="/checkout">去结账</Link>
    </>}
  </>;
}
