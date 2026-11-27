# Field Shop — Next.js Full Stack 电商学习项目

单商户 B2C 模块化单体。界面为中文，货币为 JPY。仅供本地学习，不接收真实付款或个人信息。

## 一键运行

安装 Docker Desktop（或 Docker Engine 与 Compose v2），解压后进入包含 compose.yaml 的目录：

```sh
docker compose up --build
```

首次构建需要联网下载 Node、PostgreSQL 镜像及 npm 依赖。后续可以使用 `docker compose up`。访问 http://localhost:3000 。健康检查：http://localhost:3000/api/health 。

| 身份 | 邮箱 | 密码 |
|---|---|---|
| 顾客 | customer@example.test | Customer1234! |
| 管理员 | admin@example.test | Admin1234! |

数据库通过 Docker volume 持久化。停止用 `docker compose down`。**警告：** `docker compose down -v` 会删除全部本地数据，包括订单和用户。删除后重新启动会执行初始化 SQL。

## 学习路径

1. 使用顾客账号登录。浏览商品，搜索、筛选、加入购物车，调整数量。
2. 结账时输入虚构地址和优惠码 LEARN10。创建订单。查看库存与订单快照。
3. 退出并使用管理员账号登录。进入 `/admin`。查看统计，修改价格与库存，发货并标记送达。
4. 使用顾客账号申请退货。使用管理员账号执行退款。验证库存恢复和审计日志。
5. 再创建一个订单。直接取消订单。验证退款和库存恢复。
6. 阅读 `docs/architecture.md`，对照代码理解数据流和边界。

## 测试与调试

```sh
docker compose exec web npm test
docker compose exec web npm run typecheck
docker compose logs -f web
docker compose exec db psql -U shop -d shop
```

数据库中可以查询 products、orders、order_items、payments、audit_logs、outbox。不要手工修改数据来模拟正常业务流程。

## 实现范围与限制

这是核心交易链路的教学实现，不是完整生产商城。采用 Next.js 15 App Router、React 19、TypeScript、Zod、pg 和 PostgreSQL 16。直接 SQL 便于观察事务和行锁，未采用 ORM。样例数据、凭证和模拟支付均是本地演示用途。只绑定本机端口；HTTP 模式的 cookie 不使用 Secure。没有登录限流、邮箱验证、密码重置、真实支付或签名 Webhook、实际物流、税费、多仓、商品 SKU、媒体上传、完整商品 CRUD、库存预留、后台任务、事件投递、Redis、全文搜索、集成/E2E 自动化测试或生产部署配置。outbox 只记录事件，未实现投递。退款默认商品已检查且可重新入库。优惠码在结账提交后才计入最终金额，正式商城需先展示最终报价再要求确认。

依赖使用版本范围，没有经过 npm 安装生成的 lockfile。交付环境没有 Docker 和依赖缓存，未实际执行容器构建、Next.js 类型检查或数据库集成测试。首次启动如有问题请检查构建日志。不要直接部署到公网。

## 代码格式化

项目使用 2 空格缩进，并提供 Prettier 和 EditorConfig 配置。安装依赖后运行：

```bash
npm run format
npm run format:check
```

SQL 文件已手工规则化排版，不由默认 Prettier 处理。
