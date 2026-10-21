# POS Pro — React Native + Supabase Point of Sale

A production-oriented POS app for retail, grocery, clothing, pharmacies and small
businesses. Real Supabase backend — no mock data as a permanent source. Checkout,
refunds and stock adjustments run as **single PostgreSQL transactions** via RPC
functions; the client never assembles a sale from separate unprotected writes.

## Stack
Expo SDK 52 · React Native 0.76 · TypeScript (strict) · Expo Router ·
Supabase (Postgres, Auth, RLS, Storage) · Zustand · React Query ·
React Hook Form + Zod · Jest.

## Features
- Auth: register, login, logout, forgot/reset password, persisted sessions,
  profile, multi-store membership with Owner / Manager / Cashier roles.
- Dashboard: today's sales, transaction count, product count, low-stock count,
  7-day & monthly sales, best sellers, recent transactions — all from live data
  (`get_dashboard_stats` RPC + queries).
- Products & categories: full CRUD, SKU/barcode search, category & stock filters,
  sorting, archive (never hard-delete sales history), optional image upload to
  Supabase Storage (`product-images` bucket), low-stock alerts.
- POS: search, category chips, barcode scanning (expo-camera), cart with
  stock-capped quantities, role-limited discounts, cash change calculation.
- Checkout: ONE `complete_checkout` RPC — validates membership, locks product
  rows, recomputes totals server-side from DB prices + store tax settings,
  checks discount authorization by role, inserts sale + items + payment,
  decrements stock and writes inventory movements — all atomically, protected
  by a unique idempotency key so retries never double-charge.
- Payments: Cash (with change), Card recorded as **externally processed/manual**
  (terminal reference only — no card data ever stored, no charge is claimed),
  Other/manual.
- Sales history: filters (receipt #, date via query, cashier, method, status),
  detail view, receipt preview/print/share (expo-print + expo-sharing),
  authorized refunds via `process_refund` RPC (restores stock, audit rows,
  partial/full refund status). Completed sales are never deleted.
- Inventory: stock-in / adjustments with mandatory reason (`adjust_stock` RPC,
  owner/manager only), full movement history, low-stock list.
- Settings: store details, currency (ISO), tax %, low-stock default, discount
  caps per role, receipt footer, allow-negative-stock, light/dark/system theme.

## Setup

### 1. Supabase project
1. Create a project at supabase.com.
2. Install the Supabase CLI and link: `supabase link --project-ref <your-ref>`
3. Apply migrations (schema, RLS, RPCs — in filename order):
   `supabase db push`
   (or paste each file from `supabase/migrations/` into the SQL editor in order.)
4. In Auth settings, enable Email provider. For production, configure the
   redirect URL `pospro://reset-password` under Auth → URL Configuration.

### 2. App config
```bash
cp .env.example .env
# EXPO_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
# EXPO_PUBLIC_SUPABASE_ANON_KEY=<publishable/anon key from Project Settings → API>
```
Never put the **service-role** key in the app or `.env` — RLS + RPC authorization
is the security boundary.

### 3. Run
```bash
npm install
npx expo start            # dev server / Expo Go
npx expo start --android  # Android emulator (AVD running) or scan QR with Expo Go
```
Physical Android device: install Expo Go, join the same Wi-Fi, scan the QR code.
For camera barcode scanning on a physical device, Expo Go works; for production
use a dev/release build (below).

### 4. First use
Register → confirm email (if enabled) → sign in → **Create Store** (you become
Owner and default settings are created) → add categories/products → sell from
the POS tab. Invite flows for extra staff: owners add existing user IDs to
`store_members` (SQL/Studio) in this version; in-app invites are a roadmap item.

### 5. Tests
```bash
npm test          # unit tests: money/tax/discount/change, stock validation,
                  # cart + idempotency-key behaviour, form validation
npm run typecheck # tsc --noEmit
```
Integration/RLS verification steps (need a live Supabase project):
see `__tests__/integration/README.md`.

### 6. Release build (EAS)
```bash
npm install -g eas-cli
eas build --platform android --profile production
```
Configure `eas.json`/credentials per Expo docs; set the same EXPO_PUBLIC_*
variables as EAS secrets/env for the production environment.

## Project structure
```
app/                     Expo Router routes (thin wrappers)
src/components/ui.tsx    design system (Button, Field, Card, Chip, states)
src/screens/             auth, dashboard, products, pos, sales, settings
src/services/            Supabase repository layer (only place that queries)
src/store/appStore.ts    session + cart (Zustand)
src/lib/                 supabase client, money math (integer cents), receipt
src/validation/          Zod schemas
src/theme/               light/dark palettes
supabase/migrations/     schema → RLS → RPCs (apply in order)
supabase/seed/           dev-only seed notes
__tests__/               unit tests + integration checklist
```

## Known limitations
- No real payment gateway is integrated: card payments are explicitly manual /
  externally processed. Add Stripe Terminal etc. behind the same `payments`
  table using `external_reference`.
- Staff invites are owner-managed via `store_members` (SQL) in v1.
- Receipt-number generation counts sales per store; fine at single-store POS
  volume, replace with a per-store sequence for very high concurrency.
- Integration tests require your own Supabase project credentials and were
  not run against a live project in this repo's CI.
