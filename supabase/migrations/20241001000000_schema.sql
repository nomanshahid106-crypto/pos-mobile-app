-- POS Pro — core schema. Money is numeric(12,2) (never float). All PKs UUID.
create extension if not exists pgcrypto;

create type member_role as enum ('owner','manager','cashier');
create type sale_status as enum ('completed','refunded','partially_refunded','voided');
create type payment_method as enum ('cash','card_manual','other');
create type payment_status as enum ('paid','pending','failed','refunded');
create type movement_type as enum ('sale','refund','stock_in','adjustment','initial');

create or replace function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  address text, phone text, email text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.store_members (
  store_id uuid not null references public.stores(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role member_role not null default 'cashier',
  created_at timestamptz not null default now(),
  primary key (store_id, user_id)
);

create table public.store_settings (
  store_id uuid primary key references public.stores(id) on delete cascade,
  currency text not null default 'USD',
  tax_rate numeric(6,4) not null default 0 check (tax_rate >= 0 and tax_rate <= 1),
  tax_inclusive boolean not null default false,
  receipt_header text, receipt_footer text not null default 'Thank you for your business!',
  default_low_stock_threshold int not null default 5 check (default_low_stock_threshold >= 0),
  allow_negative_stock boolean not null default false,
  max_discount_percent numeric(5,2) not null default 100 check (max_discount_percent between 0 and 100),
  cashier_max_discount_percent numeric(5,2) not null default 0 check (cashier_max_discount_percent between 0 and 100),
  updated_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, name)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  name text not null check (char_length(name) between 1 and 200),
  sku text, barcode text, description text,
  cost_price numeric(12,2) not null default 0 check (cost_price >= 0),
  selling_price numeric(12,2) not null check (selling_price >= 0),
  stock_quantity int not null default 0,
  low_stock_threshold int not null default 5 check (low_stock_threshold >= 0),
  image_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, sku)
);
create index products_store_name_idx on public.products(store_id, name);
create index products_store_barcode_idx on public.products(store_id, barcode);
create index products_store_sku_idx on public.products(store_id, sku);
create index products_low_stock_idx on public.products(store_id) where is_active;

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  receipt_number text not null,
  cashier_id uuid not null references public.profiles(id),
  status sale_status not null default 'completed',
  subtotal numeric(12,2) not null, discount_amount numeric(12,2) not null default 0,
  tax_amount numeric(12,2) not null default 0, total numeric(12,2) not null,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique (store_id, receipt_number),
  unique (store_id, idempotency_key)
);
create index sales_store_created_idx on public.sales(store_id, created_at desc);
create index sales_cashier_idx on public.sales(cashier_id, created_at desc);

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null, -- snapshot: survives product edits/deletes
  unit_price numeric(12,2) not null, quantity int not null check (quantity > 0),
  line_total numeric(12,2) not null,
  refunded_quantity int not null default 0 check (refunded_quantity >= 0)
);
create index sale_items_sale_idx on public.sale_items(sale_id);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  method payment_method not null,
  status payment_status not null default 'paid',
  amount numeric(12,2) not null,
  amount_received numeric(12,2), change_due numeric(12,2),
  external_reference text, -- provider/manual reference; NEVER raw card data
  created_at timestamptz not null default now()
);

create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  type movement_type not null,
  quantity_change int not null,
  stock_after int not null,
  reason text, reference_id uuid, created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index movements_product_idx on public.inventory_movements(product_id, created_at desc);

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  sale_id uuid not null references public.sales(id),
  processed_by uuid not null references public.profiles(id),
  reason text, total_refunded numeric(12,2) not null,
  created_at timestamptz not null default now()
);
create table public.refund_items (
  id uuid primary key default gen_random_uuid(),
  refund_id uuid not null references public.refunds(id) on delete cascade,
  sale_item_id uuid not null references public.sale_items(id),
  quantity int not null check (quantity > 0),
  amount numeric(12,2) not null
);

-- receipt sequence per store via a counter on sales insert
create or replace function gen_receipt_number(p_store uuid) returns text language plpgsql as $$
declare n int;
begin
  select count(*) + 1 into n from public.sales where store_id = p_store;
  return 'R-' || to_char(now(),'YYYYMMDD') || '-' || lpad(n::text, 5, '0');
end $$;

-- auth bootstrap: profile row on signup
create or replace function handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, full_name) values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''))
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();

-- create a store and make the caller its owner (prevents self-assigning roles elsewhere)
create or replace function create_store(p_name text, p_address text default null, p_phone text default null, p_email text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_store uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  insert into public.stores(name,address,phone,email,created_by) values (p_name,p_address,p_phone,p_email,auth.uid()) returning id into v_store;
  insert into public.store_members(store_id,user_id,role) values (v_store, auth.uid(), 'owner');
  insert into public.store_settings(store_id) values (v_store);
  return v_store;
end $$;

alter table public.sales add column if not exists updated_at timestamptz not null default now();
-- updated_at triggers ONLY on tables that have that column.
do $$ declare t text; begin foreach t in array array['profiles','stores','store_settings','categories','products','sales']
loop execute format('create trigger trg_%s_updated before update on public.%I for each row execute function set_updated_at()', t, t); end loop; end $$;
