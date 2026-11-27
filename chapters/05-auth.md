---
layout: default
title: "05 · 身份认证、授权与安全边界"
---

[返回目录](../index.md)

# 05 · 身份认证、授权与安全边界

## 原则
认证回答“你是谁”。授权回答“你能操作什么”。两者必须分别检查。Proxy 不能代替业务入口授权。

源码：`src/server/auth/session.ts`

```ts
import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { useSecureCookies } from "@/lib/env";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  signSession,
  verifySession,
  type SessionPayload,
} from "./token";

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  return verifySession(store.get(SESSION_COOKIE)?.value);
}

export async function createSession(payload: SessionPayload) {
  const store = await cookies();
  store.set(SESSION_COOKIE, await signSession(payload), {
    httpOnly: true,
    sameSite: "lax",
    secure: useSecureCookies(),
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/** 页面 / Server Action 内的二次校验（proxy.ts 只是第一道门，不能作为唯一防线）。 */
export async function requireUser(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export async function requireAdmin(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) redirect("/login?next=/admin");
  if (session.role !== "admin") redirect("/");
  return session;
}
```

源码：`src/proxy.ts`

```ts
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/server/auth/token";

// Next.js 16：proxy.ts 取代了 middleware.ts，运行在 Node.js 运行时。
// 这里只做"粗粒度"的访问控制；真正的权限校验在页面/Action 里用 requireUser / requireAdmin 再做一次。
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);

  const needsLogin = pathname.startsWith("/account") || pathname.startsWith("/admin");
  if (needsLogin && !session) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/admin") && session?.role !== "admin") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // 已登录用户访问登录/注册页，直接回首页
  if ((pathname === "/login" || pathname === "/register") && session) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/account/:path*", "/admin/:path*", "/login", "/register"],
};
```

项目使用 jose 签名 HS256 JWT，期限七天；bcryptjs 哈希密码；Cookie 设置 HttpOnly、SameSite=Lax，并根据 SITE_URL 决定 Secure。JWT 签名不等于加密。不要在 JWT 中放敏感信息。

## 源码审查：必须改进的边界
| 原项目位置 | 问题 | 改进 |
|---|---|---|
| `checkout/success/page.tsx`（storefront 路由组） | 按 UUID 查询并显示收货信息，无订单归属校验 | 登录用户校验归属；游客使用专用高熵、限时访问凭证 |
| `checkout/actions.ts` | payMockOrder 无归属校验；cancelMockOrder 连 Stripe 配置检查也缺少 | 在两个 Action 内检查演示环境及归属 |
| `cart/cart-store.ts` | 游客按 cart id 查询时未限制 userId 为空 | 约束游客只能访问游客购物车；对凭证进行严格管理 |
| `auth/actions.ts` | safeNext 只检查斜杠前缀，未覆盖反斜杠等 URL 解析边界 | 使用可靠 URL 解析并校验同源，或仅允许白名单路径 |
| `server/auth/session.ts` | 角色来自 JWT，旧 token 在角色变更后仍有效 | 敏感操作重新查数据库，或引入可撤销会话 |

`account/orders/[id]/page.tsx` 有订单归属校验，是对象级授权的学习案例。UUID 不是权限。隐藏按钮也不是权限。

原项目没有登录限流、会话撤销体系和完整审计日志。公网部署前补充这些能力，并删除默认账号及默认密钥。模拟支付不得在真实环境默认启用。

## 练习
用两名测试用户创建数据。验证 A 无法通过修改 URL 或表单参数读取、修改 B 的数据。测试普通用户直接调用管理员 Action。所有测试仅在自己的本地环境执行。


---

[上一章：Server Actions、输入校验与错误处理](04-actions.md) · [目录](../index.md) · [下一章：缓存、失效与数据新鲜度](06-cache.md)
