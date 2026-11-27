# Next.js 全栈最佳实践教程

用两个完整的 Next.js 电商项目对照学习全栈开发最佳实践。

**在线阅读：https://akiratach.github.io/nextjs-fullstack-tutorial/**

## 内容

导读 + 16 章：架构分层、环境与 Docker、数据库建模（Drizzle vs 手写 SQL）、金额与定价领域规则、数据访问与缓存、认证与会话（JWT vs 数据库会话）、访问控制、表单与 Zod 校验、商品目录与 SEO、购物车、结账事务与防超卖、支付与 Webhook、订单状态机与审计、测试策略、部署、对照总结与进阶路线。每章含关键代码节选、常见误区与动手练习。

## 两个配套项目

| 项目 | 目录 | 路线 |
| --- | --- | --- |
| NextShop | `projects/nextjs-shop/` | Next.js 16 · Drizzle ORM · JWT · Stripe |
| Field Shop | `projects/ecommerce-learning/` | Next.js 15 · 手写 SQL · 会话表 · 状态机 |

各自目录下有 README，`docker compose up --build` 即可运行。

## 本地重建站点

```bash
python3 -m venv .venv && .venv/bin/pip install markdown
.venv/bin/python build.py   # 输出到 site/，把 site/ 的内容同步到仓库根目录即可
```
