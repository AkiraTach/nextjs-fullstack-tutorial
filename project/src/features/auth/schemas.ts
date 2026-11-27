import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().trim().min(1, "请输入姓名").max(80),
  email: z.string().trim().toLowerCase().pipe(z.email("邮箱格式不正确")),
  password: z.string().min(8, "密码至少 8 位").max(100),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("邮箱格式不正确")),
  password: z.string().min(1, "请输入密码"),
});

/** useActionState 通用的表单状态 */
export type FormState = { error?: string; fieldErrors?: Record<string, string[]> } | undefined;
