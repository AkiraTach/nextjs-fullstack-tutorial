import { requireUser } from '@/features/auth/server/session';
import { db } from '@/infrastructure/database/client';
import { money } from '@/shared/money';
export default async function Page() {
  await requireUser(true);
  const r = (await db.query("SELECT (SELECT count(*) FROM products) AS products,(SELECT count(*) FROM orders) AS orders,(SELECT coalesce(sum(total),0) FROM orders WHERE status NOT IN ('cancelled','refunded')) AS revenue")).rows[0];
  return <>
    <h1>管理后台</h1>
    <div className="grid">
      <div className="card">商品数<h2>
        {r.products}
      </h2></div>
      <div className="card">订单数<h2>
        {r.orders}
      </h2></div>
      <div className="card">未退款订单金额<h2>
        {money(Number(r.revenue))}
      </h2></div>
    </div>
  </>;
}
