import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createHash, randomBytes } from 'node:crypto';
import { db } from '@/infrastructure/database/client';
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
export type User = {
  id: string;
  email: string;
  role: 'admin' | 'customer';
};
export async function user(): Promise<User | null> {
  const token = (await cookies()).get('shop_session')?.value;
  if (!token)
    return null;
  const r = await db.query<User>('SELECT u.id,u.email,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE token_hash=$1 AND expires_at>now()', [hash(token)]);
  return r.rows[0] ?? null;
}
export async function requireUser(admin = false) {
  const u = await user();
  if (!u)
    redirect('/sign-in');
  if (admin && u.role !== 'admin')
    redirect('/');
  return u;
}
export async function createSession(id: string) {
  const token = randomBytes(32).toString('hex');
  await db.query("INSERT INTO sessions VALUES($1,$2,now()+interval '7 days')", [hash(token), id]);
  (await cookies()).set('shop_session', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.DEMO_MODE !== 'true',
    path: '/',
    maxAge: 604800
  });
}
export async function deleteSession() {
  const c = await cookies();
  const t = c.get('shop_session')?.value;
  if (t)
    await db.query('DELETE FROM sessions WHERE token_hash=$1', [hash(t)]);
  c.delete('shop_session');
}
