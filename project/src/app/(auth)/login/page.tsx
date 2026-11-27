import type { Metadata } from "next";
import { AuthForm } from "@/features/auth/components/auth-form";

export const metadata: Metadata = { title: "登录" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <>
      <AuthForm mode="login" next={next ?? "/"} />
      <p className="mx-auto mt-4 max-w-sm text-center text-xs text-zinc-500">
        演示账号：admin@example.com / admin123（管理员），demo@example.com / demo1234（顾客）
      </p>
    </>
  );
}
