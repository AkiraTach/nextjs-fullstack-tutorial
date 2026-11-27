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
