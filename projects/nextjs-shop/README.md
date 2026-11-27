# NextShop — Next.js 16 全栈电商学习项目

商品浏览 / 搜索筛选 / 购物车 / 结账与支付 / 订单 / 管理后台，一个可以直接跑起来、也适合逐文件阅读的全栈示例。

## 一键运行

需要安装 Docker（含 Docker Compose）。解压后在项目目录执行：

```bash
docker compose up --build
```

首次会构建镜像（几分钟），之后依次发生：数据库启动 → 自动建表并灌入 18 个演示商品 → 网站启动。

打开 http://localhost:3000

| 账号 | 密码 | 角色 |
| --- | --- | --- |
| admin@example.com | admin123 | 管理员（可进入 /admin） |
| demo@example.com | demo1234 | 顾客 |

停止：`Ctrl+C`；清空数据重来：`docker compose down -v`。

> 没有配置 Stripe 时，结账会进入一个"模拟支付"页面，点击"确认支付"即可走完整个流程。

## 技术栈

Next.js 16（App Router，Turbopack）· React 19 · TypeScript · Tailwind CSS v4 · PostgreSQL 17 · Drizzle ORM · Zod · jose（JWT 会话）· bcryptjs · Stripe（可选）· Vitest

## 项目结构

```
src/
├── app/                     # 只负责路由与页面组装
│   ├── (storefront)/        # 前台：首页、商品列表/详情、购物车、结算、支付结果
│   ├── (auth)/              # 登录 / 注册
│   ├── account/orders/      # 我的订单（需登录）
│   ├── admin/               # 后台：概览、商品 CRUD、订单处理（需管理员）
│   ├── api/webhooks/stripe/ # Stripe 支付回调
│   ├── sitemap.ts, robots.ts
│   └── layout.tsx, error.tsx, not-found.tsx
├── features/                # 按业务领域拆分（组件 + 查询 + Server Actions + 校验放一起）
│   ├── auth/  catalog/  cart/  checkout/  orders/  admin/
├── server/                  # 仅服务端基础设施
│   ├── db/                  # Drizzle schema 与连接
│   ├── auth/                # JWT 会话（token.ts 可被 proxy 复用，session.ts 依赖 cookies）
│   └── payments/stripe.ts
├── components/              # 通用 UI（Header、Footer、表单控件）
├── lib/                     # 金额、环境变量、工具函数
└── proxy.ts                 # Next.js 16 的 proxy（原 middleware）：登录/后台访问控制
drizzle/                     # 已生成的 SQL 迁移文件
scripts/                     # migrate.ts（迁移）、seed.ts（演示数据）
tests/unit/                  # Vitest 单元测试
Dockerfile, docker-compose.yml
```

## 值得细读的"最佳实践"落点

| 主题 | 位置 | 要点 |
| --- | --- | --- |
| 防超卖 | `features/checkout/actions.ts` | 事务内 `UPDATE … WHERE stock >= qty`，库存条件由数据库保证，并发下不会扣成负数 |
| 价格可信 | 同上 | 金额由服务端按数据库价格计算，不信任前端；订单项保存下单时的价格/名称快照 |
| 金额精度 | `lib/money.ts` | 全程用"分"的整数 |
| 支付以回调为准 | `app/api/webhooks/stripe/route.ts`、`features/orders/service.ts` | 用原始请求体验签；`markOrderPaid` 幂等，重复投递无副作用；会话过期自动退库存 |
| 无 Stripe 也能跑 | `features/checkout/actions.ts` | 未配置密钥自动切换到模拟支付 |
| 游客购物车 → 登录合并 | `features/cart/cart-store.ts` | 游客用 cookie 里的 cart id，登录/注册后并入用户购物车 |
| 会话安全 | `server/auth/*`、`proxy.ts` | httpOnly + SameSite cookie；proxy 做第一道拦截，页面/Action 内再用 `requireUser/requireAdmin` 校验；登录失败提示不泄露账号是否存在；`next` 参数防开放重定向 |
| 越权防护 | `app/account/orders/[id]/page.tsx` | 只能看自己的订单，他人订单一律 404 |
| 输入校验 | 各 `schemas.ts` | Zod 统一校验，错误回显到表单（`useActionState`） |
| 缓存与失效 | `features/catalog/queries.ts` | `unstable_cache` + tag，后台改商品后 `revalidateTag` 立即生效 |
| SEO | `products/[slug]/page.tsx`、`sitemap.ts`、`robots.ts` | `generateMetadata`、JSON-LD 商品结构化数据、动态 sitemap |
| 构建不依赖数据库 | `server/db/client.ts` | 连接惰性创建，`docker build` 时无需数据库 |
| 迁移与运行分离 | `docker-compose.yml` | `migrate` 一次性任务成功后，`web` 才启动 |

## 本地开发（不用 Docker）

```bash
cp .env.example .env.local          # 并准备一个本地 Postgres（或只启动 compose 里的 db）
npm install
npm run db:setup                    # 迁移 + 种子
npm run dev
npm test                            # 单元测试
npm run typecheck
```

只想用 Docker 起数据库：取消 `docker-compose.yml` 中 db 的 `ports` 注释，执行 `docker compose up db`，
并把 `.env.local` 里的 `DATABASE_URL` 改成 `postgres://shop:shop@localhost:5433/shop`。

修改表结构：编辑 `src/server/db/schema.ts` → `npm run db:generate` → `npm run db:setup`。

## 接入真实 Stripe（可选）

1. 在 Stripe 控制台拿到测试密钥 `sk_test_…`。
2. 本地用 Stripe CLI 转发 webhook：`stripe listen --forward-to localhost:3000/api/webhooks/stripe`，它会给出 `whsec_…`。
3. 带环境变量启动：

   ```bash
   STRIPE_SECRET_KEY=sk_test_xxx STRIPE_WEBHOOK_SECRET=whsec_xxx docker compose up
   ```

4. 用测试卡 `4242 4242 4242 4242` 付款。订单变为"已支付"由 webhook 触发。

## 这是学习项目，上线前还需要

- 把 `AUTH_SECRET` 换成自己的随机密钥，修改管理员密码，使用 HTTPS（并设置 `SITE_URL=https://…`）。
- 登录接口加限流/防暴力破解；增加邮箱验证、找回密码。
- 未支付订单目前靠 Stripe 的 `checkout.session.expired` 事件释放库存；模拟支付没有自动超时，生产环境应加定时清理。
- 补充：商品变体（尺码/颜色）、优惠券、运费与税费、评价、图片上传（S3/R2）、邮件通知、搜索引擎（Meilisearch/Algolia）、E2E 测试（Playwright）与监控。
- 想体验 Next.js 16 的 Cache Components（`'use cache'`）：在 `next.config.ts` 设 `cacheComponents: true`，并把 `queries.ts` 中的 `unstable_cache` 改为 `'use cache'` + `cacheTag`/`cacheLife`。注意它会在构建期预渲染，需要构建时能连上数据库。
