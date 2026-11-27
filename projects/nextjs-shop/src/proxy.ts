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
