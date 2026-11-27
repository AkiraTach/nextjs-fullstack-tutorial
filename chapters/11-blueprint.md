---
layout: default
title: "11 · 迁移到其他业务与架构检查清单"
---

[返回目录](../index.md)

# 11 · 迁移到其他业务与架构检查清单

## 推荐架构（新增设计，不是原项目目录）
```text
src/
  app/
  features/
    tasks/
      components/
      schemas.ts
      queries.ts
      actions.ts
      service.ts     # 仅当复杂用例需要复用时增加
  server/
    db/
    auth/
    integrations/
  components/ui/
  lib/
    form-state.ts
  proxy.ts
```

## 从需求出发
1. 写出用例、输入、输出和不变量。
2. 定义数据表、约束与访问规则。
3. 实现查询函数和复杂业务用例。
4. 实现 Server Action 或 Route Handler。
5. 组装页面和客户端交互。
6. 定义缓存及其失效策略。
7. 添加测试和部署门禁。

## 通用例子：任务管理
将下单事务替换成任务分配事务。将库存条件替换成任务当前状态或版本号条件。将订单归属替换成项目成员权限。将支付 Webhook 替换成外部自动化任务的回调。底层技术变化不影响这些原则。

## 自查清单
- [ ] app 不重复定义关键业务规则。
- [ ] 客户端不导入服务端数据库模块或密钥。
- [ ] 每个写入口校验输入、身份与对象权限。
- [ ] 数据库约束保护关键不变量。
- [ ] 多表写入使用事务，状态变化使用条件更新。
- [ ] 外部服务有超时、幂等、补偿与恢复机制。
- [ ] 私人数据不进入公共缓存。
- [ ] 测试覆盖并发、失败和越权。
- [ ] 迁移、构建、运行任务分离。
- [ ] 文档、日志和前端均不暴露密钥或个人信息。

## 推荐阅读
以下是官方文档入口（本次未联网核对具体版本页面）：
- [Next.js 文档](https://nextjs.org/docs)
- [React 文档](https://react.dev/)
- [Drizzle ORM 文档](https://orm.drizzle.team/docs/overview)
- [PostgreSQL 文档](https://www.postgresql.org/docs/)
- [Stripe Webhooks](https://docs.stripe.com/webhooks)
- [GitHub Pages 文档](https://docs.github.com/en/pages)


---

[上一章：容器、配置与部署拓扑](10-deployment.md) · [目录](../index.md)
