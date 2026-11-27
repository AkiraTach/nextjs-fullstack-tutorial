---
layout: default
title: "01 · 架构总览与模块边界"
---

[返回目录](../index.md)

# 01 · 架构总览与模块边界

## 学习目标
理解模块化单体（modular monolith）。一个 Next.js 应用同时提供页面渲染、服务端业务操作和 HTTP 接口。PostgreSQL 独立运行。不要为了分层而拆成多个服务。

## 原项目目录
```text
src/
  app/          # 路由、页面组装、HTTP 入口
  features/     # 业务模块
    auth/
    catalog/
    cart/
    checkout/
    orders/
    admin/
  server/       # 服务端基础设施
    auth/
    db/
    payments/
  components/   # 通用 UI
  lib/          # 通用工具
  proxy.ts      # 请求入口的粗粒度访问控制
drizzle/        # 数据库迁移
scripts/        # 迁移与种子数据任务
tests/unit/     # 单元测试
```

## 依赖方向
```text
浏览器 ──HTTP──> app / Server Actions
                     │
                     ▼
                  features
                     │
                     ▼
                   server ──> PostgreSQL / Stripe
                     │
                     ▼
                     lib
```
这是目标方向，不是源码已强制执行的规则。`app` 中存在直接访问数据库的管理页面；`components/layout/header.tsx` 也依赖业务读取。允许小项目的适度直接访问，但应防止业务规则散落在多个入口。

| 层 | 应负责 | 不应负责 |
|---|---|---|
| app | 路由、参数、页面组合 | 重复实现事务规则 |
| features | 用例、查询、校验、领域组件 | 管理底层连接生命周期 |
| server | 数据库、会话、外部服务适配 | 页面布局 |
| components | 可复用展示与交互 | 隐含业务授权 |
| lib | 无领域归属的工具 | 依赖上层页面 |

## 渐进重构
原项目的 `checkout/actions.ts` 同时处理表单、事务、支付和缓存。规模扩大后，将事务和状态转换移入 `checkout/service.ts`，让 Action 负责入口校验、授权和结果转换。不要预先为每张表建立 Repository、Service、Controller 三套空壳。

`FormState` 位于 `features/auth/schemas.ts`，却被 admin 和 checkout 使用。将通用表单状态移到共享模块可以减少不必要的领域耦合。`admin` 更像操作入口，而非独立核心领域；逐步将订单规则归入 orders。

## 练习
画出一个任务管理系统的同类架构。将 catalog 换成 projects，将 checkout 换成 task-assignment。保持基础设施与业务模块的边界不变。检查是否有 `server` 反向依赖 `app`。


---

[目录](../index.md) · [下一章：App Router 与渲染边界](02-routing.md)
