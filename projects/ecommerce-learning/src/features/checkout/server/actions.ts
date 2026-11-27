"use server";
import { z } from 'zod';
import { redirect } from 'next/navigation';
import { requireUser } from '@/features/auth/server/session';
import { placeOrder } from '@/workflows/place-order';
export async function checkout(f: FormData) {
  const u = await requireUser();
  const v = z.object({ address: z.string().trim().min(5).max(500), code: z.string().max(40), key: z.string().uuid() }).safeParse(Object.fromEntries(f));
  if (!v.success)
    redirect('/checkout?error=invalid');
  let id: string;
  try {
    id = await placeOrder(u.id, v.data);
  }
  catch (e) {
    if (e instanceof Error && ['EMPTY_CART', 'INSUFFICIENT_STOCK', 'ORDER_LIMIT'].includes(e.message))
      redirect('/checkout?error=' + e.message);
    throw e;
  }
  redirect('/account/orders/' + id);
}
