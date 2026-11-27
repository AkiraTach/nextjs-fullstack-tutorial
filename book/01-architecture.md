# 第 1 章 全栈架构总览：模块化单体与分层

## 本章目标

- 理解为什么参考实现选「模块化单体」：一个进程，但按业务切模块
- 看懂四层结构：路由层 → 业务层 → 领域层 → 基础设施层，以及依赖只能向下的规则
- 理解 `server-only`、读写分离（queries / actions）这些约束如何被工具守住，而不是靠自觉

## 1.1 先说结论：单体，但按业务切模块

参考实现是一个单体应用：一个仓库、一个进程、一个数据库。但内部不是按技术类型堆文件夹（controllers/、models/、utils/），而是**按业务领域切模块**：auth、catalog、cart、checkout、orders……每个模块把自己的组件、查询、写入动作、校验 schema 放在一起，将来要拆分或重构时，接缝就在模块边界上。

```
src/
├── app/          # 路由层：只负责路由与页面组装
├── features/     # 业务层：按领域拆分（组件 + 查询 + Actions + 校验）
│   ├── auth/  catalog/  cart/  checkout/  orders/  admin/
├── server/       # 基础设施层：db/ auth/ payments/（只提供能力，不懂业务）
├── components/   # 通用 UI（Header、Footer、表单控件）
├── lib/          # 跨领域的纯工具：金额、环境变量
└── proxy.ts      # 访问控制的第一道门（第 7 章）
```

每个 feature 内部再分工：

- `queries.ts`：只读查询，页面调用；
- `actions.ts`：Server Actions，只负责写入；
- `schemas.ts`：该领域的输入校验规则；
- `domain/`（在规则复杂的领域里）：不依赖框架的纯业务规则，如定价计算、订单状态机（第 4 章）；
- 跨领域的复杂流程（如订单状态变更牵动库存、支付、审计）收口到一个 service / workflow 函数，多个入口共用一个实现（第 13 章）。

## 1.2 依赖方向：只能向下，不能反弹

分层真正的价值在依赖方向：

```
app（页面） → features（业务） → domain（纯规则） / server（基础设施） → 数据库 / 外部服务
```

- features 可以 import server（结账 action 要用 `db`）。
- server **不可以** import features（数据库连接不该知道购物车长什么样）。
- domain **不 import 任何东西**：不依赖 Next、不依赖数据库。给同样的输入永远同样的输出，所以能脱离框架被单元测试直接覆盖（第 14 章）。把最容易出错的规则（算钱、状态流转）放在这一层，是整个架构里性价比最高的一个决定。

有个细节体现了对运行环境的自觉：会话代码被拆成两个文件。纯令牌运算在 `src/server/auth/token.ts`：

```ts
// src/server/auth/token.ts
// 不依赖 next/headers 与 server-only，所以 proxy.ts 和 Server Actions 都能共用。
export const SESSION_COOKIE = "session";
export async function signSession(payload: SessionPayload): Promise<string> { /* … */ }
export async function verifySession(token: string | undefined): Promise<SessionPayload | null> { /* … */ }
```

而依赖 `cookies()` 的读写部分单独放在 `session.ts`。原因：proxy（原 middleware）的运行环境与页面/Action 不同，把「纯运算」和「读写 cookie」拆开，两个环境就都能用。**文件拆分不是为了好看，是被约束逼出来的**——读任何代码时看到奇怪的拆分，先去找它背后的环境约束。

## 1.3 `server-only`：用构建报错守住边界

所有只应在服务端运行的模块，顶部都有一行：

```ts
import "server-only";
```

一旦这个文件被误 import 进客户端组件，**构建直接报错**，而不是等到线上泄漏数据库连接串才发现。靠自觉守边界迟早失守，靠构建报错不会。

注意一个例外：`src/server/db/schema.ts` 故意**不加** `server-only`，文件里写明了理由——drizzle-kit 和迁移脚本要在 Next 之外加载它。规则都有适用范围，例外要把理由写在原地。

## 1.4 读写分离：queries 只读，actions 只写

读路径和写路径的安全要求完全不同：

- 写路径：每次都要重新验身份、验输入、防重复提交（第 7、8、11 章）。
- 读路径：要考虑缓存与失效（第 5 章）。

把它们分成两个文件，这两类问题就不会互相污染。页面（Server Component）只 import queries；表单只指向 actions。这个约定简单到近乎无聊，但它让「某个页面会不会偷偷写库」这种问题一眼可查。

## 常见误区

- **「分层就是多建几个文件夹」**：分层的核心是依赖方向和「每条业务规则只有一个落点」，不是文件夹数量。业务逻辑写进页面组件，目录再漂亮也是假分层。
- **「单体 = 落后，微服务 = 先进」**：在这个规模下，微服务只会把函数调用变成网络调用 + 分布式事务，收益为零。模块化单体保留了拆分的接缝，是这个阶段的正确选择。
- **「app/ 里写点逻辑没关系，反正能跑」**：页面里写业务规则，第二个入口（后台、API、定时任务）出现时就得复制一份，规则从此有两份且必然漂移。

## 本章练习

1. 追踪一次「加入购物车」：从页面表单开始，依次找到 action、查询、数据库表，写出完整调用链，并标出每一跳跨越了哪一层。
2. 全仓搜索 `from "@/server` 与 `from "@/features` 的 import，验证不存在 server → features 的反向依赖。
3. 故意把某个 `queries.ts` import 进一个带 `"use client"` 的组件，跑 `npm run build`，看 `server-only` 报什么错。改完还原。
