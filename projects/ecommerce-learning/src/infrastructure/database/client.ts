import 'server-only';
import { Pool, type PoolClient } from 'pg';
const globalDb = globalThis as typeof globalThis & {
  shopPool?: Pool;
};
export const db = globalDb.shopPool ?? new Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
if (process.env.NODE_ENV !== 'production')
  globalDb.shopPool = db;
export async function transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  }
  catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
  finally {
    client.release();
  }
}
