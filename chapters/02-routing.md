---
layout: default
title: "02 · App Router 与渲染边界"
---

[返回目录](../index.md)

# 02 · App Router 与渲染边界

## 原则
先使用 Server Component。只有需要浏览器事件、状态或浏览器 API 的组件才使用 Client Component。`"use client"` 定义客户端模块边界，不代表组件完全不参与服务端预渲染。

| 文件 | 职责 |
|---|---|
| `app/layout.tsx` | 根布局、全局样式、metadata |
| `app/(storefront)/products/[slug]/page.tsx` | 动态路由 |
| `app/(auth)/login/page.tsx` | 路由组中的页面 |
| `app/admin/layout.tsx` | 管理区布局与入口权限 |
| `app/error.tsx` | 错误边界 |
| `app/not-found.tsx` | 404 页面 |
| `app/api/webhooks/stripe/route.ts` | HTTP 接口 |

圆括号路由组不进入 URL。`[slug]` 是动态路径段。项目使用 Promise 形式的 `params` 和 `searchParams`，在服务端等待后再读取。

源码：`src/app/layout.tsx`

```tsx
import type { Metadata } from "next";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { siteUrl } from "@/lib/env";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: "NextShop", template: "%s · NextShop" },
  description: "Next.js 全栈电商学习示例",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <Header />
        <main className="mx-auto min-h-[60vh] max-w-6xl px-4 py-8">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
```

## 客户端边界

源码：`src/features/auth/components/auth-form.tsx`

```tsx
"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Field, FormError } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { login, register } from "../actions";

export function AuthForm({ mode, next }: { mode: "login" | "register"; next: string }) {
  const [state, action] = useActionState(mode === "login" ? login : register, undefined);
  const fe = state?.fieldErrors ?? {};
  const isLogin = mode === "login";

  return (
    <form action={action} className="card mx-auto max-w-sm space-y-4">
      <h1 className="text-xl font-bold">{isLogin ? "登录" : "注册"}</h1>
      <FormError message={state?.error} />
      <input type="hidden" name="next" value={next} />
      {!isLogin && <Field label="姓名" name="name" errors={fe.name} required autoComplete="name" />}
      <Field label="邮箱" name="email" type="email" errors={fe.email} required autoComplete="email" />
      <Field
        label="密码"
        name="password"
        type="password"
        errors={fe.password}
        required
        autoComplete={isLogin ? "current-password" : "new-password"}
      />
      <SubmitButton className="w-full">{isLogin ? "登录" : "创建账号"}</SubmitButton>
      <p className="text-center text-sm text-zinc-500">
        {isLogin ? (
          <>还没有账号？<Link href="/register" className="underline">注册</Link></>
        ) : (
          <>已有账号？<Link href="/login" className="underline">登录</Link></>
        )}
      </p>
    </form>
  );
}
```

`AuthForm` 使用 `useActionState` 管理表单提交结果。它通过 Next.js 的 Action 引用调用服务端操作，而不是把数据库模块打包进浏览器。传入客户端的普通 props 应满足 React 的序列化要求。不要传入密码哈希、密钥或未裁剪的数据库对象。

根布局中的 Header 读取会话及购物车，需注意动态请求数据对整棵路由渲染策略的影响。缓存公共查询不等于整个页面静态化。使用 URL 查询参数表达搜索、筛选和分页；使用局部状态表达临时交互。

## 练习
阅读商品详情页与 AuthForm。标出服务端代码、浏览器代码、跨边界的数据。新增 `loading.tsx` 作为练习；原项目未提供该文件。测试慢查询下的显示行为。


---

[上一章：架构总览与模块边界](01-architecture.md) · [目录](../index.md) · [下一章：数据访问与数据库设计](03-data.md)
