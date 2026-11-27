# 第 1 章 架构总览：模块化单体与分层

## 本章目标

- 理解为什么两个项目都选了「模块化单体」，而不是微服务或一锅烩
- 看懂两套目录结构背后的同一条分层原则：**路由 → 业务模块 → 基础设施**
- 理解 `server-only`、读写分离（queries / actions）这些约束是怎么 enforced 的

## 1.1 先说结论：单体，但按业务切模块

两个项目都是单体应用：一个仓库、一个进程、一个数据库。但内部不是按「技术类型」堆文件夹（controllers/、models/、utils/），而是**按业务领域切模块**：auth、catalog、cart、checkout、orders……每个模块把自己的组件、查询、写入动作、校验 schema 放在一起。

项目 A 的结构（`projects/nextjs-shop/`）：

```
src/
├── app/          # 只负责路由与页面组装
├── features/     # 按业务领域拆分：auth/ catalog/ cart/ checkout/ orders/ admin/
├── server/       # 仅服务端基础设施：db/ auth/ payments/
├── components/   # 通用 UI（Header、Footer、表单控件）
├── lib/          # 金额、环境变量、工具函数
└── proxy.ts      # 访问控制的第一道门
```

项目 B 多了一层 `workflows/` 和 `domain/`：

```
src/
├── app/            # 路由与 Server Components
├── features/       # 业务模块：server/actions.ts 写、server/queries.ts 读、domain/ 纯规则
├── workflows/      # 跨模块事务：place-order、change-order-status
├── infrastructure/ # 数据库连接、事务封装、支付适配器
└── shared/         # 金额格式化等共享小工具
```

差异只是粒度，原则相同：

- **app/ 只做组装**：页面组件从 features 里取数据、拼 UI，不写业务逻辑。
- **业务规则只出现在 features / workflows 里**：比如「库存不够不能下单」这条规则，只有一个地方实现。
- **infrastructure / server 只提供能力**：连数据库、发支付请求、签 JWT——它们不懂「订单」是什么。

## 1.2 依赖方向：只能向下，不能反弹

分层真正的价值在依赖方向：

```
app（页面） → features（业务） → server / infrastructure（基础设施） → 数据库 / 外部服务
```

- features 可以 import server（比如 checkout 的 action 要用 `db`）。
- server **不可以** import features（数据库连接不该知道购物车长什么样）。
- 项目 B 更进一步：`domain/` 里的纯规则（算总价、订单状态机）**不 import 任何东西**——不依赖 Next、不依赖数据库，所以能脱离框架单测（第 14 章）。

项目 A 里有个细节体现了对依赖方向的自觉：会话代码被拆成两个文件（`src/server/auth/token.ts`）：

```ts
// src/server/auth/token.ts
// 不依赖 next/headers 与 server-only，所以 proxy.ts 和 Server Actions 都能共用。
export const SESSION_COOKIE = "session";
export async function signSession(payload: SessionPayload): Promise<string> { /* … */ }
export async function verifySession(token: string | undefined): Promise<SessionPayload | null> { /* … */ }
```

而依赖 `cookies()` 的部分单独放在 `session.ts`。原因：proxy（原 middleware）运行环境里没有 `next/headers` 的完整能力，把「纯令牌运算」和「读写 cookie」拆开，两个环境就都能用。**文件拆分不是为了好看，是被运行环境逼出来的**——读代码时看到奇怪的拆分，先找环境约束。

## 1.3 `server-only`：用工具守住边界

两个项目里，所有只应在服务端运行的模块顶部都有一行：

```ts
import "server-only";
```

它的作用是：一旦这个文件被误 import 进客户端组件，**构建直接报错**，而不是等到线上泄漏数据库连接串才发现。靠自觉守边界迟早失守，靠构建报错不会。

注意一个例外：项目 A 的 `src/server/db/schema.ts` 顶部有注释说明它**故意不加** `server-only`——因为 drizzle-kit 和迁移脚本要在 Next 之外加载它。这告诉我们：规则都有适用范围，例外要写明理由。

## 1.4 读写分离：queries.ts 只读，actions.ts 只写

两个项目不约而同地用了同一个约定：

- `queries.ts`：只读查询，页面（Server Component）调用。
- `actions.ts`：Server Actions，只负责写入（下单、改状态、加购物车）。

好处不只是整齐。读路径和写路径的**安全要求不同**：写路径每次都要重新验身份、验输入（第 7、8 章）；读路径则要考虑缓存（第 5 章）。分成两个文件，这两类问题就不会互相污染。

## 常见误区

- **「分层就是多建几个文件夹」**：分层的核心是依赖方向和规则的唯一落点，不是文件夹数量。把业务逻辑写进页面组件，再漂亮的目录也是假分层。
- **「单体 = 落后，微服务 = 先进」**：这两个项目的规模下，微服务只会把「函数调用」变成「网络调用 + 分布式事务」，收益为零。模块化单体保留了将来拆分的接缝（模块边界），是这个阶段的正确选择。
- **「app/ 里写点逻辑没关系，反正能跑」**：页面里写业务规则，第二个入口（比如后台、API）出现时就得复制一份，规则从此有两份且必然漂移。

## 本章练习

1. 在项目 B 里追踪一次「加入购物车」：从页面表单开始，依次找到 action、事务封装、SQL，写出调用链。
2. 找出项目 A 中 `server/` 反向 import `features/` 的地方——提示：有一处看似反向（orders/service 被 checkout 调用属于 features→features）；真正的 server→features 应该一处都没有，验证一下。
3. 故意把项目 A 的某个 `queries.ts` import 进一个客户端组件（加 `"use client"` 的文件），跑 `npm run build`，看 `server-only` 报什么错。改完记得还原。
