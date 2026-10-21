import { calculateTotals, canApplyDiscount, changeDueCents, isLowStock, lineTotalCents, toCents, validateCart, type CartLine } from '@/lib/money';
const line = (over: Partial<CartLine> = {}): CartLine => ({ productId: 'p1', name: 'Rice', unitPriceCents: 1000, quantity: 2, stock: 10, ...over });

describe('money & totals', () => {
  it('converts dollars to cents without float drift', () => { expect(toCents(0.1 + 0.2)).toBe(30); expect(toCents('19.99')).toBe(1999); });
  it('line total', () => { expect(lineTotalCents(line())).toBe(2000); });
  it('subtotal, tax on discounted amount, total', () => {
    const t = calculateTotals([line(), line({ productId: 'p2', unitPriceCents: 500, quantity: 1 })], { discountCents: 500, taxRate: 0.1 });
    expect(t.subtotalCents).toBe(2500); expect(t.taxableCents).toBe(2000); expect(t.taxCents).toBe(200); expect(t.totalCents).toBe(2200);
  });
  it('percent discount', () => { expect(calculateTotals([line()], { discountPercent: 10, taxRate: 0 }).discountCents).toBe(200); });
  it('discount never exceeds subtotal', () => { expect(calculateTotals([line()], { discountCents: 99999, taxRate: 0 }).totalCents).toBe(0); });
  it('tax-inclusive mode adds no extra tax', () => { expect(calculateTotals([line()], { taxRate: 0.2, taxInclusive: true }).taxCents).toBe(0); });
  it('change due, and rejects underpayment', () => { expect(changeDueCents(2200, 2500)).toBe(300); expect(() => changeDueCents(2200, 2000)).toThrow(/less than/); });
});
describe('discount authorization (mirrors server rule)', () => {
  const settings = { maxDiscountPercent: 50, cashierMaxDiscountPercent: 5 };
  it('cashier capped at 5%', () => { expect(canApplyDiscount('cashier', 100, 10000, settings)).toBe(true); expect(canApplyDiscount('cashier', 501, 10000, settings)).toBe(false); });
  it('manager capped at 50%', () => { expect(canApplyDiscount('manager', 5000, 10000, settings)).toBe(true); expect(canApplyDiscount('manager', 5001, 10000, settings)).toBe(false); });
  it('negative discount rejected', () => { expect(canApplyDiscount('owner', -1, 10000, settings)).toBe(false); });
});
describe('inventory validation', () => {
  it('empty cart invalid', () => { expect(validateCart([])).toContain('Cart is empty'); });
  it('insufficient stock flagged', () => { expect(validateCart([line({ quantity: 11 })])[0]).toMatch(/Insufficient stock/); });
  it('negative-stock stores may oversell only when configured', () => { expect(validateCart([line({ quantity: 11 })], { allowNegativeStock: true })).toEqual([]); });
  it('zero quantity invalid', () => { expect(validateCart([line({ quantity: 0 })])[0]).toMatch(/Invalid quantity/); });
  it('low stock boundary is inclusive', () => { expect(isLowStock(5, 5)).toBe(true); expect(isLowStock(6, 5)).toBe(false); });
});
