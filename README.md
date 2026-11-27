# Next.js 全栈最佳实践教程

一本讲 **Next.js 全栈架构**的教程：分层、配置、数据建模、领域规则、认证、访问控制、事务与并发、外部服务集成、流程编排、测试与部署。贯穿一个完整的参考实现，商城只是载体——每章的方法都可迁移到任何全栈项目。

**在线阅读：https://akiratach.github.io/nextjs-fullstack-tutorial/**

## 内容

导读 + 16 章：

1. 全栈架构总览：分层与依赖方向
2. 配置、环境与运行编排
3. 数据层设计：建模、约束与迁移
4. 领域层：把业务规则写成纯函数
5. 数据访问层：查询、参数化与缓存
6. 认证与会话
7. 访问控制：两道门与越权防护
8. 表单、Server Actions 与校验
9. 页面渲染与数据获取
10. 客户端状态与服务端状态：购物车
11. 事务与并发控制
12. 与外部服务集成：支付与 Webhook
13. 业务流程编排：状态机、审计与事件
14. 测试策略
15. 部署与运维
16. 全栈架构清单与进阶路线

每章含关键代码节选、设计理由、常见误区与动手练习。Markdown 源稿在 `book/`。

## 参考实现

`project/` 目录是一个可直接运行的全栈应用：Next.js 16 · PostgreSQL 17 · Drizzle ORM · JWT 会话 · Stripe（可选，无密钥时自动降级模拟支付）。

```bash
cd project
docker compose up --build   # 打开 http://localhost:3000
```

| 账号 | 密码 | 角色 |
| --- | --- | --- |
| admin@example.com | admin123 | 管理员 |
| demo@example.com | demo1234 | 顾客 |

## 本地重建站点

```bash
python3 -m venv .venv && .venv/bin/pip install markdown
.venv/bin/python build.py   # 输出到 site/，把 site/ 的内容同步到仓库根目录即可
```
