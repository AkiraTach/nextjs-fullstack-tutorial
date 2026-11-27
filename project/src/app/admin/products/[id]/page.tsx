import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ProductForm } from "@/features/admin/components/product-form";
import { db } from "@/server/db/client";
import { categories, products } from "@/server/db/schema";

export const metadata: Metadata = { title: "编辑商品" };

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const [[product], cats] = await Promise.all([
    db.select().from(products).where(eq(products.id, id)),
    db.select().from(categories).orderBy(asc(categories.name)),
  ]);
  if (!product) notFound();

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">编辑商品</h1>
      <ProductForm categories={cats} product={product} />
    </div>
  );
}
