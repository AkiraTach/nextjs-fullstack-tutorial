# 第 5 章 数据访问层：查询、参数化与缓存

## 本章目标

- 理解读路径要解决的三个问题：防注入、只取所需列、缓存与失效
- 看懂 `unstable_cache` + tag 的失效策略，以及它的纪律要求
- 理解缓存的适用边界：只有公开的、与用户无关的数据才能进共享缓存

## 5.1 参数化：防注入是机制，不是过滤

无论用 ORM 还是手写 SQL，用户输入永远作为**参数**传给驱动，而不是拼进语句文本。用 Drizzle 时参数化是默认行为：

```ts
// src/features/catalog/queries.ts（节选）
const [row] = await db.select().from(products)
  .where(and(eq(products.slug, slug), eq(products.active, true)))
  .limit(1);
```

手写 SQL 时则坚持占位符（`WHERE slug = $1`），由驱动把输入当数据发送。防注入的正确姿势从来不是「过滤危险字符」，而是让输入在机制上没有机会变成代码。

还有一层参数化防不了的**语义注入**：LIKE 通配符。参考实现对搜索关键词做了转义：

```ts
if (q) {
  // % 与 _ 是 LIKE 的通配符，用户输入里出现时需要转义
  const pattern = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
  conditions.push(or(ilike(products.name, pattern), ilike(products.description, pattern))!);
}
```

参数化防「注入 SQL」，转义防「用户输入 % 把搜索变成全表匹配」。两层都做，才算完整。

## 5.2 只取所需列

列表查询定义了明确的列集合，只查界面要显示的字段，而不是 `SELECT *`：

```ts
const productCard = {
  id: products.id, slug: products.slug, name: products.name,
  priceCents: products.priceCents, stock: products.stock, imageUrl: products.imageUrl,
};
```

好处：少传数据；查询意图一目了然；表里将来加了大字段（长描述、JSON 配置）也不会拖慢列表。查询即接口——列集合就是这份接口的形状。

## 5.3 缓存：难点从来不是存，是失效

公开目录数据是典型的「读多写少」：成千上万次浏览 vs 偶尔一次后台改价。参考实现把目录查询全部包上 `unstable_cache` 并打同一个 tag：

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

配套的失效动作必须出现在**每一处**会改动目录数据的地方：

- 后台新建/修改商品后：`revalidateTag(CATALOG_TAG, "max")`（立即失效，不等过期）；
- 结账扣库存后：同样失效——库存也是目录数据，漏了这里，商品页会显示过期库存；
- 支付回调取消订单退库存后：webhook 里也要失效（第 12 章）。

这套策略的关键不在 API，在**纪律**：写路径漏一处，bug 就是「后台改了价，前台半天不变」。所以 tag 常量集中定义在一个文件、所有写路径都从那里 import——用代码结构提醒你别漏。`revalidate: 60` 的短过期是兜底（比如缓存键随搜索参数膨胀时的对冲），主动失效才是主力。

## 5.4 缓存的边界：用户数据永不进共享缓存

参考实现的缓存函数里只有商品目录，没有任何用户数据。这条边界比缓存 API 本身更重要：

- **可以缓存**：公开的、所有人看到都一样的数据（目录、文章、配置）。
- **绝不能共享缓存**：与具体用户相关的数据（购物车、订单、个人资料）。放进去轻则串数据（A 看到 B 的购物车），重则泄漏。
- **拿不准就别缓存**：实时查库的代价是性能，缓存错了的代价是正确性。先正确，再优化。

另外注意：`listProducts({q, category, sort, page})` 的每种参数组合各有一份缓存，参数也是缓存键的一部分——设计缓存时要把键空间的大小一起考虑进去。

## 常见误区

- **「用了 ORM 就不会有注入」**：ORM 的原生 SQL 逃生舱用错了照样注入；LIKE 通配符这类语义注入 ORM 更不管。
- **「缓存就是给函数包一层」**：写不出完整的失效点清单，就不要上缓存。先把所有写路径列出来，再决定。
- **「缓存时间设长点更省资源」**：过期时间是正确性与性能的交换。主动失效在，过期只是兜底——顺序别反。

## 本章练习

1. 用后台改一个商品的价格，观察前台多久内变化；然后把后台 action 里的 `revalidateTag` 临时注释掉再改一次，对比差别（改完还原）。
2. 给商品列表查询加上分页（limit/offset + 总数），注意排序要稳定（追加一个唯一字段做次级排序），否则翻页会重叠/漏行。
3. 思考题：如果把「我的订单」查询也包上 `unstable_cache`，会发生什么？从缓存键与用户隔离两个角度回答。
