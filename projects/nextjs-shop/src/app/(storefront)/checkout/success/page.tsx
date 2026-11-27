import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { getOrderWithItems } from "@/features/orders/service";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = { title: "订单完成" };

const STATUS_TEXT: Record<string, string> = {
  pending: "等待支付确认中（Stripe 通知到达后会自动更新）",
  paid: "支付成功",
  shipped: "已发货",
  cancelled: "已取消",
};

export default async function SuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const { order: id } = await searchParams;
  const order = id && z.uuid().safeParse(id).success ? await getOrderWithItems(id) : null;

  if (!order) {
    return (
      <div className="card text-center">
        <p>找不到该订单。</p>
        <Link href="/" className="btn mt-4">回首页</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div className="card space-y-3">
        <h1 className="text-2xl font-bold">感谢你的订单 🎉</h1>
        <p className="text-sm text-zinc-500">订单号：{order.id}</p>
        <p>状态：<strong>{STATUS_TEXT[order.status]}</strong></p>
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
          将发往：{order.shippingName}，{order.shippingAddress}，{order.shippingCity} {order.shippingPostal}，{order.shippingCountry}
        </p>
      </div>
      <Link href="/products" className="btn-outline">继续购物</Link>
    </div>
  );
}
