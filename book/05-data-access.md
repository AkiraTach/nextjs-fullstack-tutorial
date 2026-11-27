# 第 5 章 数据访问层：查询、参数化与缓存

## 本章目标

- 理解 queries / actions 分离后，读路径要解决的三个问题：防注入、只取所需列、缓存
- 看懂项目 A 的 `unstable_cache` + tag 失效策略
- 理解项目 B 为什么刻意不用缓存——以及它的代价与前提

## 5.1 参数化查询：防注入是默认动作

项目 B 全程手写 SQL，但你找不到一处字符串拼接用户输入：

```ts
// src/features/catalog/server/queries.ts（项目 B）
export async function products(q = '', category = '') {
  return (await db.query<Product>(
    "SELECT * FROM products WHERE active AND (name ILIKE '%'||$1||'%' OR description ILIKE '%'||$1||'%') AND ($2='' OR category=$2) ORDER BY name",
    [q, category],
  )).rows;
}
```

用户输入永远走 `$1、$2` 占位符，由驱动作为**数据**发送，而不是拼进 SQL 文本当**代码**执行。这是防 SQL 注入的唯一正确姿势：不是「过滤危险字符」，而是从机制上让输入没有机会变成代码。

项目 A 用 Drizzle，参数化是默认行为，但它还多做了一层——搜索关键词里的 LIKE 通配符转义（`src/features/catalog/queries.ts`）：

```ts
if (q) {
  // % 与 _ 是 LIKE 的通配符，用户输入里出现时需要转义
  const pattern = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
  conditions.push(or(ilike(products.name, pattern), ilike(products.description, pattern))!);
}
```

参数化防的是「注入 SQL」，但防不了用户输入 `%` 把搜索变成全表匹配——这是**语义层**的注入，同样要处理。两层都做，才算完整。

## 5.2 只取所需列

A 的商品列表查询定义了一个 `productCard` 列集合，只查卡片要显示的六个字段，而不是 `SELECT *`：

```ts
const productCard = {
  id: products.id, slug: products.slug, name: products.name,
  priceCents: products.priceCents, stock: products.stock, imageUrl: products.imageUrl,
};
```

好处：少传数据、查询意图一目了然、表加了大字段（比如长描述）也不会拖慢列表。B 的教学项目用了 `SELECT *`——在学习场景下能少写代码看清结构，但你要能说出它的代价。这正是两个项目对照的价值：**一个示范生产习惯，一个示范教学取舍**。

## 5.3 缓存：A 的 tag 失效策略

公开商品数据是典型的「读多写少」：成千上万次浏览 vs 偶尔一次后台改价。A 的做法是把目录查询全部包上 `unstable_cache` 并打同一个 tag：

```ts
export const CATALOG_TAG = "catalog";

export const getFeaturedProducts = unstable_cache(
  async () => db.select(productCard).from(products)
    .where(and(eq(products.active, true), eq(products.featured, true)))
    .orderBy(desc(products.createdAt)).limit(4),
  ["featured-products"],
  { tags: [CATALOG_TAG], revalidate: 60 },
);
```

配套的失效动作分布在所有会改动目录数据的地方：

- 后台新建/修改商品后：`revalidateTag(CATALOG_TAG, "max")`（立即失效，不等过期）。
- 结账扣库存后：同样失效——库存也是目录数据的一部分，忘了这里，商品页就会显示过期库存。
- Stripe 回调取消订单退库存后：webhook 里也做了同样的失效。

这套策略的关键不在 API，而在**纪律：每一处写目录数据的代码，都要记得让缓存失效**。漏一处，bug 就是「后台改了价，前台半天不变」。所以 A 把 tag 常量集中定义在一个文件、所有写路径都从那里 import——用代码结构提醒你别漏。

注意参数也是缓存键的一部分：`listProducts({q, category, sort, page})` 的每种参数组合各有一份缓存，搜索词很多时缓存条目会膨胀——`revalidate: 60` 的短过期就是对这个风险的对冲。

## 5.4 B 为什么不用缓存

项目 B 的根布局强制动态渲染，每个请求都实时查库。它的架构文档把理由写明了：**为了便于观察一致性**（下单后立刻能看到库存变化，不被缓存干扰教学），并指出将来引入缓存时的前提：隔离用户数据（购物车、订单绝不能进共享缓存）、设计好失效策略。

这是一个重要的判断框架：**缓存只适用于「公开的、与用户无关的」数据**。把用户相关数据放进共享缓存，轻则串数据（A 看到 B 的购物车），重则泄漏。A 的缓存函数里只有商品目录，没有任何用户数据——这条边界比缓存 API 本身更重要。

## 常见误区

- **「用了 ORM 就不会有注入」**：ORM 的原生 SQL 逃生舱（`sql` 模板、`.execute(raw)`）用错了照样注入；LIKE 通配符这类语义注入 ORM 更不管。
- **「缓存就是给函数包一层」**：缓存的难点从来不是「存」，是「失效」。写不出完整的失效点清单，就不要上缓存。
- **「缓存时间设长点更省资源」**：过期时间是正确性与性能的交换。A 对目录用 60 秒 + 主动失效，而不是图省事设一小时——主动失效在，过期只是兜底。

## 本章练习

1. 在项目 A 里用后台改一个商品的价格，不刷新数据库，观察前台商品页多久内变化；然后把 `revalidateTag` 那行临时注释掉再改一次，对比差别（改完还原）。
2. 给项目 B 的商品列表查询加上分页（LIMIT/OFFSET + 总数），注意参数也要走占位符。
3. 思考题：A 的 `listProducts` 把搜索词也纳入缓存键。如果有人用一万个不同的搜索词刷接口，会发生什么？现有的哪个设置在缓解这个问题？
