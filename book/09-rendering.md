# 第 9 章 页面渲染与数据获取

## 本章目标

- 理解 Server Component 直接调查询层的范式：没有内部 API 层、没有 fetch 自己
- 理解搜索/筛选/分页状态为什么放在 URL（searchParams）里
- 掌握页面级 SEO 的基本件：generateMetadata、JSON-LD、sitemap，以及各自的注意点

## 9.1 页面即查询：RSC 直连数据层

首页是一个 async 函数组件，直接调用第 5 章的查询：

```tsx
// src/app/(storefront)/page.tsx
export default async function HomePage() {
  const [featured, categories] = await Promise.all([getFeaturedProducts(), listCategories()]);
  return (
    <div className="space-y-12">
      {/* …把 featured 渲染成商品卡片网格，categories 渲染成链接 */}
    </div>
  );
}
```

注意这里**没有** `/api/products` 接口、没有 `fetch`、没有客户端请求状态管理。Server Component 在服务端渲染时直接调函数拿数据，这是 App Router 与传统 SPA 最大的范式差别：

- 少一整层：不用设计内部 API、不用写序列化、不用在客户端处理这份数据的加载状态。
- 数据不进浏览器包：查询函数和数据库驱动都留在服务端（再叠加第 1 章的 `server-only` 守边界）。
- 两个独立查询用 `Promise.all` 并行，而不是顺序 await——页面耗时取决于最慢的那个，不是两者之和。

什么时候才需要 Route Handler 对外提供 API？有外部消费者时（移动端、第三方、webhook）。参考实现里唯一的 Route Handler 是支付 webhook 和健康检查——**没有消费者，就不建 API**。

## 9.2 状态放 URL：搜索、筛选、分页

商品列表把筛选条件全部放在 query string 里（`?q=耳机&category=electronics&sort=price-asc&page=2`），页面从 `searchParams` 读参数后传给列表查询。好处是成套的：

- **可分享、可收藏**：链接发给别人，打开就是同样的筛选结果。
- **后退键正确**：每次筛选都是一个历史记录，浏览器后退回到上一组条件。
- **服务端渲染一致**：首屏就是带筛选结果的 HTML，利于 SEO，也没有客户端「先空白再跳变」的闪烁。

代价是要处理参数的清洗：页码、排序值都来自 URL，必须过校验/收敛（非法页码回落到 1、排序键用枚举收敛）。URL 是用户输入，和表单输入一样不可信（第 8 章）。

## 9.3 SEO 三件套

**① 每页独立的 metadata**。详情页用 `generateMetadata` 按数据生成标题、描述和 OpenGraph 图：

```tsx
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
```

它和页面组件查的是同一个函数——因为查询走了缓存（第 5 章），这次重复调用几乎零成本。缓存的隐藏收益就在这里。

**② JSON-LD 结构化数据**。页面里嵌入 schema.org 的结构化数据（名称、价格、库存状态），搜索引擎能把价格和「有货」直接展示在搜索结果里。注意输出时的一个安全细节：

```tsx
<script type="application/ld+json"
  // 转义 < 防止 JSON 内容里出现 </script> 导致 XSS
  dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
/>
```

名称是人录入的数据，若含 `</script>` 而不转义，就能闭合脚本标签注入任意脚本。凡是把数据塞进 HTML 文本节点的地方，都要想一遍转义——框架帮你转义的是 JSX 子节点，`dangerouslySetInnerHTML` 的部分要自己负责（名字里都写了 dangerously）。

**③ 动态 sitemap**。`src/app/sitemap.ts` 从数据库读出全部上架条目的 slug 生成站点地图，并标注 `force-dynamic`——它要实时查库，构建时不能也不该预渲染（又一次呼应第 2 章「构建不依赖数据库」）。

## 9.4 找不到就 notFound()

数据不存在时，页面调用 `notFound()` 渲染最近的 `not-found.tsx` 并返回真正的 404 状态码。配合第 7 章的用法（越权也 404），记住：**404 是一个要主动调用的语义，不是等框架兜底的错误页**。条目已下架（`active = false`）时同样 404——查询里带了 `active` 条件，下架与不存在对访客无区别。

## 常见误区

- **「先做个 /api 再 fetch 是标准架构」**：那是 SPA 时代的架构。在 RSC 里给自己建 API 层，等于把类型安全的函数调用降级成无类型的网络请求，纯亏。
- **「筛选状态放 useState 更顺手」**：筛选状态放组件状态里，链接不可分享、后退不工作、首屏还要二次渲染。URL 才是筛选状态的天然容器。
- **「SEO 是上线后再补的事」**：metadata 和结构化数据依赖页面结构与数据形状，后补往往要动页面。和页面一起交付，是正确顺序。

## 本章练习

1. 给列表页加上按价格区间筛选（min/max 两个 URL 参数），注意参数清洗与缓存键的变化。
2. 给某个详情页补上 JSON-LD，并用一个含 `</script>` 的测试名称验证转义生效。
3. 思考题：首页 `Promise.all` 并行查两个数据。如果其中一个查询失败，页面会怎样？如果业务上希望「分类挂了也要显示精选」，代码要怎么改？
