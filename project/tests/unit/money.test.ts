import { describe, expect, it } from "vitest";
import { formatMoney, parseMoneyToCents, sumCents } from "@/lib/money";

describe("money", () => {
  it("formats cents as USD", () => {
    expect(formatMoney(1999)).toBe("$19.99");
    expect(formatMoney(0)).toBe("$0.00");
  });

  it("parses user input into integer cents without float error", () => {
    expect(parseMoneyToCents("19.99")).toBe(1999);
    expect(parseMoneyToCents("0.1")).toBe(10);
    expect(parseMoneyToCents("12")).toBe(1200);
    expect(parseMoneyToCents("1.005")).toBeNull();
    expect(parseMoneyToCents("-5")).toBeNull();
    expect(parseMoneyToCents("abc")).toBeNull();
  });

  it("sums line items", () => {
    expect(
      sumCents([
        { unitPriceCents: 1999, quantity: 2 },
        { unitPriceCents: 500, quantity: 1 },
      ]),
    ).toBe(4498);
  });
});
