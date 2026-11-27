import type { Metadata } from "next";
import Link from "next/link";
import { ProductCard } from "@/features/catalog/components/product-card";
import { listCategories, listProducts, type SortKey } from "@/features/catalog/queries";
import { clampInt } from "@/lib/utils";

export const metadata: Metadata = { title: "全部商品" };

type SearchParams = Promise<{ q?: string; category?: string; sort?: string; page?: string }>;

const SORTS: { value: SortKey; label: string }[] = [
  { value: "newest", label: "最新上架" },
  { value: "price-asc", label: "价格从低到高" },
  { value: "price-desc", label: "价格从高到低" },
];

export default async function ProductsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const q = sp.q?.trim().slice(0, 100) || undefined;
  const category = sp.category?.trim().slice(0, 100) || undefined;
  const sort = (SORTS.find((s) => s.value === sp.sort)?.value ?? "newest") as SortKey;
  const page = clampInt(sp.page, 1, 10_000, 1);

  const [categories, { items, total, totalPages }] = await Promise.all([
    listCategories(),
    listProducts({ q, category, sort, page }),
  ]);

  const href = (overrides: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = { q, category, sort: sort === "newest" ? undefined : sort, ...overrides };
    for (const [k, v] of Object.entries(merged)) if (v) params.set(k, v);
    const qs = params.toString();
    return qs ? `/products?${qs}` : "/products";
  };

  return (
    <div className="grid gap-8 md:grid-cols-[200px_1fr]">
      <aside className="space-y-6 text-sm">
        <form className="space-y-2">
          <input name="q" defaultValue={q} placeholder="搜索商品…" className="input" />
          {category && <input type="hidden" name="category" value={category} />}
          <button className="btn w-full">搜索</button>
        </form>

        <div>
          <h3 className="mb-2 font-semibold">分类</h3>
          <ul className="space-y-1">
            <li>
              <Link href={href({ category: undefined, page: undefined })} className={!category ? "font-semibold" : "text-zinc-600 hover:underline"}>
                全部
              </Link>
            </li>
            {categories.map((c) => (
              <li key={c.id}>
                <Link
                  href={href({ category: c.slug, page: undefined })}
                  className={category === c.slug ? "font-semibold" : "text-zinc-600 hover:underline"}
                >
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="mb-2 font-semibold">排序</h3>
          <ul className="space-y-1">
            {SORTS.map((s) => (
              <li key={s.value}>
                <Link
                  href={href({ sort: s.value === "newest" ? undefined : s.value, page: undefined })}
                  className={sort === s.value ? "font-semibold" : "text-zinc-600 hover:underline"}
                >
                  {s.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <section>
        <p className="mb-4 text-sm text-zinc-500">
          共 {total} 件商品{q ? `，搜索「${q}」` : ""}
        </p>
        {items.length === 0 ? (
          <p className="card text-zinc-500">没有找到符合条件的商品。</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {items.map((p) => (
              <ProductCard key={p.id} {...p} />
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <nav className="mt-8 flex items-center justify-center gap-4 text-sm">
            {page > 1 && <Link className="btn-outline" href={href({ page: String(page - 1) })}>上一页</Link>}
            <span>
              {page} / {totalPages}
            </span>
            {page < totalPages && <Link className="btn-outline" href={href({ page: String(page + 1) })}>下一页</Link>}
          </nav>
        )}
      </section>
    </div>
  );
}
