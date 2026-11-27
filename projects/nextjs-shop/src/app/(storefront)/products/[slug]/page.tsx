import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { addToCart } from "@/features/cart/actions";
import { ProductImage } from "@/features/catalog/components/product-card";
import { getProductBySlug } from "@/features/catalog/queries";
import { SubmitButton } from "@/components/ui/submit-button";
import { siteUrl } from "@/lib/env";
import { formatMoney } from "@/lib/money";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "商品不存在" };
  return {
    title: product.name,
    description: product.description.slice(0, 150),
    openGraph: { title: product.name, images: product.imageUrl ? [product.imageUrl] : [] },
  };
}

export default async function ProductPage({ params }: { params: Params }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  // 结构化数据：让搜索引擎在结果里展示价格与库存
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    image: product.imageUrl ?? undefined,
    offers: {
      "@type": "Offer",
      url: `${siteUrl()}/products/${product.slug}`,
      priceCurrency: "USD",
      price: (product.priceCents / 100).toFixed(2),
      availability:
        product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    },
  };

  return (
    <div>
      <script
        type="application/ld+json"
        // 转义 < 防止 JSON 内容里出现 </script> 导致 XSS
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <nav className="mb-4 text-sm text-zinc-500">
        <Link href="/products" className="hover:underline">全部商品</Link>
        {product.categoryName && (
          <>
            {" / "}
            <Link href={`/products?category=${product.categorySlug}`} className="hover:underline">
              {product.categoryName}
            </Link>
          </>
        )}
      </nav>

      <div className="grid gap-8 md:grid-cols-2">
        <ProductImage src={product.imageUrl} alt={product.name} className="rounded-xl" />
        <div>
          <h1 className="text-3xl font-bold">{product.name}</h1>
          <p className="mt-3 text-2xl font-semibold">{formatMoney(product.priceCents)}</p>
          <p className="mt-4 whitespace-pre-line text-zinc-600">{product.description}</p>

          <p className="mt-4 text-sm">
            {product.stock > 0 ? (
              <span className="text-green-700">有货（库存 {product.stock}）</span>
            ) : (
              <span className="text-red-600">暂时售罄</span>
            )}
          </p>

          {product.stock > 0 && (
            <form action={addToCart} className="mt-6 flex items-center gap-3">
              <input type="hidden" name="productId" value={product.id} />
              <input
                type="number"
                name="quantity"
                defaultValue={1}
                min={1}
                max={Math.min(product.stock, 20)}
                className="input w-20"
                aria-label="数量"
              />
              <SubmitButton pendingText="加入中…">加入购物车</SubmitButton>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
