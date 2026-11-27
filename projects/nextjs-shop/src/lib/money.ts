/** 金额统一以"分"为单位的整数，仅在展示时格式化。 */
export function formatMoney(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
    cents / 100,
  );
}

/** 把用户输入的 "19.99" 转成分；非法输入返回 null。 */
export function parseMoneyToCents(input: string): number | null {
  const s = input.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  return Math.round(parseFloat(s) * 100);
}

export function lineTotal(unitPriceCents: number, quantity: number): number {
  return unitPriceCents * quantity;
}

export function sumCents(items: { unitPriceCents: number; quantity: number }[]) {
  return items.reduce((acc, i) => acc + lineTotal(i.unitPriceCents, i.quantity), 0);
}
