# 第 7 章 访问控制：两道门与越权防护

## 本章目标

- 理解为什么访问控制要做两层：proxy 粗拦截 + 每个入口自己再验
- 理解「他人的资源按不存在处理」的越权防护原则
- 看懂两个项目里 requireUser / requireAdmin 的统一守卫模式

## 7.1 第一道门：proxy 只做粗粒度拦截

Next.js 16 里 middleware 改名为 proxy。项目 A 的 `src/proxy.ts`：

```ts
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
  return NextResponse.next();
}

export const config = {
  matcher: ["/account/:path*", "/admin/:path*", "/login", "/register"],
};
```

它只回答两个粗问题：没登录的能不能进 `/account`、`/admin`？不是管理员的能不能进 `/admin`？答完就放行，**不查数据库、不判具体资源归属**。这样设计是因为 proxy 跑在每个匹配请求的最前面，必须轻。

文件顶部的注释把定位说得很清楚：「这里只做粗粒度的访问控制；真正的权限校验在页面/Action 里再做一次。」

## 7.2 第二道门：每个入口自己验

项目 A 的 `src/server/auth/session.ts` 提供两个守卫，页面和 Server Action 统一调用：

```ts
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

项目 B 的 `requireUser(admin = false)` 是同样的模式（第 6 章见过）。两个项目里**每一个**写操作的第一行都是它：后台改商品、改订单状态、下单、改购物车——无一例外。

为什么不能只靠 proxy 一道门？

1. **Server Action 是独立入口**。Action 可以被直接 POST 调用，不经过页面渲染；proxy 的 matcher 没覆盖到的路径，action 若不自验就是裸奔。
2. **proxy 的判断粒度不够**。它只能按路径判断，判不了「这个订单是不是你的」这种数据级权限。
3. **纵深防御**：一道门写错（matcher 漏配、路径前缀被绕过），第二道门还能兜住。安全机制按「单点失效不致命」设计。

## 7.3 数据级权限：他人的订单按「不存在」处理

登录了、也是合法用户，就能看所有订单吗？不能。项目 A 的订单详情页（`src/app/account/orders/[id]/page.tsx`）：

```ts
const session = await requireUser();
const { id } = await params;
if (!z.uuid().safeParse(id).success) notFound();

const order = await getOrderWithItems(id);
// 只能看自己的订单；他人的订单一律按"不存在"处理，不暴露其存在性
if (!order || order.userId !== session.userId) notFound();
```

两个细节：

- **先校验 id 格式**：不是 UUID 直接 404，避免无意义的数据库查询和奇怪的报错。
- **越权 = 404，不是 403**：返回 403 等于告诉对方「这个订单存在，你只是没权限」，攻击者可以据此枚举订单 id。404 则什么都不泄露——存在与不存在看起来一模一样。

项目 B 把归属校验直接写进查询：`WHERE id=$1 AND user_id=$2`——查不到就是没有，天然 404。两种写法，一种原则：**权限过滤越靠近数据越可靠**。

B 的状态变更工作流还多一层「动作级」权限：同一个 `changeOrderStatus`，管理员什么都能做，顾客只能对自己订单做 `cancelled` 和 `return_requested` 两种动作，在 workflow 入口统一判断（第 13 章）。页面上藏起按钮只是体验，服务端的这道判断才是权限本身。

## 常见误区

- **「前端把按钮藏了，后端就不用验了」**：按钮藏不藏和接口验不验是两回事。任何人都能绕过 UI 直接发请求。
- **「middleware 验过登录，页面就安全了」**：middleware 验的是「有没有票」，页面要的是「这个人能不能动这份数据」。粒度不同，不可互相替代。
- **「返回 403 更语义正确」**：对涉及资源存在性的场景，语义正确让位于不泄漏。先想清楚响应会告诉对方什么，再选状态码。
- **「在布局（layout）里验一次就够了」**：layout 不覆盖 Server Action 的调用路径，且嵌套路由的 layout 行为容易误判。每个写入口自验是最稳的笨办法。

## 本章练习

1. 用顾客账号登录项目 A，把地址栏里的订单 id 换成管理员订单的 id（可先用管理员下单拿一个 id），观察返回什么、为什么这样设计。
2. 在项目 A 里故意删掉后台某个 action 的 `requireAdmin()`，再以顾客身份直接调用它（可以用浏览器控制台 fetch），验证 proxy 能不能拦住你。结论写下来，改完还原。
3. 思考题：项目 B 的 `user()` 每次调用都查一次数据库。页面渲染里调用三次会发生什么？（提示：想想 React 的 `cache()` 或请求级备忘。）
