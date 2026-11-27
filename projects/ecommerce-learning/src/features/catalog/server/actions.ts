"use server";
import { z } from 'zod';
import { requireUser } from '@/features/auth/server/session';
import { transaction } from '@/infrastructure/database/client';
import { revalidatePath } from 'next/cache';
const schema = z.object({ id: z.string().uuid(), price: z.coerce.number().int().min(0).max(1000000), stock: z.coerce.number().int().min(0).max(1000000) });
export async function updateProduct(f: FormData) {
  const u = await requireUser(true);
  const v = schema.parse(Object.fromEntries(f));
  await transaction(async (c) => {
    await c.query('UPDATE products SET price=$1,stock=$2 WHERE id=$3', [v.price, v.stock, v.id]);
    await c.query('INSERT INTO audit_logs(actor_id,action,target) VALUES($1,$2,$3)', [u.id, 'product.updated', v.id]);
  });
  revalidatePath('/', 'layout');
}
