---
layout: default
title: "10 · 容器、配置与部署拓扑"
---

[返回目录](../index.md)

# 10 · 容器、配置与部署拓扑

## 两个部署目标
GitHub Pages 发布本教程的静态 HTML。Next.js 示例需要 Node.js、PostgreSQL 和可选 Stripe；不能直接由 GitHub Pages 执行 Server Actions、动态服务端渲染或 Webhook。

源码：`Dockerfile`

```dockerfile
# syntax=docker/dockerfile:1

FROM node:22-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# ---- 依赖（含 devDependencies，用于构建与迁移）----
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# ---- 构建 Next.js（standalone 产物）----
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---- 迁移 + 种子数据（一次性任务，跑完即退出）----
FROM base AS tools
COPY --from=deps /app/node_modules ./node_modules
COPY package.json tsconfig.json ./
COPY drizzle ./drizzle
COPY scripts ./scripts
COPY src/server/db/schema.ts ./src/server/db/schema.ts
CMD ["npm", "run", "db:setup"]

# ---- 运行时镜像（最小化）----
FROM base AS runner
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
RUN groupadd --system --gid 1001 nodejs && useradd --system --uid 1001 --gid nodejs nextjs
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
```

多阶段构建将依赖、构建、迁移工具和运行时分开。`output: "standalone"` 生成运行产物。运行镜像使用非 root 用户。Compose 用 `service_healthy` 等待数据库，用 `service_completed_successfully` 等待 migrate 任务。

```text
docker build → runner 镜像
Postgres 健康检查 → migrate（迁移 + seed） → web
```

## 本地运行原项目
**警告：** 仅用于本机学习。默认账号、密钥与模拟支付均不适合公网部署。

```bash
docker compose up --build
```
打开 `http://localhost:3000`。停止时按 Ctrl+C。只有明确需要删除所有数据库数据时才执行 `docker compose down -v`。

## 不使用 Docker
准备 PostgreSQL，复制 `.env.example`，设置连接和密钥。注意原迁移脚本直接读 `process.env`，并不保证自动加载 `.env.local`。在 POSIX shell 中，可显式导出环境变量（用自己的值）：
```bash
export DATABASE_URL='postgres://shop:shop@localhost:5432/shop'
export AUTH_SECRET="$(openssl rand -base64 32)"
npm ci
npm run db:setup
npm run dev
```

## 生产部署检查
将迁移与演示 seed 分离。使用密钥管理、HTTPS、数据库备份及恢复演练。限制数据库连接池总量。增加结构化日志、请求关联 ID、健康探针及告警。多副本部署时规划共享缓存和缓存失效机制。使用可回滚的应用发布和向后兼容的数据库迁移。

原项目 Compose 的迁移任务会执行 seed；不要照搬到生产环境。惰性连接只能保证导入不主动连接数据库；如果构建期实际执行查询，仍需要数据库。原项目构建是否成功尚未实测。


---

[上一章：测试策略与工程质量](09-testing.md) · [目录](../index.md) · [下一章：迁移到其他业务与架构检查清单](11-blueprint.md)
