import type { PoolClient } from 'pg';
// Local simulation only: no money moves and no external API is called.
export async function captureMock(c: PoolClient, orderId: string, amount: number) {
  if (process.env.DEMO_MODE !== 'true')
    throw new Error('Mock payment requires DEMO_MODE');
  await c.query("INSERT INTO payments(order_id,amount,status) VALUES($1,$2,'captured')", [orderId, amount]);
}
