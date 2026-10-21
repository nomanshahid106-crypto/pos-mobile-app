/**
 * Money math in integer cents — never float dollars for totals.
 * The database stores numeric(12,2); the server recomputes every total,
 * so these helpers are for display + pre-validation only.
 */
export const toCents = (value: number | string): number => Math.round(Number(value) * 100);
export const fromCents = (cents: number): number => cents / 100;
export const formatMoney = (cents: number, currency = 'USD'): string =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(fromCents(cents));

export interface CartLine { productId: string; name: string; unitPriceCents: number; quantity: number; stock: number; }
export interface Totals { subtotalCents: number; discountCents: number; taxableCents: number; taxCents: number; totalCents: number; }

export function lineTotalCents(line: Pick<CartLine, 'unitPriceCents' | 'quantity'>): number {
  return line.unitPriceCents * line.quantity;
}

export function calculateTotals(lines: CartLine[], opts: { discountCents?: number; discountPercent?: number; taxRate: number; taxInclusive?: boolean }): Totals {
  const subtotalCents = lines.reduce((s, l) => s + lineTotalCents(l), 0);
  let discountCents = opts.discountCents ?? 0;
  if (opts.discountPercent != null) discountCents = Math.round((subtotalCents * opts.discountPercent) / 100);
  discountCents = Math.min(Math.max(discountCents, 0), subtotalCents);
  const taxableCents = subtotalCents - discountCents;
  const taxCents = opts.taxInclusive ? 0 : Math.round(taxableCents * opts.taxRate);
  return { subtotalCents, discountCents, taxableCents, taxCents, totalCents: taxableCents + taxCents };
}

export function changeDueCents(totalCents: number, receivedCents: number): number {
  if (receivedCents < totalCents) throw new Error('Amount received is less than the total');
  return receivedCents - totalCents;
}

export type Role = 'owner' | 'manager' | 'cashier';
/** Mirror of the server-side rule in complete_checkout(). */
export function maxDiscountCents(subtotalCents: number, role: Role, settings: { maxDiscountPercent: number; cashierMaxDiscountPercent: number }): number {
  const pct = role === 'cashier' ? settings.cashierMaxDiscountPercent : settings.maxDiscountPercent;
  return Math.floor((subtotalCents * pct) / 100);
}
export function canApplyDiscount(role: Role, discountCents: number, subtotalCents: number, settings: { maxDiscountPercent: number; cashierMaxDiscountPercent: number }): boolean {
  return discountCents >= 0 && discountCents <= maxDiscountCents(subtotalCents, role, settings);
}

export function validateCart(lines: CartLine[], opts: { allowNegativeStock?: boolean } = {}): string[] {
  const errors: string[] = [];
  if (lines.length === 0) errors.push('Cart is empty');
  for (const l of lines) {
    if (!Number.isInteger(l.quantity) || l.quantity <= 0) errors.push(`Invalid quantity for ${l.name}`);
    if (!opts.allowNegativeStock && l.quantity > l.stock) errors.push(`Insufficient stock for ${l.name} (have ${l.stock}, need ${l.quantity})`);
  }
  return errors;
}
export const isLowStock = (stock: number, threshold: number) => stock <= threshold;
