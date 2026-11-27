import type { Metadata } from "next";
import { desc } from "drizzle-orm";
import { updateOrderStatus } from "@/features/admin/actions";
import { StatusBadge } from "@/features/orders/components/status-badge";
import { SubmitButton } from "@/components/ui/submit-button";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { db } from "@/server/db/client";
import { orders } from "@/server/db/schema";

export const metadata: Metadata = { title: "订单管理" };

function StatusForm({ orderId, status, label }: { orderId: string; status: string; label: string }) {
  return (
    <form action={updateOrderStatus}>
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="status" value={status} />
      <SubmitButton variant="outline" pendingText="…">{label}</SubmitButton>
    </form>
  );
}

export default async function AdminOrdersPage() {
  const rows = await db.query.orders.findMany({
    orderBy: desc(orders.createdAt),
    limit: 100,
    with: { items: true },
  });

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">订单</h1>
      {rows.length === 0 ? (
        <p className="card text-zinc-500">暂无订单。</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((o) => (
            <li key={o.id} className="card space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">订单 {o.id.slice(0, 8)} · {o.email}</p>
                  <p className="text-zinc-500">{formatDate(o.createdAt)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={o.status} />
                  <span className="font-semibold">{formatMoney(o.totalCents)}</span>
                </div>
              </div>
              <p className="text-zinc-600">
                {o.items.map((i) => `${i.name} × ${i.quantity}`).join("，")}
              </p>
              <p className="text-zinc-500">
                {o.shippingName}，{o.shippingAddress}，{o.shippingCity} {o.shippingPostal}，{o.shippingCountry}
              </p>
              <div className="flex gap-2">
                {o.status === "pending" && <StatusForm orderId={o.id} status="paid" label="标记已收款" />}
                {o.status === "paid" && <StatusForm orderId={o.id} status="shipped" label="标记已发货" />}
                {(o.status === "pending" || o.status === "paid") && (
                  <StatusForm orderId={o.id} status="cancelled" label="取消并退还库存" />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
