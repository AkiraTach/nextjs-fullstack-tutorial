import Link from 'next/link';
import { requireUser } from '@/features/auth/server/session';
export default async function Layout({ children }: {
  children: React.ReactNode;
}) {
  await requireUser(true);
  return <>
    <nav className="card">
      <Link href="/admin">概览</Link>
      <Link href="/admin/products">商品与库存</Link>
      <Link href="/admin/orders">订单管理</Link>
      <Link href="/admin/audit">审计日志</Link>
    </nav>
    <br />
    {children}
  </>;
}
