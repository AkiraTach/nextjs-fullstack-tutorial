import { z } from "zod";
import { parseMoneyToCents } from "@/lib/money";

export const productFormSchema = z.object({
  name: z.string().trim().min(1, "请输入商品名").max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "slug 只能包含小写字母、数字和连字符")
    .max(120),
  description: z.string().trim().max(5000).default(""),
  price: z
    .string()
    .trim()
    .transform((v, ctx) => {
      const cents = parseMoneyToCents(v);
      if (cents === null || cents <= 0) {
        ctx.addIssue({ code: "custom", message: "价格格式应为 19.99" });
        return z.NEVER;
      }
      return cents;
    }),
  stock: z.coerce.number().int().min(0, "库存不能为负").max(1_000_000),
  categoryId: z
    .string()
    .transform((v) => (v === "" ? null : Number(v)))
    .pipe(z.number().int().nullable()),
  imageUrl: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .pipe(z.url("图片地址必须是 http(s) 链接").nullable()),
  featured: z.boolean(),
  active: z.boolean(),
});
