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
