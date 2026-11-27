import Link from 'next/link';
import { requireUser } from '@/features/auth/server/session';
import { orders } from '@/features/orders/server/queries';
import { money } from '@/shared/money';
export default async function Page() {
  const u = await requireUser();
  const list = await orders(u.id);
  return <>
    <h1>我的订单</h1>
    {!list.length && <p>暂无订单。</p>}
    {list.map(o => <article className="card order" key={o.id}>
      <Link href={'/account/orders/' + o.id}>
        <strong>订单 {o.id.slice(0, 8)}</strong>
      </Link>
      <p>{o.status} · {money(o.total)} · {o.created_at.toISOString().slice(0, 10)}</p>
    </article>)}
  </>;
}
