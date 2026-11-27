import { z } from "zod";

export const checkoutSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("邮箱格式不正确")),
  shippingName: z.string().trim().min(1, "请输入收件人").max(100),
  shippingAddress: z.string().trim().min(3, "请输入详细地址").max(200),
  shippingCity: z.string().trim().min(1, "请输入城市").max(100),
  shippingPostal: z.string().trim().min(2, "请输入邮编").max(20),
  shippingCountry: z.string().trim().min(2, "请输入国家/地区").max(60),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
