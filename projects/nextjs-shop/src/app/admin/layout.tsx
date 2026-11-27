import Link from "next/link";
import { requireAdmin } from "@/server/auth/session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin(); // proxy.ts 之外的第二道校验

  return (
    <div className="grid gap-8 md:grid-cols-[160px_1fr]">
      <nav className="space-y-2 text-sm">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">后台管理</p>
        <Link href="/admin" className="block hover:underline">概览</Link>
        <Link href="/admin/products" className="block hover:underline">商品</Link>
        <Link href="/admin/orders" className="block hover:underline">订单</Link>
      </nav>
      <div>{children}</div>
    </div>
  );
}
