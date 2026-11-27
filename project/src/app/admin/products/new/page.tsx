import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { ProductForm } from "@/features/admin/components/product-form";
import { db } from "@/server/db/client";
import { categories } from "@/server/db/schema";

export const metadata: Metadata = { title: "新增商品" };

export default async function NewProductPage() {
  const cats = await db.select().from(categories).orderBy(asc(categories.name));
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">新增商品</h1>
      <ProductForm categories={cats} />
    </div>
  );
}
