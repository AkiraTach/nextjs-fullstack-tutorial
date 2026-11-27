import type { Metadata } from "next";
import { desc } from "drizzle-orm";
import Link from "next/link";
import { formatMoney } from "@/lib/money";
import { db } from "@/server/db/client";
import { products } from "@/server/db/schema";

export const metadata: Metadata = { title: "商品管理" };

export default async function AdminProductsPage() {
  const rows = await db.select().from(products).orderBy(desc(products.createdAt));

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">商品（{rows.length}）</h1>
        <Link href="/admin/products/new" className="btn">新增商品</Link>
      </div>
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 text-zinc-500">
            <tr>
              <th className="px-4 py-3">名称</th>
              <th className="px-4 py-3">价格</th>
              <th className="px-4 py-3">库存</th>
              <th className="px-4 py-3">状态</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rows.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-3">{p.name}</td>
                <td className="px-4 py-3">{formatMoney(p.priceCents)}</td>
                <td className="px-4 py-3">{p.stock}</td>
                <td className="px-4 py-3">{p.active ? "上架" : "下架"}{p.featured ? " · 精选" : ""}</td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/admin/products/${p.id}`} className="underline">编辑</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
