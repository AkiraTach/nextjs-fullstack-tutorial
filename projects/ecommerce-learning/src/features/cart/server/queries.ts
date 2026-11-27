import 'server-only';
import { db } from '@/infrastructure/database/client';
export async function cart(userId: string) {
  return (await db.query<{
    id: string;
    name: string;
    price: number;
    quantity: number;
    stock: number;
    active: boolean;
  }>('SELECT p.id,p.name,p.price,p.stock,p.active,c.quantity FROM cart_items c JOIN products p ON p.id=c.product_id WHERE c.user_id=$1 ORDER BY p.name', [userId])).rows;
}
