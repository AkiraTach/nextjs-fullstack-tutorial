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

export async function updateProduct(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const id = z.uuid().parse(formData.get("id"));
  const parsed = readProductForm(formData);
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const { price, ...rest } = parsed.data;

  try {
    await db.update(products).set({ ...rest, priceCents: price }).where(eq(products.id, id));
  } catch (e) {
    if (isUniqueViolation(e)) return { fieldErrors: { slug: ["slug 已被使用"] } };
    throw e;
  }
  refreshCatalog();
  redirect("/admin/products");
}

const statusSchema = z.object({
  orderId: z.uuid(),
  status: z.enum(["paid", "shipped", "cancelled"]),
});

export async function updateOrderStatus(formData: FormData) {
  await requireAdmin();
  const { orderId, status } = statusSchema.parse({
    orderId: formData.get("orderId"),
    status: formData.get("status"),
  });

  if (status === "cancelled") {
    await cancelOrderAndRestock(orderId, ["pending", "paid"]);
    revalidateTag(CATALOG_TAG, "max");
  } else {
    // 只允许合法的状态流转：pending -> paid（人工确认收款），paid -> shipped
    const [order] = await db
      .select({ status: orders.status })
      .from(orders)
      .where(eq(orders.id, orderId));
    const ok =
      (status === "paid" && order?.status === "pending") ||
      (status === "shipped" && order?.status === "paid");
    if (ok) {
      await db
        .update(orders)
        .set({ status, ...(status === "paid" ? { paidAt: new Date() } : {}) })
        .where(eq(orders.id, orderId));
    }
  }
  revalidatePath("/admin/orders");
  revalidatePath("/admin");
}
