import Link from "next/link";
import { formatMoney } from "@/lib/money";

type Props = {
  slug: string;
  name: string;
  priceCents: number;
  stock: number;
  imageUrl: string | null;
};

export function ProductImage({
  src,
  alt,
  className = "",
}: {
  src: string | null;
  alt: string;
  className?: string;
}) {
  return (
    <div className={`relative aspect-square overflow-hidden bg-gradient-to-br from-zinc-100 to-zinc-200 ${className}`}>
      <span className="absolute inset-0 flex items-center justify-center text-5xl font-semibold text-zinc-300">
        {alt.slice(0, 1).toUpperCase()}
      </span>
      {src && (
        // 用普通 img：不依赖服务端去拉取外部图片，离线也不会让页面报错
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} loading="lazy" className="relative h-full w-full object-cover" />
      )}
    </div>
  );
}

export function ProductCard({ slug, name, priceCents, stock, imageUrl }: Props) {
  return (
    <Link
      href={`/products/${slug}`}
      className="group block overflow-hidden rounded-xl border border-zinc-200 bg-white transition hover:shadow-md"
    >
      <ProductImage src={imageUrl} alt={name} className="transition group-hover:scale-[1.02]" />
      <div className="p-4">
        <h3 className="line-clamp-1 font-medium">{name}</h3>
        <div className="mt-1 flex items-center justify-between text-sm">
          <span className="font-semibold">{formatMoney(priceCents)}</span>
          {stock < 1 ? (
            <span className="text-red-600">售罄</span>
          ) : stock <= 5 ? (
            <span className="text-amber-600">仅剩 {stock} 件</span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
