# Integration tests (require a real Supabase project)

These are NOT run in CI without credentials, and results are not claimed here.

1. Create a Supabase project, apply `supabase/migrations/*.sql` in order
   (Supabase CLI: `supabase link --project-ref <ref>` then `supabase db push`).
2. Create two users in Auth: Owner A and unrelated User B.
3. As A: sign in in the app -> Create Store -> add category/product -> stock-in.
4. Checkout a cash sale; verify in SQL:
   `select stock_quantity from products;` (decreased), sale + payment rows exist,
   one `inventory_movements` row of type 'sale'.
5. Replay the same checkout RPC with the same `p_idempotency_key` -> same sale id,
   stock unchanged (duplicate-submission prevention).
6. Attempt checkout with quantity > stock -> error, and NO sale row created
   (atomic rollback).
7. As B (not a member): `select * from products where store_id = '<A store>'`
   must return 0 rows (RLS), and `complete_checkout` must raise "Not a member".
8. As a cashier member: refund RPC must raise "Only owner/manager".
9. As owner: process a partial refund; verify stock restored, sale status
   `partially_refunded`, refund + refund_items rows exist.
