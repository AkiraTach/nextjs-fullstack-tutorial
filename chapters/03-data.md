---
layout: default
title: "03 · 数据访问与数据库设计"
---

[返回目录](../index.md)

# 03 · 数据访问与数据库设计

## 原则
将连接管理集中在基础设施层。将查询按业务用途放入 features。数据库结构必须通过迁移管理。

源码：`src/server/db/client.ts`

```ts
import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// postgres() 是惰性连接的：import 时不会真的连库，所以 `next build` 不需要数据库。
// 开发模式下热更新会重复执行本模块，用 globalThis 缓存连接避免连接泄漏。
const globalForDb = globalThis as unknown as {
  __sql?: ReturnType<typeof postgres>;
};

const sql =
  globalForDb.__sql ??
  postgres(
    process.env.DATABASE_URL ?? "postgres://shop:shop@localhost:5432/shop",
    { max: 10 },
  );

if (process.env.NODE_ENV !== "production") globalForDb.__sql = sql;

export const db = drizzle(sql, { schema });
export type Db = typeof db;
```

`postgres()` 惰性建立连接。开发模式通过 `globalThis` 重用连接对象，减少热更新产生的连接池。每个进程的 `max: 10` 不是整个部署的连接上限；多副本要一起计算数据库连接预算。生产环境应显式要求 `DATABASE_URL`，不要默默使用开发默认值。

`schema.ts` 被 Drizzle CLI 和脚本共用，故原项目没有在该文件导入 `server-only`。运行时数据库连接模块则使用它阻止误导入客户端。

## 数据模型与约束
| 表 | 架构知识 |
|---|---|
| users | 唯一邮箱、角色枚举、密码哈希 |
| products | 唯一 slug、分类外键、整数金额 |
| carts / cart_items | 组合主键表达购物车与项目的唯一关系 |
| orders / order_items | 状态枚举、历史快照、外键删除策略 |

数据库约束是最后一道防线。原项目没有库存非负、数量正数、金额非负的 CHECK 约束，也没有每个用户最多一个购物车的唯一约束。生产设计需通过新增迁移补齐，并先清理不符合约束的历史数据。

## 查询的返回边界

源码：`src/features/cart/queries.ts`

```ts
import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { cartItems, products } from "@/server/db/schema";
import { sumCents } from "@/lib/money";
import { findCartId } from "./cart-store";

export type CartLine = {
  productId: string;
  slug: string;
  name: string;
  imageUrl: string | null;
  unitPriceCents: number;
  quantity: number;
  stock: number;
};

export type Cart = {
  id: string | null;
  lines: CartLine[];
  count: number;
  subtotalCents: number;
};

export async function getCart(): Promise<Cart> {
  const cartId = await findCartId();
  if (!cartId) return { id: null, lines: [], count: 0, subtotalCents: 0 };

  const lines = await db
    .select({
      productId: products.id,
      slug: products.slug,
      name: products.name,
      imageUrl: products.imageUrl,
      unitPriceCents: products.priceCents,
      quantity: cartItems.quantity,
      stock: products.stock,
    })
    .from(cartItems)
    .innerJoin(products, eq(cartItems.productId, products.id))
    .where(eq(cartItems.cartId, cartId))
    .orderBy(products.name);

  return {
    id: cartId,
    lines,
    count: lines.reduce((n, l) => n + l.quantity, 0),
    subtotalCents: sumCents(lines),
  };
}
```

`getCart` 选择必要字段并返回明确的类型。对外接口应进一步按权限裁剪字段，而不是直接暴露完整 ORM 记录。金额用整数最小货币单位表达；多币种系统还需明确 currency 与精度规则。

## 练习
在开发数据库中修改 schema，执行 `npm run db:generate`，检查生成的 SQL，再执行 `npm run db:migrate`。不要修改已经在共享环境执行的迁移。


---

[上一章：App Router 与渲染边界](02-routing.md) · [目录](../index.md) · [下一章：Server Actions、输入校验与错误处理](04-actions.md)
