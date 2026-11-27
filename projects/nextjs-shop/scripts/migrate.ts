import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const url = process.env.DATABASE_URL ?? "postgres://shop:shop@localhost:5432/shop";

async function main() {
  // 数据库容器刚启动时可能还没准备好，重试几次
  for (let attempt = 1; ; attempt++) {
    const sql = postgres(url, { max: 1 });
    try {
      await migrate(drizzle(sql), { migrationsFolder: "./drizzle" });
      await sql.end();
      console.log("✓ 数据库迁移完成");
      return;
    } catch (e) {
      await sql.end({ timeout: 1 }).catch(() => {});
      if (attempt >= 20) throw e;
      console.log(`等待数据库就绪…（第 ${attempt} 次重试）`);
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
