import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 生成最小化的独立产物，Docker 镜像更小
  output: "standalone",
  images: {
    remotePatterns: [{ protocol: "https", hostname: "picsum.photos" }],
  },
  // 学习提示：Next.js 16 的 Cache Components（cacheComponents: true）会在 build 时预渲染
  // 带 'use cache' 的数据，需要构建时就能连上数据库。为了让 Docker 构建不依赖数据库，
  // 这里默认关闭，改用 unstable_cache + revalidateTag（见 src/features/catalog/queries.ts）。
};

export default nextConfig;
