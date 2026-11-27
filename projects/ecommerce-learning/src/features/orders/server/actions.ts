"use server";
import { z } from 'zod';
import { requireUser } from '@/features/auth/server/session';
import { changeOrderStatus } from '@/workflows/change-order-status';
import { revalidatePath } from 'next/cache';
export async function updateOrder(f: FormData) {
  const u = await requireUser();
  const v = z.object({
    id: z.string().uuid(), status: z.enum([
      'shipped',
      'delivered',
      'return_requested',
      'refunded',
      'cancelled'
    ])
  }).parse(Object.fromEntries(f));
  await changeOrderStatus(u, v.id, v.status);
  revalidatePath('/', 'layout');
}
