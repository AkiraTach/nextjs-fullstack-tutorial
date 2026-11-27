import Link from "next/link";
import { getFeaturedProducts, listCategories } from "@/features/catalog/queries";
import { ProductCard } from "@/features/catalog/components/product-card";

export default async function HomePage() {
  const [featured, categories] = await Promise.all([getFeaturedProducts(), listCategories()]);

  return (
    <div className="space-y-12">
      <section className="rounded-2xl bg-zinc-900 px-8 py-14 text-white">
        <h1 className="text-4xl font-bold tracking-tight">好物，一键到家</h1>
        <p className="mt-3 max-w-xl text-zinc-300">
          这是一个用 Next.js 16 + PostgreSQL 构建的全栈电商示例：商品浏览、购物车、结账、订单与后台管理。
        </p>
        <Link href="/products" className="btn-outline mt-6">
          开始选购
        </Link>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-semibold">分类</h2>
        <div className="flex flex-wrap gap-3">
          {categories.map((c) => (
            <Link
              key={c.id}
              href={`/products?category=${c.slug}`}
              className="rounded-full border border-zinc-300 bg-white px-4 py-1.5 text-sm hover:bg-zinc-100"
            >
              {c.name}
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-semibold">精选商品</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {featured.map((p) => (
            <ProductCard key={p.id} {...p} />
          ))}
        </div>
      </section>
    </div>
  );
}
