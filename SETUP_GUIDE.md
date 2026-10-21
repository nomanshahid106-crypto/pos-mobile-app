# Supabase Setup — step by step (10–15 minutes)

## Step 1 — Create the project
1. Go to https://supabase.com → **Start your project** → sign up / sign in
   (GitHub or email — your choice).
2. **New project**: pick your organization, name it e.g. `pos-pro`, set a strong
   **database password** (save it in your password manager — you don't need it
   for the app, only for direct DB access), choose the region closest to you
   (e.g. South Asia / Singapore if offered).
3. Wait ~2 minutes until the project shows **ACTIVE_HEALTHY**.

## Step 2 — Create all tables, RLS and functions (one paste)
1. Left sidebar → **SQL Editor** → **+ New query**.
2. Open `supabase/COMBINED_SETUP.sql` from this project, copy the **entire**
   file, paste it, click **Run**.
3. Expect: "Success. No rows returned" (running it twice on the same project
   will error on duplicate types/tables — it only needs to run once).

## Step 3 — Verify
1. New query → paste `supabase/VERIFY_SETUP.sql` → **Run**.
2. Expect: tables = **12**, RLS enabled = **true** everywhere, **6 functions**.

## Step 4 — Auth settings
1. **Authentication → Providers → Email**: make sure Email is **enabled**.
2. For easier first testing you may turn **OFF** "Confirm email" (you can turn
   it back on for production). If you leave it ON, each new user must click the
   email confirmation link before first sign-in.
3. **Authentication → URL Configuration → Redirect URLs** → add: `pospro://reset-password`
   (needed for the forgot-password flow).

## Step 5 — Get the two values the app needs
**Project Settings (gear, bottom-left) → API** and note:
- **Project URL** — looks like `https://abcdefghijklm.supabase.co`
- **anon / publishable key** — the long key labelled `anon` `public`.
  ⚠️ Do NOT copy the `service_role` key anywhere. It's a master key and must
  never go into the mobile app, chat, or git.

## Step 6 — Connect the app
In the project folder:
```bash
cp .env.example .env
```
Edit `.env`:
```
EXPO_PUBLIC_SUPABASE_URL=https://<your-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon public key>
```
Then:
```bash
npm install
npx expo start
```
Scan the QR code with **Expo Go** (Android/iOS) on the same Wi-Fi.

## Step 7 — First run smoke test
1. Register a new account in the app → sign in.
2. **Create Store** (you become Owner; default settings are created).
3. Products tab → add a category, then a product with stock e.g. 10.
4. Sell tab → add it to cart → Checkout → Cash → enter amount → Complete sale.
5. Check: receipt opens; Products shows stock dropped to 9; Sales tab lists it;
   Dashboard shows today's sales. In Supabase **Table Editor** you should see
   rows in `sales`, `sale_items`, `payments`, `inventory_movements`.

## If something fails
- **"Success" missing / SQL error in Step 2:** copy the exact red error text —
  different errors need different fixes; don't just re-run blindly.
- **App says "Missing EXPO_PUBLIC_…":** `.env` wasn't created or Expo was
  started before it existed — restart `npx expo start -c`.
- **Sign-in loop / no store:** the profile trigger creates your profile on
  signup; if you registered before running the SQL, register a fresh account
  or insert the profile row — ask Muse with the error you see.
- **`npm install` EPERM on this machine:** known quirk of this workspace FS;
  on your own computer it installs normally, or copy the folder elsewhere first.
