import { z } from 'zod';
export const loginSchema = z.object({ email: z.string().email('Enter a valid email'), password: z.string().min(6, 'At least 6 characters') });
export const registerSchema = loginSchema.extend({ fullName: z.string().min(2, 'Enter your name'), confirmPassword: z.string() })
  .refine((d) => d.password === d.confirmPassword, { message: 'Passwords do not match', path: ['confirmPassword'] });
export const storeSchema = z.object({ name: z.string().min(2).max(120), address: z.string().optional(), phone: z.string().optional(), email: z.string().email().optional().or(z.literal('')) });
export const productSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  sku: z.string().optional(), barcode: z.string().optional(), description: z.string().optional(),
  categoryId: z.string().nullable().optional(),
  costPrice: z.coerce.number().min(0, 'Cannot be negative'),
  sellingPrice: z.coerce.number().min(0, 'Cannot be negative'),
  stockQuantity: z.coerce.number().int().min(0, 'Cannot be negative'),
  lowStockThreshold: z.coerce.number().int().min(0),
  isActive: z.boolean().default(true),
});
export const categorySchema = z.object({ name: z.string().min(1).max(80) });
export const stockAdjustSchema = z.object({ change: z.coerce.number().int().refine((v) => v !== 0, 'Enter a non-zero change'), reason: z.string().min(2, 'A reason is required') });
export const settingsSchema = z.object({
  currency: z.string().length(3), taxRatePercent: z.coerce.number().min(0).max(100),
  defaultLowStockThreshold: z.coerce.number().int().min(0),
  cashierMaxDiscountPercent: z.coerce.number().min(0).max(100),
  maxDiscountPercent: z.coerce.number().min(0).max(100),
  receiptFooter: z.string().max(200), allowNegativeStock: z.boolean(),
});
export type ProductForm = z.infer<typeof productSchema>;
