import 'server-only';
import { db } from '@/infrastructure/database/client';
export type Product = {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  price: number;
  stock: number;
  active: boolean;
  icon: string;
};
export async function products(q = '', category = '') {
  return (await db.query<Product>("SELECT * FROM products WHERE active AND (name ILIKE '%'||$1||'%' OR description ILIKE '%'||$1||'%') AND ($2='' OR category=$2) ORDER BY name", [q, category])).rows;
}
export async function product(slug: string) {
  return (await db.query<Product>('SELECT * FROM products WHERE slug=$1 AND active', [slug])).rows[0];
}
export async function allProducts() {
  return (await db.query<Product>('SELECT * FROM products ORDER BY name')).rows;
}
