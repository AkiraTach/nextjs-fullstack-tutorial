import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { StatusBadge } from "@/features/orders/components/status-badge";
import { formatDate } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db/client";
import { orders } from "@/server/db/schema";

export const metadata: Metadata = { title: "我的订单" };

export default async function MyOrdersPage() {
  const session = await requireUser();
  const rows = await db
    .select()
    .from(orders)
    .where(eq(orders.userId, session.userId))
    .orderBy(desc(orders.createdAt));

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">我的订单</h1>
      {rows.length === 0 ? (
        <p className="card text-zinc-500">还没有订单。</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((o) => (
            <li key={o.id} className="card flex items-center justify-between">
              <div>
                <Link href={`/account/orders/${o.id}`} className="font-medium hover:underline">
                  订单 {o.id.slice(0, 8)}
                </Link>
                <p className="text-sm text-zinc-500">{formatDate(o.createdAt)}</p>
              </div>
              <div className="flex items-center gap-4">
                <StatusBadge status={o.status} />
                <span className="font-semibold">{formatMoney(o.totalCents)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
