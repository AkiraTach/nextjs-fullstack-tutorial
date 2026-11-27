import 'server-only';
import { transaction } from '@/infrastructure/database/client';
import { totals } from '@/features/pricing/domain/totals';
import { captureMock } from '@/infrastructure/payment/mock';
export async function placeOrder(userId: string, input: {
  address: string;
  code: string;
  key: string;
}) {
  return transaction(async (c) => {
    await c.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [userId]);
    const prior = (await c.query('SELECT id FROM orders WHERE user_id=$1 AND request_key=$2', [userId, input.key])).rows[0];
    if (prior)
      return prior.id as string;
    const { rows } = await c.query('SELECT p.id,p.name,p.price,p.stock,p.active,ci.quantity FROM cart_items ci JOIN products p ON p.id=ci.product_id WHERE ci.user_id=$1 ORDER BY p.id FOR UPDATE OF p', [userId]);
    if (!rows.length)
      throw new Error('EMPTY_CART');
    for (const r of rows)
      if (!r.active || r.stock < r.quantity)
        throw new Error('INSUFFICIENT_STOCK');
    const t = totals(rows.reduce((s, r) => s + r.price * r.quantity, 0), input.code);
    if (t.total > 2147483647 || t.subtotal > 2147483647)
      throw new Error('ORDER_LIMIT');
    const order = (await c.query("INSERT INTO orders(user_id,status,total,subtotal,shipping,discount,address,request_key) VALUES($1,'paid',$2,$3,$4,$5,$6,$7) RETURNING id", [
      userId,
      t.total,
      t.subtotal,
      t.shipping,
      t.discount,
      input.address,
      input.key
    ])).rows[0];
    for (const r of rows) {
      await c.query('UPDATE products SET stock=stock-$2 WHERE id=$1', [r.id, r.quantity]);
      await c.query('INSERT INTO order_items VALUES($1,$2,$3,$4,$5)', [
        order.id,
        r.id,
        r.name,
        r.price,
        r.quantity
      ]);
    }
    await captureMock(c, order.id, t.total);
    await c.query('DELETE FROM cart_items WHERE user_id=$1', [userId]);
    await c.query('INSERT INTO outbox(topic,payload) VALUES($1,$2)', ['order.paid', JSON.stringify({ orderId: order.id })]);
    return order.id as string;
  });
}
