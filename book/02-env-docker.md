# 第 2 章 配置、环境与运行编排

## 本章目标

- 理解环境变量为什么要「运行时读取 + 生产环境强制校验」
- 理解数据库连接为什么要惰性创建、开发环境为什么要挂 globalThis
- 看懂 compose 编排里的启动顺序：健康检查、迁移与运行分离、健康检查接口

## 2.1 环境变量：不在 import 时校验

`src/lib/env.ts` 第一行注释就点明了设计：

```ts
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
```

三个要点：

1. **构建与运行是两个环境**。构建镜像时往往没有（也不该有）生产密钥。如果在模块顶层读 env 并校验，`next build` 会直接失败，或者更糟——把构建机的变量烤进产物。把读取包进函数、调用时才读，构建就与密钥解耦。
2. **开发可以宽容，生产必须严格**。开发环境给一个名字里带 `dev-only` 的假密钥（一眼能认出），生产环境缺密钥直接抛错、拒绝启动。最危险的不是抛错，而是「生产用了默认密钥还悄悄跑起来」。
3. **强度底线写在代码里**：少于 32 个字符视为没配。校验离使用点越近，越不容易被绕过。

还有一个从 env 派生的小函数值得注意：

```ts
/** http 站点上不能设置 Secure cookie，否则浏览器会丢弃它。 */
export function useSecureCookies(): boolean {
  return siteUrl().startsWith("https://");
}
```

本地是 http，如果无条件给 cookie 加 `Secure`，浏览器会直接丢弃，登录永远不成功——新手最常踩的坑之一。用站点 URL 推导，既保证本地能跑，又保证生产（https）自动开启。

## 2.2 数据库连接：惰性 + 单例

`src/server/db/client.ts`：

```ts
import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

// postgres() 是惰性连接的：import 时不会真的连库，所以 `next build` 不需要数据库。
// 开发模式下热更新会重复执行本模块，用 globalThis 缓存连接避免连接泄漏。
const globalForDb = globalThis as unknown as { __sql?: ReturnType<typeof postgres> };
const sql = globalForDb.__sql ?? postgres(process.env.DATABASE_URL ?? "postgres://…", { max: 10 });
if (process.env.NODE_ENV !== "production") globalForDb.__sql = sql;

export const db = drizzle(sql, { schema });
```

- **惰性**：`postgres()` 只创建客户端对象，不立即建连。于是 `next build`（会 import 全部模块）不需要数据库在场。`next.config.ts` 里特意注释了为什么不用 Next 16 的 Cache Components：那需要在构建期预渲染并连库——**「构建不依赖数据库」是一条被刻意守住的线**，第 15 章的镜像构建靠它成立。
- **单例**：开发模式的热更新（HMR）会反复执行模块代码，每次新建连接池，几分钟就能耗尽 PostgreSQL 的连接数。把连接挂在 `globalThis` 上跨重载复用，是 Next.js 生态的标准解法。任何用连接池的驱动（pg、Prisma 等）都有同一条经验。

## 2.3 编排：顺序即正确性

`docker-compose.yml` 有三个服务，启动顺序被写死：

```
db（postgres:17） ──healthy──► migrate（一次性：建表+种子，跑完退出） ──成功──► web
```

```yaml
web:
  depends_on:
    db:
      condition: service_healthy              # 等数据库真的能连，而不是容器起来了
    migrate:
      condition: service_completed_successfully  # 等迁移成功结束
```

- `service_healthy` 靠 db 的 healthcheck（`pg_isready`）。容器「启动」≠ 数据库「可连接」，不等健康检查，web 起来就是一片连接错误。
- **迁移与运行分离**：迁移是独立的一次性任务，成功后 web 才启动。迁移失败时，web 不会以半成品表结构对外服务；将来扩到多个 web 实例，也不会并发重复迁移。Dockerfile 为此专门做了 `tools` 构建目标，只含迁移脚本和 schema，跑完即退（第 15 章）。

数据库的初始化方式也要分清：用 PostgreSQL 镜像的 `/docker-entrypoint-initdb.d/` 挂 SQL 文件，只适合「空库一次性初始化」，数据卷建好后不会重跑，**不是迁移工具**。长期项目必须用有版本号的迁移链（本项目用 drizzle 迁移，第 3 章）。

## 2.4 健康检查接口：查真依赖

应用对外提供一个健康检查端点，供编排系统与负载均衡判断「这台能不能接流量」：

```ts
// 形态示意：健康检查必须查真依赖，而不是回一个写死的 ok
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    await db.execute(sql`SELECT 1`);
    return Response.json({ status: 'ok' });
  } catch {
    return Response.json({ status: 'unavailable' }, { status: 503 });
  }
}
```

进程活着但数据库连不上时返回 503，流量就不会继续往这台送。`force-dynamic` 保证每次都真查、不吃缓存。健康检查回写死的 200 只证明进程没死，证明不了服务可用——这是上线检查里最常见的一个假动作。

## 常见误区

- **「process.env 在代码里随便读就行」**：散落各处的 env 读取没有校验、没有默认值策略，部署时缺一个变量就是一个线上事故。用一个 env 模块收口。
- **「容器起来了服务就是好的」**：启动顺序 ≠ 就绪顺序。依赖数据库/队列的服务要等对方健康检查，而不是 `depends_on` 了事。
- **「迁移放在 web 启动脚本里最省事」**：多实例并发迁移、迁移失败还对外服务、回滚困难——省的事后面都要还。

## 本章练习

1. 把 `AUTH_SECRET` 改成 10 个字符的短字符串，以生产模式启动（`NODE_ENV=production`），观察它在什么时机报错、报什么错。
2. 给参考实现加上 2.4 的健康检查端点（`/api/health`），停掉数据库再访问它，验证返回 503。
3. 思考题：`DATABASE_URL` 的默认值写成了一个能连本地的地址。这在什么情况下会帮倒忙？（提示：生产忘配变量时，应用会连向哪里？）
