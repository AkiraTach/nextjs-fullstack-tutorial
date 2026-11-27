"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { mergeGuestCartInto } from "@/features/cart/cart-store";
import { createSession, destroySession } from "@/server/auth/session";
import { db } from "@/server/db/client";
import { users } from "@/server/db/schema";
import { loginSchema, registerSchema, type FormState } from "./schemas";

/** 只允许站内相对路径，防止开放重定向 */
function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export async function register(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }
  const { name, email, password } = parsed.data;

  const [exists] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (exists) return { error: "该邮箱已注册" };

  const [user] = await db
    .insert(users)
    .values({ name, email, passwordHash: await bcrypt.hash(password, 10) })
    .returning();

  await createSession({ userId: user.id, email: user.email, name: user.name, role: user.role });
  await mergeGuestCartInto(user.id);
  revalidatePath("/", "layout");
  redirect(safeNext(formData.get("next")));
}

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }
  const { email, password } = parsed.data;

  const [user] = await db.select().from(users).where(eq(users.email, email));
  // 无论是邮箱不存在还是密码错误，都返回同样的提示，避免泄露账号是否存在
  const ok = user ? await bcrypt.compare(password, user.passwordHash) : false;
  if (!user || !ok) return { error: "邮箱或密码错误" };

  await createSession({ userId: user.id, email: user.email, name: user.name, role: user.role });
  await mergeGuestCartInto(user.id);
  revalidatePath("/", "layout");
  redirect(safeNext(formData.get("next")));
}

export async function logout() {
  await destroySession();
  revalidatePath("/", "layout");
  redirect("/");
}
