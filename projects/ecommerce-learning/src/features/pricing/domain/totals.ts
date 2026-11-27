export function totals(subtotal: number, code: string) {
  if (!Number.isSafeInteger(subtotal) || subtotal < 0)
    throw new Error('Invalid subtotal');
  const discount = code.trim().toUpperCase() === 'LEARN10' ? Math.floor(subtotal / 10) : 0;
  const shipping = subtotal === 0 || subtotal >= 5000 ? 0 : 500;
  return {
    subtotal,
    discount,
    shipping,
    total: subtotal - discount + shipping
  };
}
