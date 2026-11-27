import { randomUUID } from 'node:crypto';
import { requireUser } from '@/features/auth/server/session';
import { cart } from '@/features/cart/server/queries';
import { checkout } from '@/features/checkout/server/actions';
import { totals } from '@/features/pricing/domain/totals';
import { money } from '@/shared/money';
import Link from 'next/link';
export default async function Page({ searchParams }: {
  searchParams: Promise<{
    error?: string;
  }>;
}) {
  const u = await requireUser();
  const rows = await cart(u.id);
  const t = totals(rows.reduce((s, r) => s + r.price * r.quantity, 0), '');
  const { error } = await searchParams;
  return <>
    <h1>结账</h1>
    {error && <p className="error" role="alert">结账失败：{error}。请检查地址或购物车库存。</p>}
    {!rows.length ? <Link href="/products">购物车为空，继续购物</Link> : <div className="split">
      <form action={checkout} className="card stack">
        <input
          type="hidden"
          name="key"
          value={randomUUID()}
        />
        <label>收货地址<textarea
          name="address"
          required
          minLength={5}
          maxLength={500}
          placeholder="请使用虚构地址进行测试"
        /></label>
        <label>优惠码<input
          name="code"
          placeholder="LEARN10（九折）"
          maxLength={40}
        /></label>
        <p>支付方式：本地模拟支付。不会真实扣款。</p>
        <button>提交订单并模拟支付</button>
      </form>
      <section className="card">
        <h2>订单摘要</h2>
        {rows.map(r => <p key={r.id}>{r.name} × {r.quantity} — {money(r.price * r.quantity)}</p>)}
        <p>运费：{money(t.shipping)}</p>
        <p className="price">折扣前合计 {money(t.total)}</p>
        <p className="muted">满 ¥5,000 免运费。优惠将在服务端计算。</p>
      </section>
    </div>}
  </>;
}
