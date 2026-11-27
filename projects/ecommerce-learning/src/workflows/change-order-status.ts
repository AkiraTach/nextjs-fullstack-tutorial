import 'server-only';
import { transaction } from '@/infrastructure/database/client';
import { canTransition } from '@/features/orders/domain/status';
import type { User } from '@/features/auth/server/session';
export async function changeOrderStatus(actor: User, id: string, to: string) {
  await transaction(async (c) => {
    const o = (await c.query('SELECT * FROM orders WHERE id=$1 FOR UPDATE', [id])).rows[0];
    if (!o)
      throw new Error('NOT_FOUND');
    if (actor.role !== 'admin' && (o.user_id !== actor.id || !['cancelled', 'return_requested'].includes(to)))
      throw new Error('FORBIDDEN');
    if (!canTransition(o.status, to))
      throw new Error('INVALID_TRANSITION');
    if (['cancelled', 'refunded'].includes(to)) {
      await c.query('SELECT p.id FROM products p JOIN order_items i ON i.product_id=p.id WHERE i.order_id=$1 ORDER BY p.id FOR UPDATE OF p', [id]);
      await c.query('UPDATE products p SET stock=p.stock+i.quantity FROM order_items i WHERE i.order_id=$1 AND i.product_id=p.id', [id]);
      await c.query("UPDATE payments SET status='refunded' WHERE order_id=$1", [id]);
    }
    await c.query('UPDATE orders SET status=$2 WHERE id=$1', [id, to]);
    await c.query('INSERT INTO audit_logs(actor_id,action,target) VALUES($1,$2,$3)', [actor.id, 'order.' + to, id]);
    await c.query('INSERT INTO outbox(topic,payload) VALUES($1,$2)', ['order.' + to, JSON.stringify({ orderId: id })]);
  });
}
