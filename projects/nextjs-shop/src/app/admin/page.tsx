import type { Metadata } from "next";
import { eq, lte, sql } from "drizzle-orm";
import Link from "next/link";
import { formatMoney } from "@/lib/money";
import { db } from "@/server/db/client";
import { orders, products } from "@/server/db/schema";

export const metadata: Metadata = { title: "后台概览" };

export default async function AdminDashboard() {
  const [[orderStats], [productStats], lowStock] = await Promise.all([
    db
      .select({
        total: sql<number>`count(*)::int`,
        pending: sql<number>`count(*) filter (where ${orders.status} = 'pending')::int`,
        revenue: sql<number>`coalesce(sum(${orders.totalCents}) filter (where ${orders.status} in ('paid','shipped')), 0)::int`,
      })
      .from(orders),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(products)
      .where(eq(products.active, true)),
    db
      .select({ id: products.id, name: products.name, stock: products.stock })
      .from(products)
      .where(lte(products.stock, 5))
      .orderBy(products.stock)
      .limit(10),
  ]);

  const stats = [
    { label: "订单总数", value: orderStats.total },
    { label: "待支付", value: orderStats.pending },
    { label: "已收款", value: formatMoney(orderStats.revenue) },
    { label: "上架商品", value: productStats.total },
  ];

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">概览</h1>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="card">
            <p className="text-sm text-zinc-500">{s.label}</p>
            <p className="mt-1 text-2xl font-semibold">{s.value}</p>
          </div>
        ))}
      </div>

      <section>
        <h2 className="mb-3 font-semibold">低库存提醒（≤ 5）</h2>
        {lowStock.length === 0 ? (
          <p className="text-sm text-zinc-500">暂无。</p>
        ) : (
          <ul className="card divide-y divide-zinc-100 p-0 text-sm">
            {lowStock.map((p) => (
              <li key={p.id} className="flex justify-between px-5 py-3">
                <Link href={`/admin/products/${p.id}`} className="hover:underline">{p.name}</Link>
                <span className={p.stock === 0 ? "text-red-600" : "text-amber-600"}>库存 {p.stock}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
