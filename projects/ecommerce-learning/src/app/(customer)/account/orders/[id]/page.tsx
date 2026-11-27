import { requireUser } from '@/features/auth/server/session';
import { order } from '@/features/orders/server/queries';
import { updateOrder } from '@/features/orders/server/actions';
import { money } from '@/shared/money';
import { notFound } from 'next/navigation';
export default async function Page({ params }: {
  params: Promise<{
    id: string;
  }>;
}) {
  const u = await requireUser();
  const o = await order((await params).id, u.id);
  if (!o)
    notFound();
  const next = o.status === 'paid' ? 'cancelled' : o.status === 'delivered' ? 'return_requested' : null;
  return <>
    <h1>订单详情</h1>
    <div className="card">
      <p>订单编号：{o.id}</p>
      <p>状态：{o.status}</p>
      <p>收货地址：{o.address}</p>
      {o.items.map(i => <p key={i.name}>{i.name} × {i.quantity} — {money(i.price * i.quantity)}</p>)}
      <p>商品合计：{money(o.subtotal)} · 运费：{money(o.shipping)} · 折扣：{money(o.discount)}</p>
      <p className="price">实付 {money(o.total)}</p>
      {next && <form action={updateOrder}>
        <input
          type="hidden"
          name="id"
          value={o.id}
        />
        <input
          type="hidden"
          name="status"
          value={next}
        />
        <button>
          {next === 'cancelled' ? '取消订单并模拟退款' : '申请退货'}
        </button>
      </form>}
    </div>
  </>;
}
