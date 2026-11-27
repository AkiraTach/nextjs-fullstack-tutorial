---
layout: default
title: "04 · Server Actions、输入校验与错误处理"
---

[返回目录](../index.md)

# 04 · Server Actions、输入校验与错误处理

## 原则
读取数据优先使用 Server Component 调用查询函数。页面内部写操作优先使用 Server Action。需要明确 HTTP 协议、外部调用或 Webhook 时使用 Route Handler。

Server Action 是可远程调用的服务端入口。隐藏表单字段与函数参数均不可信。每次执行都要校验输入、身份和权限。

源码：`src/features/admin/actions.ts`（第 1–55 行）

```ts
"use server";

import { eq } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { FormState } from "@/features/auth/schemas";
import { CATALOG_TAG } from "@/features/catalog/queries";
import { cancelOrderAndRestock } from "@/features/orders/service";
import { requireAdmin } from "@/server/auth/session";
import { db } from "@/server/db/client";
import { orders, products } from "@/server/db/schema";
import { productFormSchema } from "./schemas";

function readProductForm(formData: FormData) {
  return productFormSchema.safeParse({
    name: formData.get("name") ?? "",
    slug: formData.get("slug") ?? "",
    description: formData.get("description") ?? "",
    price: formData.get("price") ?? "",
    stock: formData.get("stock") ?? 0,
    categoryId: formData.get("categoryId") ?? "",
    imageUrl: formData.get("imageUrl") ?? "",
    featured: formData.get("featured") === "on",
    active: formData.get("active") === "on",
  });
}

function isUniqueViolation(e: unknown): boolean {
  const code = (e as { code?: string; cause?: { code?: string } })?.code
    ?? (e as { cause?: { code?: string } })?.cause?.code;
  return code === "23505";
}

function refreshCatalog() {
  revalidateTag(CATALOG_TAG, "max");
  revalidatePath("/admin/products");
}

export async function createProduct(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = readProductForm(formData);
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const { price, ...rest } = parsed.data;

  try {
    await db.insert(products).values({ ...rest, priceCents: price });
  } catch (e) {
    if (isUniqueViolation(e)) return { fieldErrors: { slug: ["slug 已被使用"] } };
    throw e;
  }
  refreshCatalog();
  redirect("/admin/products");
}

```

上面的 Action 依次验证管理员身份、解析 FormData、执行写入、处理唯一冲突、刷新缓存。`redirect()` 会通过特殊异常控制流程，因此不要用宽泛的 catch 吞掉它。

| 错误类型 | 处理方式 |
|---|---|
| 字段错误 | 返回 fieldErrors，表单定位字段 |
| 预期业务冲突 | 返回可理解的提示 |
| 无权限 | 拒绝操作或重定向 |
| 未知基础设施错误 | 抛出，由错误边界与日志处理 |

原项目部分 Action 使用 Zod `parse`，非法参数会抛异常。对用户可修正的错误，优先使用 `safeParse` 返回结构化结果。服务端日志不要记录密码、完整 token 或支付密钥。

## 推荐的用例接口（新增示意，非原项目代码）
```ts
export async function updateTaskAction(prev: FormState, formData: FormData) {
  const actor = await requireUser();
  const parsed = taskSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "输入无效" };
  await updateTask({ actorId: actor.userId, ...parsed.data });
  revalidatePath("/tasks");
  return { success: true };
}
```
实际实现必须在 `updateTask` 检查任务归属。这里只展示职责分离。

## 练习
绕过客户端 required 属性，提交空字段、非法 UUID、重复 slug。确认服务端仍能拒绝请求，并检查错误是否适当显示。


---

[上一章：数据访问与数据库设计](03-data.md) · [目录](../index.md) · [下一章：身份认证、授权与安全边界](05-auth.md)
