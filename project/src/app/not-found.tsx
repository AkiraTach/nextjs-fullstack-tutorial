import Link from "next/link";

export default function NotFound() {
  return (
    <div className="card text-center">
      <h1 className="text-2xl font-bold">404</h1>
      <p className="mt-2 text-zinc-500">页面不存在。</p>
      <Link href="/" className="btn mt-4">回首页</Link>
    </div>
  );
}
