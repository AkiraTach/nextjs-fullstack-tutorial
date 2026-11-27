import { describe, expect, it } from "vitest";
import { productFormSchema } from "@/features/admin/schemas";
import { registerSchema } from "@/features/auth/schemas";
import { checkoutSchema } from "@/features/checkout/schemas";
import { slugify } from "@/lib/utils";

describe("schemas", () => {
  it("normalizes email and enforces password length on register", () => {
    const ok = registerSchema.parse({ name: "A", email: " A@B.CO ", password: "12345678" });
    expect(ok.email).toBe("a@b.co");
    expect(registerSchema.safeParse({ name: "A", email: "a@b.co", password: "123" }).success).toBe(false);
  });

  it("validates checkout shipping fields", () => {
    const base = {
      email: "a@b.co",
      shippingName: "A",
      shippingAddress: "1 Main St",
      shippingCity: "X",
      shippingPostal: "12345",
      shippingCountry: "US",
    };
    expect(checkoutSchema.safeParse(base).success).toBe(true);
    expect(checkoutSchema.safeParse({ ...base, shippingAddress: "" }).success).toBe(false);
  });

  it("converts product price text to cents and rejects bad slugs", () => {
    const input = {
      name: "Tee",
      slug: "tee-1",
      description: "",
      price: "19.99",
      stock: "5",
      categoryId: "",
      imageUrl: "",
      featured: false,
      active: true,
    };
    const parsed = productFormSchema.parse(input);
    expect(parsed.price).toBe(1999);
    expect(parsed.categoryId).toBeNull();
    expect(parsed.imageUrl).toBeNull();
    expect(productFormSchema.safeParse({ ...input, slug: "Bad Slug" }).success).toBe(false);
    expect(productFormSchema.safeParse({ ...input, price: "0" }).success).toBe(false);
    expect(productFormSchema.safeParse({ ...input, stock: "-1" }).success).toBe(false);
  });

  it("slugifies names", () => {
    expect(slugify("  Hello, World!  ")).toBe("hello-world");
  });
});
