"use server";
import { z } from 'zod';
import { redirect } from 'next/navigation';
import { db } from '@/infrastructure/database/client';
import { createSession, deleteSession } from './session';
const schema = z.object({ email: z.string().email().max(254), password: z.string().min(8).max(72) });
export async function signIn(f: FormData) {
  const v = schema.safeParse(Object.fromEntries(f));
  if (!v.success)
    redirect('/sign-in?error=invalid');
  const r = await db.query('SELECT id FROM users WHERE email=$1 AND password_hash=crypt($2,password_hash)', [v.data.email.toLowerCase(), v.data.password]);
  if (!r.rows[0])
    redirect('/sign-in?error=invalid');
  await deleteSession();
  await createSession(r.rows[0].id);
  redirect('/');
}
export async function signUp(f: FormData) {
  const v = schema.safeParse(Object.fromEntries(f));
  if (!v.success)
    redirect('/sign-in?error=invalid');
  const r = await db.query("INSERT INTO users(email,password_hash,role) VALUES($1,crypt($2,gen_salt('bf')),'customer') ON CONFLICT(email) DO NOTHING RETURNING id", [v.data.email.toLowerCase(), v.data.password]);
  if (!r.rows[0])
    redirect('/sign-in?error=exists');
  await deleteSession();
  await createSession(r.rows[0].id);
  redirect('/');
}
export async function signOut() {
  await deleteSession();
  redirect('/');
}
