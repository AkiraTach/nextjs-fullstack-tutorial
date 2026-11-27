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
      .limit(4),
  ["featured-products"],
  { tags: [CATALOG_TAG], revalidate: 60 },
);

export type ListParams = {
  q?: string;
  category?: string;
  sort: SortKey;
  page: number;
};

export const listProducts = unstable_cache(
  async ({ q, category, sort, page }: ListParams) => {
    const conditions: SQL[] = [eq(products.active, true)];
    if (q) {
      // % 与 _ 是 LIKE 的通配符，用户输入里出现时需要转义
      const pattern = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
      conditions.push(or(ilike(products.name, pattern), ilike(products.description, pattern))!);
    }
    if (category) {
      conditions.push(
        eq(products.categoryId, sql`(select id from ${categories} where slug = ${category})`),
      );
    }
    const where = and(...conditions);
    const order =
      sort === "price-asc"
        ? asc(products.priceCents)
        : sort === "price-desc"
          ? desc(products.priceCents)
          : desc(products.createdAt);

    const [items, [{ total }]] = await Promise.all([
      db
        .select(productCard)
        .from(products)
        .where(where)
        .orderBy(order, asc(products.id))
        .limit(PAGE_SIZE)
        .offset((page - 1) * PAGE_SIZE),
      db.select({ total: sql<number>`count(*)::int` }).from(products).where(where),
    ]);
    return { items, total, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
  },
  ["product-list"],
  { tags: [CATALOG_TAG], revalidate: 60 },
);

export const getProductBySlug = unstable_cache(
  async (slug: string) => {
    const [row] = await db
      .select({
        ...productCard,
        description: products.description,
        categoryName: categories.name,
        categorySlug: categories.slug,
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(and(eq(products.slug, slug), eq(products.active, true)))
      .limit(1);
    return row ?? null;
  },
  ["product-by-slug"],
  { tags: [CATALOG_TAG], revalidate: 60 },
);

/** sitemap 用，不缓存 */
export async function listAllActiveSlugs() {
  return db
    .select({ slug: products.slug })
    .from(products)
    .where(eq(products.active, true));
}
