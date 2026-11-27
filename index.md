---
layout: default
title: Next.js 全栈开发最佳实践
---

# Next.js 全栈开发最佳实践

从项目架构到工程化部署 · 基于 NextShop 源码的学习教程

本教程面向希望掌握全栈架构的开发者。商城是案例，不是课程目标。建议先掌握 JavaScript、TypeScript、React 和基础 SQL。

**版本基线：** 上传项目的 package.json 声明 Next.js ^16.4.6、React ^19.3.1、Drizzle ORM ^0.45.4、Zod ^4.6.7；Compose 使用 PostgreSQL 17。版本号来自源码声明，未联网验证发布状态或兼容性。

**阅读约定：** “原项目”指上传压缩包；标明“改进”“推荐”或“练习”的内容属于扩展设计。代码片段来自原项目或明确标注为示意。未安装依赖、运行测试或部署，结论来自静态代码阅读。

## 学习路线

1. [架构总览与模块边界](chapters/01-architecture.md)
2. [App Router 与渲染边界](chapters/02-routing.md)
3. [数据访问与数据库设计](chapters/03-data.md)
4. [Server Actions、输入校验与错误处理](chapters/04-actions.md)
5. [身份认证、授权与安全边界](chapters/05-auth.md)
6. [缓存、失效与数据新鲜度](chapters/06-cache.md)
7. [事务、并发与幂等](chapters/07-transactions.md)
8. [外部服务、Webhook 与一致性](chapters/08-integrations.md)
9. [测试策略与工程质量](chapters/09-testing.md)
10. [容器、配置与部署拓扑](chapters/10-deployment.md)
11. [迁移到其他业务与架构检查清单](chapters/11-blueprint.md)


## 如何使用

先阅读架构章，再在本地打开原项目，按章节中的源码路径定位文件。完成每章练习后，将设计原则迁移到自己的项目。

本教程独立于全栈示例。GitHub Pages 只托管教程，不运行数据库或服务端代码。
