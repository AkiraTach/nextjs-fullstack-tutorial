import type { Metadata } from 'next';
import Link from 'next/link';
import { user } from '@/features/auth/server/session';
import { signOut } from '@/features/auth/server/actions';
import './globals.css';
export const metadata: Metadata = { title: { default: 'Field Shop | 电商学习项目', template: '%s | Field Shop' }, description: 'Next.js 全栈电商学习项目' };
export const dynamic = 'force-dynamic';
export default async function Layout({ children }: {
  children: React.ReactNode;
}) {
  const u = await user();
  return <html lang="zh-CN">
    <body>
      <header>
        <nav>
          <Link className="brand" href="/">FIELD / SHOP</Link>
          <Link href="/products">商品</Link>
          <Link href="/cart">购物车</Link>
          {u ? <>
            <Link href="/account/orders">我的订单</Link>
            {u.role === 'admin' && <Link href="/admin">管理后台</Link>}
            <form action={signOut}>
              <button className="quiet">退出</button>
            </form>
          </> : <Link href="/sign-in">登录</Link>}
        </nav>
      </header>
      <main>
        {children}
      </main>
      <footer>FIELD SHOP · Next.js 全栈学习项目 · 模拟支付，不发生真实扣款</footer>
    </body>
  </html>;
}
