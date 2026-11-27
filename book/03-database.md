# 第 3 章 数据库建模：Drizzle vs 手写 SQL

## 本章目标

- 对照两种建模方式：项目 A 用 Drizzle 在 TypeScript 里定义 schema 并生成迁移；项目 B 直接写 SQL 建表
- 理解电商数据建模的几个关键决定：金额用整数、订单项存快照、状态用枚举/CHECK、外键的删除策略

## 3.1 同一张 products 表，两种写法

项目 A（`src/server/db/schema.ts`，Drizzle）：

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

项目 B（`migrations/001-init.sql`，手写 SQL）：

```sql
CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  description text NOT NULL,
  category text NOT NULL,
  price integer NOT NULL CHECK(price>=0),
  stock integer NOT NULL CHECK(stock>=0),
  active boolean NOT NULL DEFAULT true,
  icon text NOT NULL DEFAULT '📦'
);
```

两者表达的是同一套约束。差别在工作流：

| | Drizzle（A） | 手写 SQL（B） |
| --- | --- | --- |
| 事实来源 | TS 代码，`drizzle-kit generate` 生成迁移 SQL | SQL 文件本身 |
| 类型 | schema 直接推出 TS 类型（`$inferSelect`），查询全程类型安全 | 查询结果要手写类型，靠自觉对齐 |
| 演进 | 有版本号的迁移链，可增量升级已有数据库 | 只有初始化脚本，已有数据卷不重跑（第 2 章） |
| 学习价值 | 学会工业界主流做法 | 能亲眼看到约束、索引、行锁的 SQL 本体 |

选哪个取决于场景：长期维护的项目用 ORM + 迁移；想吃透 SQL 和事务，手写一遍收获更大。**两个项目都不约而同地把约束下沉到数据库**（UNIQUE、CHECK、NOT NULL），这是重点——应用层校验是给用户看的，数据库约束是最后的防线，两者都要有。

## 3.2 金额：永远用整数

两个项目都用整数存金额：A 用美分（`priceCents`），B 用日元整数（日元本身没有辅币，天然整数）。

原因只有一个：浮点数存钱必出事故。`0.1 + 0.2 !== 0.3` 在任何语言里都成立，金额一旦用 `float/decimal 字符串`之外的浮点类型，迟早在对账时差一分钱。整数方案把问题消灭在建模层：第 4 章会看到，所有金额运算都是整数运算，只在**展示**时才格式化。

## 3.3 订单项存快照：历史不能被现在修改

两个项目的 `order_items` 都存了下单当时的**名称和单价**，而不是只存 product_id 再去关联查询：

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

为什么：商品会改价、改名、甚至下架删除。如果订单只存 product_id，去年 99 元买的东西，今天打开订单详情可能显示成 129 元——账就对不上了。快照让订单成为**自包含的历史事实**。注意外键的 `onDelete: "set null"`：商品删了，订单项还在，只是 productId 变空——配合快照字段，历史订单依然完整可读。这个删除策略是被快照设计「逼」出来的，读 schema 时要连起来看。

## 3.4 状态：枚举与 CHECK

- A 用 PostgreSQL 枚举类型：`order_status = pending / paid / shipped / cancelled`，类型层面杜绝非法值。
- B 用 `text + CHECK(status IN (...))`，多了 `delivered / return_requested / refunded`（因为 B 实现了退货流程）。

枚举的代价是改值要迁移（`ALTER TYPE`），CHECK 灵活些但约束散在表定义里。没有绝对优劣，关键是**非法状态在数据库层就存不进去**。至于「哪些状态之间能互相转换」是业务规则，不归数据库管——那是第 13 章状态机的事。

## 3.5 其他值得注意的建模决定

- **唯一约束做幂等**：B 的 `orders` 表有 `UNIQUE(user_id, request_key)`——同一个用户带着同一个请求键重复提交，数据库只允许一行（第 11 章详解）。A 的 `users.email`、`products.slug` 唯一约束同样是防线：注册时先查后插有竞态，最终靠唯一约束兜底（A 的后台建商品就专门捕获了 PG 的 `23505` 唯一冲突错误码，翻译成「slug 已被使用」的表单错误）。
- **索引只建在真查询上**：A 给 `orders.user_id`、`products.category_id` 建索引，对应「我的订单」「按分类列表」两个真实查询。索引不是越多越好，每个索引都在给写入加税。
- **B 的审计与 outbox 表**：`audit_logs`（谁对什么做了什么）和 `outbox`（待投递的领域事件）都是独立表、只追加。这两张表让 B 的后台操作全程留痕——第 13 章细讲。

## 常见误区

- **「价格用 decimal(10,2) 也行」**：数据库 decimal 本身没错，错的是把它读进 JS 变成 number（浮点）再运算。整数分/整数日元让全链路只有一种表示，最省心。
- **「订单详情页 join 一下 products 就行，要什么快照」**：join 到的是商品的**现在**，订单要的是**当时**。财务数据必须自包含。
- **「约束在代码里校验过了，数据库就不用了」**：并发下两个请求可以同时通过代码校验（都查到「不存在」再都插入）。唯一约束是唯一能防住竞态的那道门。

## 本章练习

1. 在项目 A 里给 `products` 加一个 `brand` 字段：改 schema → `npm run db:generate` → 打开生成的迁移 SQL 看它长什么样 → `npm run db:setup`。
2. 在项目 B 里试着直接用 psql 插入一个 `price = -100` 的商品和一个 `status = 'flying'` 的订单，看数据库怎么拒绝你。
3. 思考题：A 的 `carts` 表用独立的 cart 记录 + cookie 里的 cart id，B 直接把 `user_id` 放进 `cart_items`。两种建模各自的前提是什么（提示：游客能不能加购）？
