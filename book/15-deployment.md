# 第 15 章 部署：产物、迁移与上线清单

## 本章目标

- 看懂项目 A 的多阶段 Dockerfile 与 standalone 产物
- 理解「迁移与运行分离」在部署时如何落地（呼应第 2 章）
- 拿着两个项目自带的清单，学会给任何项目列「上线前还差什么」

## 15.1 多阶段构建：镜像里只留运行时需要的东西

项目 A 的 Dockerfile 有四个阶段：

```dockerfile
FROM node:22-slim AS base
# deps：npm ci 装全部依赖（含 dev，用于构建与迁移）
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# builder：构建 Next.js
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# tools：迁移+种子的一次性镜像（第 2 章的 migrate 服务用它）
FROM base AS tools
# …只带 drizzle/、scripts/、schema
CMD ["npm", "run", "db:setup"]

# runner：最终运行时镜像
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

要点逐个拆：

- **standalone 产物**：`next.config.ts` 里开了 `output: "standalone"`，构建会生成一个自带最小依赖的 `server.js`。runner 阶段只拷它和静态资源，不拷整个 `node_modules`——镜像小一个数量级，攻击面也小。
- **非 root 运行**：建了 `nextjs` 用户并 `USER nextjs`。容器逃逸或应用被攻破时，非 root 能显著降低伤害。这是零成本的安全习惯。
- **构建期无密钥、无数据库**：builder 阶段不需要任何生产环境变量（第 2 章的 env 设计在这里兑现）；数据库连接发生在运行时。
- **tools 阶段单独成镜像**：迁移工具链（含 tsx、drizzle 目录）只在一次性的 migrate 容器里出现，不进运行时镜像。

对照项目 B 的 Dockerfile：单阶段、`npm install` 后直接 build、root 运行、`npm start`。作为教学项目它够用了，但你要能逐条说出它与 A 的差距对应什么风险——这正是本章练习 1。

## 15.2 部署拓扑：谁先谁后

A 的 compose 把顺序写死了（第 2 章）：db 健康 → migrate 成功 → web 启动。把它翻译成任何部署平台（Kubernetes、VPS 脚本、PaaS）都成立的原则：

1. 数据库就绪；
2. 迁移作为**独立步骤**执行一次，失败就中止发布，旧版本继续服务（注意：迁移要尽量向后兼容，让新旧版本都能在新表结构上跑，这叫 expand-contract，是另一个大话题）；
3. 新版本才接流量。

B 的健康检查接口值得单独提（`src/app/api/health/route.ts`）：

```ts
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    await db.query('SELECT 1');
    return Response.json({ status: 'ok' });
  } catch {
    return Response.json({ status: 'unavailable' }, { status: 503 });
  }
}
```

健康检查要查「真依赖」而不是只回一个写死的 ok：进程活着但数据库连不上时，返回 503 让负载均衡/编排系统别再往这台送流量。`force-dynamic` 保证每次都真查、不被缓存。

## 15.3 上线清单：两个项目自己写的作业

难得的是，两个项目都在 README 里诚实地列了「这只是学习项目，上线前还需要」。合并去重后是一份很好的通用清单：

**安全与账号**
- [ ] `AUTH_SECRET` 换成随机长密钥；演示账号密码全部更换
- [ ] 全站 HTTPS（并确认 Secure cookie 已开启）
- [ ] 登录限流 / 防暴力破解（两个项目都缺）
- [ ] 邮箱验证、找回密码（都缺）
- [ ] 会话撤销能力（A 的 JWT 方案要注意第 6 章的取舍）

**业务完整性**
- [ ] 未支付订单的超时清理：A 靠 Stripe 的 expired 事件，模拟支付无超时；B 无预留过期机制
- [ ] outbox 投递器（B 只记录未投递）、邮件通知
- [ ] 运费、税费、优惠券的正式报价流程（B 的优惠在提交后才计入最终金额，README 明说了这点不合规）

**工程化**
- [ ] E2E 测试、监控与告警、备份与恢复演练
- [ ] 图片上传走对象存储（S3/R2），而不是外链图床
- [ ] 搜索升级（全文检索）、商品变体（SKU）等业务扩展

学会这种「诚实清单」的写法本身就是收获：**交付时说清边界，比假装完整更专业**。你以后每做一个项目，都该在 README 里留这样一节。

## 常见误区

- **「能在本地跑就能上线」**：本地跑通验证的是功能；上线还要过安全、密钥、HTTPS、备份、监控这一整套非功能清单。
- **「Dockerfile 把源码全拷进去最省事」**：镜像里多余的东西都是攻击面和体积。分阶段构建的麻烦只有一次，收益一直在。
- **「健康检查回 200 就行」**：回写死 200 的健康检查只证明进程没死，证明不了服务可用。查一下真依赖，成本一行 SQL。

## 本章练习

1. 逐条对照，把项目 B 的 Dockerfile 改成多阶段 + 非 root + standalone，构建并运行验证行为不变。
2. 给项目 A 写一份你自己的上线清单：通读它的 README 清单后，找出一条它没列但你认为该有的（提示：想想日志里现在有什么、缺什么）。
3. 思考题：为什么迁移要「向后兼容」？设想 products 表要把 `priceCents` 改名，新旧两个版本的 web 同时在线（滚动发布中）会发生什么？
