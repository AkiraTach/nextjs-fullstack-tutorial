import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getOrderWithItems } from "@/features/orders/service";
import { StatusBadge } from "@/features/orders/components/status-badge";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { requireUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "订单详情" };

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireUser();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const order = await getOrderWithItems(id);
  // 只能看自己的订单；他人的订单一律按"不存在"处理，不暴露其存在性
  if (!order || order.userId !== session.userId) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href="/account/orders" className="text-sm text-zinc-500 hover:underline">← 我的订单</Link>
      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">订单 {order.id.slice(0, 8)}</h1>
          <StatusBadge status={order.status} />
        </div>
        <p className="text-sm text-zinc-500">下单时间：{formatDate(order.createdAt)}</p>
        <ul className="space-y-1 text-sm">
          {order.items.map((i) => (
            <li key={i.id} className="flex justify-between">
              <span>{i.name} × {i.quantity}</span>
              <span>{formatMoney(i.unitPriceCents * i.quantity)}</span>
            </li>
          ))}
        </ul>
        <p className="flex justify-between border-t border-zinc-200 pt-3 font-semibold">
          <span>合计</span>
          <span>{formatMoney(order.totalCents)}</span>
        </p>
        <p className="text-sm text-zinc-500">
          收货：{order.shippingName}，{order.shippingAddress}，{order.shippingCity} {order.shippingPostal}，{order.shippingCountry}
        </p>
      </div>
    </div>
  );
}
