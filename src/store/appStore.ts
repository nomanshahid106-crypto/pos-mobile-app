import { create } from 'zustand';
import type { Role, Store, StoreSettings } from '@/types/database.types';
import type { CartLine } from '@/lib/money';

interface SessionState { userId: string | null; email: string | null; store: Store | null; role: Role | null; settings: StoreSettings | null; setSession: (p: Partial<SessionState>) => void; clear: () => void; }
export const useSession = create<SessionState>((set) => ({
  userId: null, email: null, store: null, role: null, settings: null,
  setSession: (p) => set(p),
  clear: () => set({ userId: null, email: null, store: null, role: null, settings: null }),
}));

interface CartState {
  lines: CartLine[]; discountCents: number; idempotencyKey: string | null;
  add: (line: Omit<CartLine, 'quantity'>, qty?: number) => void;
  setQty: (productId: string, qty: number) => void; remove: (productId: string) => void;
  setDiscountCents: (c: number) => void; ensureKey: (gen: () => string) => string; clear: () => void;
}
let submitting = false; // duplicate-submit guard (also enforced by DB unique idempotency key)
export const isSubmitting = () => submitting;
export const setSubmitting = (v: boolean) => { submitting = v; };

export const useCart = create<CartState>((set, get) => ({
  lines: [], discountCents: 0, idempotencyKey: null,
  add: (line, qty = 1) => set((s) => {
    const existing = s.lines.find((l) => l.productId === line.productId);
    if (existing) return { lines: s.lines.map((l) => l.productId === line.productId ? { ...l, quantity: Math.min(l.quantity + qty, l.stock || l.quantity + qty) } : l) };
    return { lines: [...s.lines, { ...line, quantity: qty }] };
  }),
  setQty: (productId, qty) => set((s) => ({ lines: qty <= 0 ? s.lines.filter((l) => l.productId !== productId) : s.lines.map((l) => l.productId === productId ? { ...l, quantity: qty } : l) })),
  remove: (productId) => set((s) => ({ lines: s.lines.filter((l) => l.productId !== productId) })),
  setDiscountCents: (discountCents) => set({ discountCents }),
  ensureKey: (gen) => { const k = get().idempotencyKey ?? gen(); if (!get().idempotencyKey) set({ idempotencyKey: k }); return k; },
  clear: () => set({ lines: [], discountCents: 0, idempotencyKey: null }),
}));
