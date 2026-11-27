import { requireUser } from '@/features/auth/server/session';
import { orders } from '@/features/orders/server/queries';
import { updateOrder } from '@/features/orders/server/actions';
import { transitions } from '@/features/orders/domain/status';
import { money } from '@/shared/money';
export default async function Page() {
  await requireUser(true);
  const list = await orders();
  return <>
    <h1>订单管理</h1>
    {!list.length && <p>暂无订单。</p>}
    {list.map(o => <article className="card order" key={o.id}>
      <strong>{o.id.slice(0, 8)} · {o.email}</strong>
      <p>{o.status} · {money(o.total)}</p>
      <p>收货地址：{o.address}</p>
      {(transitions[o.status] ?? []).map(t => <form
        key={t}
        action={updateOrder}
        style={{ display: 'inline-block', marginRight: 8 }}
      >
        <input
          type="hidden"
          name="id"
          value={o.id}
        />
        <input
          type="hidden"
          name="status"
          value={t}
        />
        <button className="quiet">
          {t}
        </button>
      </form>)}
    </article>)}
  </>;
}
