# 导读：这本教程是什么

这本教程用**两个完整的 Next.js 电商项目**教你全栈开发的最佳实践。两个项目实现的是同一个东西——一个能下单、能付款、能发货的单商户网店——但技术路线不同。对照着读，你学到的不是某个框架的 API，而是**每个技术决策背后的取舍**。

| | 项目 A：NextShop | 项目 B：Field Shop |
| --- | --- | --- |
| 源码目录 | `projects/nextjs-shop/` | `projects/ecommerce-learning/` |
| Next.js | 16（App Router） | 15（App Router） |
| 数据库访问 | Drizzle ORM | 手写 SQL（`pg` 驱动） |
| 数据库 | PostgreSQL 17 | PostgreSQL 16 |
| 会话 | JWT（jose 签名，无状态） | 不透明令牌 + 数据库会话表 |
| 密码哈希 | bcryptjs（应用层） | pgcrypto（数据库层） |
| 支付 | Stripe Checkout + Webhook（可选），无密钥时模拟支付 | 模拟支付（事务内） |
| 金额单位 | 美分（整数） | 日元（整数） |
| 购物车 | 游客购物车 + 登录后合并 | 仅登录用户，靠行锁串行化 |
| 测试 | Vitest | Node 内置 test runner |
| 特色 | 缓存与失效、SEO、游客结账 | 领域层、订单状态机、审计日志、outbox、幂等键 |

## 怎么用这本教程

1. **先把两个项目都跑起来**（下一节），用演示账号把购物流程各走一遍：浏览 → 加购 → 结账 → 后台发货 → 退货/取消。
2. **按章节顺序读**。每章的结构是：要解决的问题 → 看哪段代码 → 代码为什么这样写 → 两套实现的对照 → 常见误区 → 练习。
3. **练习一定要做**。每章末尾的练习都是在真实代码上动手改，改完跑测试验证。

## 运行项目

两个项目都只需要 Docker（含 Docker Compose），在各自目录执行：

```bash
docker compose up --build
```

首次构建要几分钟（拉镜像、装依赖、建表、灌演示数据）。完成后打开 http://localhost:3000 。

项目 A 演示账号：

| 账号 | 密码 | 角色 |
| --- | --- | --- |
| admin@example.com | admin123 | 管理员（可进 /admin） |
| demo@example.com | demo1234 | 顾客 |

项目 B 演示账号：

| 账号 | 密码 | 角色 |
| --- | --- | --- |
| admin@example.test | Admin1234! | 管理员 |
| customer@example.test | Customer1234! | 顾客 |

项目 B 的推荐体验路径（来自它自己的 README）：顾客登录 → 用优惠码 `LEARN10` 下单 → 管理员发货、送达 → 顾客申请退货 → 管理员退款 → 观察库存恢复和审计日志。

停止：`Ctrl+C`；连数据一起清掉重来：`docker compose down -v`（注意：`-v` 会删掉数据库 volume，不可恢复）。

## 阅读约定

- 代码块上方会标注文件路径，路径以项目根目录为起点，例如 `src/features/checkout/actions.ts`。
- 教程里出现的代码是**节选**，完整代码请对照仓库里的 `projects/` 目录看。
- 「项目 A」指 NextShop（nextjs-shop），「项目 B」指 Field Shop（ecommerce-learning）。

## 本章练习

1. 把两个项目都跑起来，分别用顾客账号完成一次下单。
2. 在项目 B 里用管理员把你刚下的订单发货，再用顾客申请退货、管理员退款，观察订单状态的变化顺序，把顺序写下来——第 13 章会用到。
3. 找到两个项目的目录结构图（各自 README 里有），说出它们最大的一个结构差异。
