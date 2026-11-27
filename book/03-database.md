# 第 3 章 数据层设计：建模、约束与迁移

## 本章目标

- 看懂用 Drizzle 在 TypeScript 里定义 schema 并生成迁移的工作流
- 理解数据建模的四个关键决定：金额用整数、快照字段、状态枚举、外键删除策略
- 理解为什么约束必须下沉到数据库，而不能只靠应用层校验

## 3.1 schema 即事实来源

参考实现的表结构定义在 `src/server/db/schema.ts`，以 products 表为例：

```ts
export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    // 金额一律用"分"存储，避免浮点误差
    priceCents: integer("price_cents").notNull(),
    stock: integer("stock").notNull().default(0),
    imageUrl: text("image_url"),
    featured: boolean("featured").notNull().default(false),
    active: boolean("active").notNull().default(true),
    categoryId: integer("category_id").references(() => categories.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("products_category_idx").on(t.categoryId)],
);
```

工作流是：改这份 TS 定义 → `npm run db:generate` 生成带版本号的 SQL 迁移 → 迁移在部署时独立执行（第 2 章）。收益有三层：

- **类型贯通**：schema 直接推出 TS 类型（`typeof products.$inferSelect`），查询、表单、页面全程类型安全，改个字段名全仓报错提醒你。
- **可演进**：迁移链有顺序、有历史，已有数据库可以增量升级，而不是推倒重来。
- **约束可见**：UNIQUE、NOT NULL、默认值、索引都写在定义里，读 schema 就是读数据契约。

手写 SQL 建表当然也能表达同一套约束（`CHECK(price>=0)` 这类甚至更直接）。两条路线的差别不在表达能力，在**长期演进与类型安全**：项目一旦要活过几个月，迁移链 + 类型贯通的价值会迅速超过手写 SQL 的直白。

## 3.2 金额：永远用最小单位整数

金额用整数存最小货币单位：美元存分（`priceCents`），日元本身没有辅币就直接存整数日元。

原因只有一个：浮点数存钱必出事故。`0.1 + 0.2 !== 0.3` 在任何语言里都成立，金额一旦用浮点，迟早在对账时差一分钱。整数方案把问题消灭在建模层：第 4 章会看到，所有金额运算都是整数运算，只在**展示**时才格式化。

## 3.3 快照：历史数据必须自包含

订单项（order_items）存了下单当时的**名称和单价快照**，而不是只存 product_id 再关联查询：

```ts
export const orderItems = pgTable("order_items", {
  // …
  productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
  // 下单时的快照：之后商品改名/改价不影响历史订单
  name: text("name").notNull(),
  unitPriceCents: integer("unit_price_cents").notNull(),
  quantity: integer("quantity").notNull(),
});
```

商品会改价、改名、甚至被删除。如果订单只存 product_id，去年 99 元买的东西，今天打开订单详情可能显示成 129 元——账就对不上了。快照让订单成为**自包含的历史事实**。注意外键的 `onDelete: "set null"` 与快照是配套的：商品删了，订单项还在、名称价格都在，只是 productId 变空。读 schema 时要把这两处连起来看。

这条原则不限于电商：任何「记录某时某刻的事实」的数据（账单、审批、报价）都要存快照，而不是实时关联「现在的样子」。

## 3.4 状态与约束：非法值在数据库层就存不进去

订单状态用 PostgreSQL 枚举类型：

```ts
export const orderStatusEnum = pgEnum("order_status", [
  "pending",   // 已下单，等待支付（库存已预留）
  "paid",      // 已支付
  "shipped",   // 已发货
  "cancelled", // 已取消（库存已归还）
]);
```

枚举的代价是增删值要迁移（`ALTER TYPE`），换来的是类型层面杜绝非法状态。用 `text + CHECK(status IN (...))` 也能达到同样效果、更灵活——选哪个不重要，重要的是**非法状态在数据库层就存不进去**。至于「哪些状态之间能互相转换」是业务规则，不归数据库管，那是第 4 章状态机和第 13 章流程编排的事。

其他约束同样下沉：

- **唯一约束做幂等与防重**：`users.email`、`products.slug` 唯一。注册时「先查后插」在并发下有竞态（两个请求都查到不存在、都插入），最终靠唯一约束兜底。参考实现的后台建商品就专门捕获了 PostgreSQL 的 `23505` 唯一冲突错误码，翻译成「slug 已被使用」的表单错误给用户看——数据库约束与用户体验在这里接上了（第 8 章）。
- **索引只建在真查询上**：`orders.user_id`（我的订单）、`products.category_id`（按分类列表）。索引不是越多越好，每个索引都在给写入加税。
- **数量与金额的 CHECK**：库存、数量、金额这类字段加上 `>= 0` 一类检查，让脏数据在写入瞬间就被拒绝，而不是等对账时才发现。

## 常见误区

- **「价格用 decimal(10,2) 也行」**：数据库 decimal 本身没错，错的是把它读进 JS 变成 number（浮点）再运算。最小单位整数让全链路只有一种表示，最省心。
- **「详情页 join 一下主表就行，要什么快照」**：join 到的是数据的**现在**，历史记录要的是**当时**。财务类数据必须自包含。
- **「约束在代码里校验过了，数据库就不用了」**：并发下两个请求可以同时通过代码校验。唯一约束是唯一能防住竞态的那道门。应用校验是给用户看的，数据库约束是最后的防线，两者都要有。

## 本章练习

1. 给 `products` 加一个 `brand` 字段：改 schema → `npm run db:generate` → 打开生成的迁移 SQL 看它长什么样 → 执行迁移。
2. 用 psql 直接往数据库里插一个负数库存的商品、一个状态为 `flying` 的订单，看数据库怎么拒绝你，并指出各自是哪条约束在起作用。
3. 思考题：`carts` 表把游客购物车（userId 为空）和用户购物车放在同一张表，靠 cookie 里的 cart id 认领游客车。这个建模的前提是什么？如果业务改成「必须登录才能加购」，表结构可以怎么简化？
