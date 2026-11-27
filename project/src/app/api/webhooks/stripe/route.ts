import { revalidateTag } from "next/cache";
import { CATALOG_TAG } from "@/features/catalog/queries";
import { cancelOrderAndRestock, markOrderPaid } from "@/features/orders/service";
import { getStripe } from "@/server/payments/stripe";

export const runtime = "nodejs";

// 订单是否已支付，以 Stripe 的 webhook 为准，而不是浏览器回跳到 success 页。
export async function POST(req: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) return new Response("Stripe 未配置", { status: 501 });

  const signature = req.headers.get("stripe-signature");
  if (!signature) return new Response("缺少签名", { status: 400 });

  // 验签必须使用"原始请求体"，不能先 req.json()
  const body = await req.text();
  let event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch {
    return new Response("签名校验失败", { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const orderId = event.data.object.metadata?.orderId;
      if (orderId && event.data.object.payment_status === "paid") {
        await markOrderPaid(orderId); // 幂等
      }
      break;
    }
    case "checkout.session.expired": {
      const orderId = event.data.object.metadata?.orderId;
      if (orderId && (await cancelOrderAndRestock(orderId))) {
        revalidateTag(CATALOG_TAG, "max");
      }
      break;
    }
  }

  return Response.json({ received: true });
}
