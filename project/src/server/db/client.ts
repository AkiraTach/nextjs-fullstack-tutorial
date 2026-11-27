import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// postgres() 是惰性连接的：import 时不会真的连库，所以 `next build` 不需要数据库。
// 开发模式下热更新会重复执行本模块，用 globalThis 缓存连接避免连接泄漏。
const globalForDb = globalThis as unknown as {
  __sql?: ReturnType<typeof postgres>;
};

const sql =
  globalForDb.__sql ??
  postgres(
    process.env.DATABASE_URL ?? "postgres://shop:shop@localhost:5432/shop",
    { max: 10 },
  );

if (process.env.NODE_ENV !== "production") globalForDb.__sql = sql;

export const db = drizzle(sql, { schema });
export type Db = typeof db;
