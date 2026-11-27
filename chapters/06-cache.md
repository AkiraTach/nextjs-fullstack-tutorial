---
layout: default
title: "06 · 缓存、失效与数据新鲜度"
---

[返回目录](../index.md)

# 06 · 缓存、失效与数据新鲜度

## 原则
先定义数据是否可跨用户共享，再选择缓存。公共目录可共享缓存；私人购物车和订单默认按请求读取。缓存不能作为权限边界。

源码：`src/features/catalog/queries.ts`（第 1–35 行）

```ts
import "server-only";
import { and, asc, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { db } from "@/server/db/client";
import { categories, products } from "@/server/db/schema";

export const PAGE_SIZE = 8;
export const CATALOG_TAG = "catalog";

export type SortKey = "newest" | "price-asc" | "price-desc";

const productCard = {
  id: products.id,
  slug: products.slug,
  name: products.name,
  priceCents: products.priceCents,
  stock: products.stock,
  imageUrl: products.imageUrl,
};

// 公开的商品读取全部走 unstable_cache：同样的参数 60 秒内命中缓存；
// 后台修改商品后 revalidateTag(CATALOG_TAG, "max") 立即失效（见 admin 的 actions）。
export const listCategories = unstable_cache(
  async () => db.select().from(categories).orderBy(asc(categories.name)),
  ["categories"],
  { tags: [CATALOG_TAG], revalidate: 300 },
);

export const getFeaturedProducts = unstable_cache(
  async () =>
    db
      .select(productCard)
      .from(products)
      .where(and(eq(products.active, true), eq(products.featured, true)))
      .orderBy(desc(products.createdAt))
```

原项目使用 `unstable_cache`。分类 TTL 为 300 秒，精选商品、列表和详情 TTL 为 60 秒。列表查询按参数区分结果，并使用统一的 `catalog` tag。

| API | 用途 |
|---|---|
| unstable_cache | 缓存服务端函数结果 |
| revalidateTag(tag, "max") | 将带标签的缓存标为陈旧，后续访问采用 stale-while-revalidate 语义 |
| revalidatePath | 按路由路径触发重新验证 |
| updateTag | 在支持的 Server Action 场景要求立即过期，实现写后读需求 |

原 README 将 `revalidateTag(..., "max")` 描述为立即失效，需要区别：缓存会被标记陈旧，但下一次请求仍可能先收到旧结果。强一致操作如库存扣减必须查询数据库并依赖数据库条件，不依赖缓存显示值。

原 `next.config.ts` 没启用 Cache Components。不要把 `use cache` 与现有实现混为一谈。迁移时核对所用 Next.js 版本的 Cache Components、cacheLife、cacheTag 和预渲染规则；这是独立改造任务。

## 练习
连续访问列表，观察查询日志。修改一项公开数据，记录缓存失效前后结果。比较两个用户的购物车，确认不会共享私人缓存。设计一个任务管理系统的公共标签列表缓存。


---

[上一章：身份认证、授权与安全边界](05-auth.md) · [目录](../index.md) · [下一章：事务、并发与幂等](07-transactions.md)
