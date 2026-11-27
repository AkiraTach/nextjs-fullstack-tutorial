import bcrypt from "bcryptjs";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/server/db/schema";

const url = process.env.DATABASE_URL ?? "postgres://shop:shop@localhost:5432/shop";
const sql = postgres(url, { max: 1 });
const db = drizzle(sql, { schema });

const CATEGORIES = [
  { slug: "apparel", name: "服饰" },
  { slug: "electronics", name: "数码" },
  { slug: "home", name: "家居" },
  { slug: "books", name: "图书" },
];

// [slug, 名称, 描述, 价格(分), 库存, 分类, 精选]
const PRODUCTS: [string, string, string, number, number, string, boolean][] = [
  ["classic-white-tee", "经典白 T 恤", "100% 纯棉，圆领，四季百搭。", 1999, 120, "apparel", true],
  ["denim-jacket", "牛仔夹克", "水洗做旧，春秋外套首选。", 6999, 35, "apparel", false],
  ["running-shoes", "轻量跑鞋", "透气网面，缓震中底。", 8999, 4, "apparel", true],
  ["wool-beanie", "羊毛针织帽", "保暖亲肤，多色可选。", 1599, 60, "apparel", false],
  ["wireless-earbuds", "无线降噪耳机", "主动降噪，续航 30 小时。", 7999, 50, "electronics", true],
  ["mechanical-keyboard", "机械键盘", "热插拔轴体，RGB 背光。", 9999, 25, "electronics", false],
  ["usb-c-hub", "USB-C 扩展坞", "7 合 1：HDMI / SD / USB-A。", 3999, 80, "electronics", false],
  ["portable-charger", "20000mAh 充电宝", "双向快充，可上飞机。", 3499, 0, "electronics", false],
  ["ceramic-mug", "手作陶瓷杯", "350ml，哑光釉面。", 1299, 200, "home", true],
  ["linen-cushion", "亚麻抱枕", "45×45cm，可拆洗。", 2499, 70, "home", false],
  ["desk-lamp", "护眼台灯", "三档色温，无频闪。", 4599, 3, "home", false],
  ["scented-candle", "香薰蜡烛", "大豆蜡，燃烧约 40 小时。", 1899, 90, "home", false],
  ["clean-code", "《代码整洁之道》", "程序员必读经典。", 3999, 150, "books", false],
  ["designing-data-apps", "《数据密集型应用系统设计》", "分布式系统入门到进阶。", 7900, 40, "books", false],
  ["pragmatic-programmer", "《程序员修炼之道》", "从小工到专家。", 4500, 55, "books", false],
  ["nextjs-handbook", "《Next.js 实战手册》", "示例书目（演示数据）。", 3500, 100, "books", false],
  ["canvas-tote", "帆布托特包", "厚实帆布，大容量。", 2299, 85, "apparel", false],
  ["bluetooth-speaker", "便携蓝牙音箱", "IPX7 防水，12 小时续航。", 5499, 45, "electronics", false],
];

async function main() {
  const adminEmail = (process.env.ADMIN_EMAIL ?? "admin@example.com").toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD ?? "admin123";

  await db
    .insert(schema.users)
    .values([
      {
        email: adminEmail,
        name: "Admin",
        role: "admin",
        passwordHash: await bcrypt.hash(adminPassword, 10),
      },
      {
        email: "demo@example.com",
        name: "Demo User",
        role: "customer",
        passwordHash: await bcrypt.hash("demo1234", 10),
      },
    ])
    .onConflictDoNothing({ target: schema.users.email });

  await db.insert(schema.categories).values(CATEGORIES).onConflictDoNothing({ target: schema.categories.slug });
  const cats = await db.select().from(schema.categories);
  const catId = new Map(cats.map((c) => [c.slug, c.id]));

  // 按 slug 去重插入：重复执行不会覆盖你在后台改过的数据
  await db
    .insert(schema.products)
    .values(
      PRODUCTS.map(([slug, name, description, priceCents, stock, category, featured]) => ({
        slug,
        name,
        description,
        priceCents,
        stock,
        featured,
        categoryId: catId.get(category) ?? null,
        imageUrl: `https://picsum.photos/seed/${slug}/800/800`,
      })),
    )
    .onConflictDoNothing({ target: schema.products.slug });

  console.log(`✓ 种子数据完成（管理员：${adminEmail}）`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => sql.end());
