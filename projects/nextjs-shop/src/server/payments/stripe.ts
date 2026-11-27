import "server-only";
import Stripe from "stripe";

let client: Stripe | null = null;

/** 没配 STRIPE_SECRET_KEY 时返回 null，调用方据此切换到"模拟支付"。 */
export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  client ??= new Stripe(key);
  return client;
}
