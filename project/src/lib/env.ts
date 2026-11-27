/** 运行时读取环境变量（不在 import 时校验，避免 `next build` 因缺少变量失败）。 */
export function siteUrl(): string {
  return (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export function authSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("AUTH_SECRET 必须设置，且至少 32 个字符");
    }
    return new TextEncoder().encode("dev-only-secret-dev-only-secret-dev-only");
  }
  return new TextEncoder().encode(secret);
}

export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/** http 站点上不能设置 Secure cookie，否则浏览器会丢弃它。 */
export function useSecureCookies(): boolean {
  return siteUrl().startsWith("https://");
}
