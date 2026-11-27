# 第 2 章 环境配置与 Docker 编排

## 本章目标

- 理解环境变量为什么要「运行时读取 + 生产环境强制校验」
- 理解数据库连接为什么要惰性创建、开发环境为什么要挂 globalThis
- 看懂两个项目的 compose 编排：健康检查、启动顺序、迁移与运行分离

## 2.1 环境变量：不在 import 时校验

项目 A 的 `src/lib/env.ts` 第一行注释就点明了设计：

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

1. **构建与运行是两个环境**。Docker 构建镜像时往往没有（也不该有）生产密钥。如果在模块顶层 `const secret = process.env.AUTH_SECRET!` 然后校验，`next build` 会直接失败，或者更糟——把构建机的变量烤进产物。把读取包进函数、调用时才读，构建就与密钥解耦。
2. **开发可以宽容，生产必须严格**。开发环境给一个明显的假密钥（名字里带 `dev-only`，一眼能认出），生产环境缺密钥直接抛错、拒绝启动。最危险的不是抛错，而是「生产用了默认密钥还悄悄跑起来」。
3. **密钥强度在代码里守底线**：少于 32 个字符视为没配。配置校验离使用点越近，越不容易被绕过。

还有一个从 env 派生的小函数值得注意：

```ts
/** http 站点上不能设置 Secure cookie，否则浏览器会丢弃它。 */
export function useSecureCookies(): boolean {
  return siteUrl().startsWith("https://");
}
```

本地是 http，如果无条件给 cookie 加 `Secure`，浏览器会直接丢弃，登录永远不成功——这是新手最常踩的坑之一。这里用站点 URL 推导，既保证本地能跑，又保证生产（https）自动开启。

## 2.2 数据库连接：惰性 + 单例

项目 A 的 `src/server/db/client.ts`：

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

- **惰性**：`postgres()` 只是创建客户端对象，不立即建连。于是 `next build`（会 import 全部模块做预渲染分析）不需要数据库在场。项目 A 的 `next.config.ts` 里特意注释了为什么不用 Next 16 的 Cache Components：那需要在构建期预渲染并连库——**「构建不依赖数据库」是一条被刻意守住的线**。
- **单例**：开发模式的热更新（HMR）会反复执行模块代码，每次都新建连接池，几分钟就能耗尽 PostgreSQL 的连接数。把连接挂在 `globalThis` 上跨重载复用，是 Next.js 生态的标准解法。项目 B 的 `src/infrastructure/database/client.ts` 用 `pg.Pool` 写了完全相同的模式——两个独立项目撞到同一个坑、给出同一个解，这就是「最佳实践」的样子。

## 2.3 Compose 编排：顺序即正确性

项目 A 的 `docker-compose.yml` 有三个服务：

```
db（postgres:17） ──healthy──► migrate（一次性：建表+种子，跑完退出） ──成功──► web
```

关键在 `depends_on` 的条件：

```yaml
web:
  depends_on:
    db:
      condition: service_healthy        # 等数据库真的能连了，而不是容器起来了
    migrate:
      condition: service_completed_successfully   # 等迁移成功结束
```

- `service_healthy` 靠 db 的 healthcheck（`pg_isready`）判断。容器「启动」≠ 数据库「可连接」，不等健康检查，web 起来就是一片连接错误。
- **迁移与运行分离**：迁移是一个独立的一次性任务，成功后 web 才启动。好处：迁移失败时 web 根本不会以半成品的表结构对外服务；扩容多个 web 实例时也不会并发重复迁移。项目 A 的 Dockerfile 为此专门做了一个 `tools` 构建目标，只含迁移脚本和 schema，跑完即退。

项目 B 用了另一种初始化方式：把 `migrations/001-init.sql` 挂到 PostgreSQL 官方镜像的 `/docker-entrypoint-initdb.d/`——空数据卷首次启动时自动执行。简单，但 B 的架构文档明确写了它的边界：**这只是初始化脚本，不是版本迁移工具**；数据卷一旦建好，后续改表它不会再跑。学习项目可以，生产必须换成有版本号的迁移（A 的 drizzle 迁移就是）。

## 2.4 两个 compose 的安全细节对比

- 项目 B 的 web 端口绑 `127.0.0.1:3000`（只本机可访问），并在 README 里警告不要直接部署到公网；项目 A 绑所有网卡。学习项目绑回环是更稳妥的默认。
- 项目 A 的 compose 里所有密钥都写了「仅本地演示」的注释，并支持用环境变量覆盖（`${STRIPE_SECRET_KEY:-}`）。演示默认值出现在 compose 里是**教学便利与安全之间的明确取舍**——注释里把话说清了，上线前必须换。

## 常见误区

- **「process.env 在代码里随便读就行」**：散落各处的 env 读取没有校验、没有默认值策略，部署时缺一个变量就是一个线上事故。用一个 env 模块收口。
- **「容器起来了服务就是好的」**：启动顺序 ≠ 就绪顺序。凡是依赖数据库/队列的服务，都要等对方的健康检查，而不是 `depends_on` 了事。
- **「迁移放在 web 启动脚本里最省事」**：多实例并发迁移、迁移失败还对外服务、回滚困难——省的事后面都要还。

## 本章练习

1. 把项目 A 的 `AUTH_SECRET` 改成一个 10 字符的短字符串，以生产模式启动（`NODE_ENV=production`），观察它在什么时机报错、报什么错。
2. 给项目 B 的 compose 加一个 `migrate` 式的一次性服务（哪怕只执行一句 `SELECT 1`），让 web 等它成功后再启动，体会 `service_completed_successfully`。
3. 思考题：项目 A 为什么把 `DATABASE_URL` 的默认值写成一个能连本地的地址？这在什么情况下会帮倒忙（提示：生产忘配变量时）？
