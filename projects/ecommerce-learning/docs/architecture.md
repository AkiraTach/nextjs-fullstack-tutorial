# 架构与代码阅读指南

## 目录职责

- `src/app`：App Router 路由，Server Components 和健康检查 Route Handler。
- `src/features`：业务模块。`server/actions.ts` 是写入入口，`server/queries.ts` 是读取入口，`domain` 包含不依赖框架的规则。
- `src/workflows`：跨模块事务。place-order 和 change-order-status 是学习重点。
- `src/infrastructure`：PostgreSQL 连接、事务封装和模拟支付适配器。
- `src/shared`：金额格式化。
- `migrations`：数据库约束、索引、种子数据。初始化脚本只在空数据卷执行，不是版本迁移工具。
- `tests`：纯领域规则单元测试。

## 下单流程

页面表单 → Server Action → 身份与输入校验 → Workflow → Transaction → 锁定顾客行 → 查询幂等键 → 按商品 ID 顺序锁定库存行 → 检查库存 → 计算服务端价格 → 创建订单及快照 → 扣减库存 → 记录模拟支付 → 清空购物车 → 写入 outbox → COMMIT → 跳转订单详情。

顾客行锁用于串行化同一顾客的购物车操作与结账。商品行锁用于避免不同顾客并发购买超卖。重复请求使用唯一约束和请求键返回原订单。真实支付不可放入此数据库事务；改为创建待支付订单及库存预留，在事务外调用支付供应商，再由签名 Webhook 幂等确认。

## 订单状态机

```
paid -> shipped -> delivered -> return_requested -> refunded
  |-> cancelled
```

取消和退款在同一事务内恢复库存并更新模拟支付状态。顾客只能操作自己的订单，并且只允许取消与申请退货。管理员权限在页面和写入操作中分别校验。

## Next.js 实践

Server Components 直接访问服务端查询层，不通过 HTTP 调用自身 API。Server Actions 重新认证并校验输入。数据库连接和查询使用 server-only。密码由 PostgreSQL pgcrypto bcrypt 哈希。会话随机令牌只在 cookie 中保存原值，数据库存储哈希。所有用户输入使用参数化 SQL。金额使用整数日元。此项目为便于观察一致性，根布局强制动态渲染，没有引入跨请求缓存。后续为公开商品页面引入缓存时，应隔离用户数据并设计缓存失效策略。

## 后续练习

按业务需求增加 SKU、地址簿、商品 CRUD、订单分页、报价确认、库存预留和过期释放、Stripe 测试模式 Webhook、outbox worker、邮件、Redis、全文检索、税费、Playwright 并发与权限测试、限流与监控。先补集成测试，再改变事务行为。不要为了目录齐全创建无实现的模块。

参考入口（未实时核验）：https://nextjs.org/docs 、https://www.postgresql.org/docs/16/explicit-locking.html 、https://docs.stripe.com/webhooks 、https://cheatsheetseries.owasp.org/ 。
