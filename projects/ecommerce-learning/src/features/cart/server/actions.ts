"use server";
import { z } from 'zod';
import { requireUser } from '@/features/auth/server/session';
import { transaction } from '@/infrastructure/database/client';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
export async function addToCart(f: FormData) {
  const u = await requireUser();
  const id = z.string().uuid().parse(f.get('id'));
  await transaction(async (c) => {
    await c.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [u.id]);
    const p = (await c.query('SELECT stock,active FROM products WHERE id=$1', [id])).rows[0];
    if (!p?.active || p.stock < 1)
      return;
    await c.query('INSERT INTO cart_items VALUES($1,$2,1) ON CONFLICT(user_id,product_id) DO UPDATE SET quantity=LEAST(cart_items.quantity+1,$3,99)', [u.id, id, p.stock]);
  });
  revalidatePath('/cart');
  redirect('/cart');
}
export async function setQuantity(f: FormData) {
  const u = await requireUser();
  const id = z.string().uuid().parse(f.get('id'));
  const qty = z.coerce.number().int().min(0).max(99).parse(f.get('quantity'));
  await transaction(async (c) => {
    await c.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [u.id]);
    if (qty === 0)
      await c.query('DELETE FROM cart_items WHERE user_id=$1 AND product_id=$2', [u.id, id]);
    else
      await c.query('UPDATE cart_items SET quantity=$3 WHERE user_id=$1 AND product_id=$2', [u.id, id, qty]);
  });
  revalidatePath('/cart');
}
