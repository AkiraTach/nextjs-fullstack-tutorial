import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { cancelMockOrder, payMockOrder } from "@/features/checkout/actions";
import { getOrderWithItems } from "@/features/orders/service";
import { SubmitButton } from "@/components/ui/submit-button";
import { stripeConfigured } from "@/lib/env";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = { title: "模拟支付" };

export default async function MockPayPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  if (stripeConfigured() || !z.uuid().safeParse(orderId).success) notFound();

  const order = await getOrderWithItems(orderId);
  if (!order) notFound();
  if (order.status !== "pending") redirect(`/checkout/success?order=${order.id}`);

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="card space-y-3">
        <h1 className="text-xl font-bold">模拟支付</h1>
        <p className="text-sm text-zinc-500">
          没有配置 Stripe，这里用一个假的支付页代替。配置 STRIPE_SECRET_KEY 后会自动跳转到 Stripe Checkout。
        </p>
        <ul className="space-y-1 text-sm">
          {order.items.map((i) => (
            <li key={i.id} className="flex justify-between">
              <span>{i.name} × {i.quantity}</span>
              <span>{formatMoney(i.unitPriceCents * i.quantity)}</span>
            </li>
          ))}
        </ul>
        <p className="flex justify-between border-t border-zinc-200 pt-3 font-semibold">
          <span>应付</span>
          <span>{formatMoney(order.totalCents)}</span>
        </p>
        <form action={payMockOrder}>
          <input type="hidden" name="orderId" value={order.id} />
          <SubmitButton pendingText="支付中…" className="w-full">确认支付</SubmitButton>
        </form>
        <form action={cancelMockOrder}>
          <input type="hidden" name="orderId" value={order.id} />
          <SubmitButton variant="outline" className="w-full">取消订单</SubmitButton>
        </form>
      </div>
    </div>
  );
}
