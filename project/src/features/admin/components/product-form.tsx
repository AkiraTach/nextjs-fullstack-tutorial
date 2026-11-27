"use client";

import { useActionState } from "react";
import { Field, FormError } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { createProduct, updateProduct } from "../actions";

type Props = {
  categories: { id: number; name: string }[];
  product?: {
    id: string;
    name: string;
    slug: string;
    description: string;
    priceCents: number;
    stock: number;
    imageUrl: string | null;
    categoryId: number | null;
    featured: boolean;
    active: boolean;
  };
};

export function ProductForm({ categories, product }: Props) {
  const [state, action] = useActionState(product ? updateProduct : createProduct, undefined);
  const fe = state?.fieldErrors ?? {};

  return (
    <form action={action} className="card max-w-2xl space-y-4">
      <FormError message={state?.error} />
      {product && <input type="hidden" name="id" value={product.id} />}
      <Field label="商品名" name="name" defaultValue={product?.name} errors={fe.name} required />
      <Field label="Slug（URL 标识）" name="slug" defaultValue={product?.slug} errors={fe.slug} required placeholder="例如 classic-white-tee" />
      <Field label="描述" name="description" textarea defaultValue={product?.description} errors={fe.description} />
      <div className="grid grid-cols-2 gap-4">
        <Field label="价格（USD）" name="price" defaultValue={product ? (product.priceCents / 100).toFixed(2) : ""} errors={fe.price} required placeholder="19.99" />
        <Field label="库存" name="stock" type="number" min={0} defaultValue={product?.stock ?? 0} errors={fe.stock} required />
      </div>
      <Field label="图片地址（可选）" name="imageUrl" defaultValue={product?.imageUrl} errors={fe.imageUrl} placeholder="https://…" />
      <label className="block text-sm">
        <span className="mb-1 block font-medium">分类</span>
        <select name="categoryId" defaultValue={product?.categoryId ?? ""} className="input">
          <option value="">（无）</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </label>
      <div className="flex gap-6 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="featured" defaultChecked={product?.featured ?? false} /> 首页精选
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="active" defaultChecked={product?.active ?? true} /> 上架
        </label>
      </div>
      <SubmitButton>{product ? "保存修改" : "创建商品"}</SubmitButton>
    </form>
  );
}
