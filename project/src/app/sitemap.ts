import type { MetadataRoute } from "next";
import { listAllActiveSlugs } from "@/features/catalog/queries";
import { siteUrl } from "@/lib/env";

// sitemap 要实时查库，构建时不能预渲染
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const slugs = await listAllActiveSlugs();
  return [
    { url: base, changeFrequency: "daily", priority: 1 },
    { url: `${base}/products`, changeFrequency: "daily", priority: 0.8 },
    ...slugs.map((p) => ({ url: `${base}/products/${p.slug}`, changeFrequency: "weekly" as const })),
  ];
}
