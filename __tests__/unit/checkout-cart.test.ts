import { useCart } from '@/store/appStore';
import { loginSchema, productSchema } from '@/validation/schemas';

describe('cart store (checkout duplicate / quantity behaviour)', () => {
  beforeEach(() => useCart.getState().clear());
  it('adds, merges, caps at stock, and removes at zero', () => {
    const s = useCart.getState();
    s.add({ productId: '1', name: 'A', unitPriceCents: 100, stock: 3 });
    useCart.getState().add({ productId: '1', name: 'A', unitPriceCents: 100, stock: 3 }, 5);
    expect(useCart.getState().lines[0].quantity).toBe(3);
    useCart.getState().setQty('1', 0);
    expect(useCart.getState().lines).toHaveLength(0);
  });
  it('idempotency key is stable until the cart is cleared (retry = same key)', () => {
    const gen = () => 'key-1';
    expect(useCart.getState().ensureKey(gen)).toBe('key-1');
    expect(useCart.getState().ensureKey(() => 'key-2')).toBe('key-1');
    useCart.getState().clear();
    expect(useCart.getState().ensureKey(() => 'key-2')).toBe('key-2');
  });
});
describe('form validation', () => {
  it('login requires valid email + 6-char password', () => {
    expect(loginSchema.safeParse({ email: 'nope', password: '123' }).success).toBe(false);
    expect(loginSchema.safeParse({ email: 'a@b.co', password: '123456' }).success).toBe(true);
  });
  it('product rejects negative prices/stock', () => {
    expect(productSchema.safeParse({ name: 'X', sellingPrice: -1, costPrice: 0, stockQuantity: 0, lowStockThreshold: 0 }).success).toBe(false);
    expect(productSchema.safeParse({ name: 'X', sellingPrice: 10, costPrice: 5, stockQuantity: 3, lowStockThreshold: 1 }).success).toBe(true);
  });
});
describe('refund quantity rule (mirrors process_refund check)', () => {
  const refundable = (sold: number, already: number, ask: number) => already + ask <= sold;
  it('allows partial, blocks over-refund', () => { expect(refundable(5, 2, 3)).toBe(true); expect(refundable(5, 2, 4)).toBe(false); });
});
