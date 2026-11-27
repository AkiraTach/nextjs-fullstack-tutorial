import 'server-only';
import { db } from '@/infrastructure/database/client';
export type Order = {
  id: string;
  status: string;
  total: number;
  subtotal: number;
  shipping: number;
  discount: number;
  address: string;
  created_at: Date;
  email?: string;
};
export async function orders(userId?: string) {
  return (await db.query<Order>('SELECT o.*,u.email FROM orders o JOIN users u ON u.id=o.user_id WHERE ($1::uuid IS NULL OR o.user_id=$1) ORDER BY o.created_at DESC', [userId ?? null])).rows;
}
export async function order(id: string, userId: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
    return null;
  const o = (await db.query<Order>('SELECT * FROM orders WHERE id=$1 AND user_id=$2', [id, userId])).rows[0];
  if (!o)
    return null;
  const items = (await db.query<{
    name: string;
    price: number;
    quantity: number;
  }>('SELECT name,price,quantity FROM order_items WHERE order_id=$1', [id])).rows;
  return { ...o, items };
}
