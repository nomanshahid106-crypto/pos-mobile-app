-- ============================================================
-- POS Pro — ONE-PASTE SETUP. Run this whole file once in the
-- Supabase SQL Editor (Dashboard -> SQL Editor -> New query).
-- Order: schema -> RLS -> RPC functions. Safe to run on a NEW project only.
-- ============================================================

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

-- ================= RLS POLICIES ==================
-- RLS: every table enabled. Membership helpers are SECURITY DEFINER to avoid policy recursion.
create or replace function is_store_member(p_store uuid, p_roles member_role[] default null)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.store_members m
    where m.store_id = p_store and m.user_id = auth.uid()
      and (p_roles is null or m.role = any(p_roles)));
$$;
create or replace function my_store_ids() returns setof uuid language sql security definer set search_path = public stable as $$
  select store_id from public.store_members where user_id = auth.uid();
$$;

do $$ declare t text; begin foreach t in array array['profiles','stores','store_members','store_settings','categories','products','sales','sale_items','payments','inventory_movements','refunds','refund_items']
loop execute format('alter table public.%I enable row level security', t); end loop; end $$;

-- profiles: own row only (update own name/phone; role lives in store_members, never here)
create policy profiles_select on public.profiles for select using (id = auth.uid() or id in (select user_id from public.store_members where store_id in (select my_store_ids())));
create policy profiles_update on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- stores: members read; owners update; insert only via create_store() RPC
create policy stores_select on public.stores for select using (id in (select my_store_ids()));
create policy stores_update on public.stores for update using (is_store_member(id, array['owner']::member_role[]));

-- store_members: members read roster; ONLY owners manage, and a user cannot insert themselves
-- (prevents privilege self-assignment). Owner bootstrap happens inside create_store().
create policy members_select on public.store_members for select using (store_id in (select my_store_ids()));
create policy members_write on public.store_members for all
  using (is_store_member(store_id, array['owner']::member_role[]))
  with check (is_store_member(store_id, array['owner']::member_role[]) and user_id <> auth.uid());

-- settings: members read; owner/manager update
create policy settings_select on public.store_settings for select using (is_store_member(store_id));
create policy settings_update on public.store_settings for update using (is_store_member(store_id, array['owner','manager']::member_role[]));

-- categories/products: members read; owner/manager write
create policy categories_select on public.categories for select using (is_store_member(store_id));
create policy categories_write on public.categories for all using (is_store_member(store_id, array['owner','manager']::member_role[])) with check (is_store_member(store_id, array['owner','manager']::member_role[]));
create policy products_select on public.products for select using (is_store_member(store_id));
create policy products_write on public.products for all using (is_store_member(store_id, array['owner','manager']::member_role[])) with check (is_store_member(store_id, array['owner','manager']::member_role[]));

-- sales/payments/items: members read; NO direct insert/update/delete from the client.
-- Writes happen only through complete_checkout()/process_refund() (security definer).
create policy sales_select on public.sales for select using (is_store_member(store_id));
create policy sale_items_select on public.sale_items for select using (sale_id in (select id from public.sales where store_id in (select my_store_ids())));
create policy payments_select on public.payments for select using (sale_id in (select id from public.sales where store_id in (select my_store_ids())));
create policy movements_select on public.inventory_movements for select using (is_store_member(store_id));
create policy refunds_select on public.refunds for select using (is_store_member(store_id));
create policy refund_items_select on public.refund_items for select using (refund_id in (select id from public.refunds where store_id in (select my_store_ids())));

-- Storage: product-images bucket, members of the owning store may read; owner/manager write.
insert into storage.buckets (id, name, public) values ('product-images','product-images', false) on conflict do nothing;
create policy product_images_read on storage.objects for select to authenticated using (bucket_id='product-images' and (storage.foldername(name))[1] in (select my_store_ids()::text));
create policy product_images_write on storage.objects for insert with check (bucket_id='product-images' and auth.uid() is not null);

-- ============ CHECKOUT / REFUND / STOCK RPCs =============
-- Atomic business operations. Each function is ONE transaction: if any check
-- fails, everything rolls back. Totals are recomputed server-side from product
-- prices + store_settings; client-supplied totals are never trusted.

create or replace function complete_checkout(
  p_store_id uuid, p_idempotency_key text,
  p_items jsonb,               -- [{"product_id":"...","quantity":2}]
  p_discount_amount numeric default 0,
  p_payment_method payment_method default 'cash',
  p_amount_received numeric default null,
  p_external_reference text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_role member_role; v_settings record; v_sale public.sales; v_existing public.sales;
  v_subtotal numeric := 0; v_tax numeric; v_total numeric; v_change numeric := null;
  v_item jsonb; v_product public.products; v_line numeric; v_allowed_discount numeric;
begin
  select role into v_role from store_members where store_id=p_store_id and user_id=auth.uid();
  if v_role is null then raise exception 'Not a member of this store'; end if;

  -- Idempotency: a retry with the same key returns the original sale, no double charge/stock hit.
  select * into v_existing from sales where store_id=p_store_id and idempotency_key=p_idempotency_key;
  if found then return jsonb_build_object('sale_id', v_existing.id, 'receipt_number', v_existing.receipt_number, 'total', v_existing.total, 'idempotent_replay', true); end if;

  if jsonb_array_length(p_items) = 0 then raise exception 'Cart is empty'; end if;
  select * into v_settings from store_settings where store_id=p_store_id;

  -- Lock rows in a stable order to prevent deadlocks / oversell under concurrency.
  perform 1 from products where store_id=p_store_id
    and id in (select (e->>'product_id')::uuid from jsonb_array_elements(p_items) e)
    order by id for update;

  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_product from products where id=(v_item->>'product_id')::uuid and store_id=p_store_id;
    if not found or not v_product.is_active then raise exception 'Product unavailable: %', v_item->>'product_id'; end if;
    if (v_item->>'quantity')::int <= 0 then raise exception 'Invalid quantity for %', v_product.name; end if;
    if not v_settings.allow_negative_stock and v_product.stock_quantity < (v_item->>'quantity')::int
      then raise exception 'Insufficient stock for % (have %, need %)', v_product.name, v_product.stock_quantity, v_item->>'quantity'; end if;
    v_subtotal := v_subtotal + v_product.selling_price * (v_item->>'quantity')::int;
  end loop;

  -- Discount authorization: cashiers limited by settings; % cap enforced server-side.
  v_allowed_discount := v_subtotal * (case when v_role='cashier' then v_settings.cashier_max_discount_percent else v_settings.max_discount_percent end) / 100;
  if p_discount_amount < 0 or p_discount_amount > v_allowed_discount then raise exception 'Discount exceeds your authorized limit'; end if;

  v_tax := case when v_settings.tax_inclusive then 0 else round((v_subtotal - p_discount_amount) * v_settings.tax_rate, 2) end;
  v_total := v_subtotal - p_discount_amount + v_tax;
  if p_payment_method='cash' then
    if p_amount_received is null or p_amount_received < v_total then raise exception 'Amount received is less than total'; end if;
    v_change := p_amount_received - v_total;
  end if;

  insert into sales(store_id, receipt_number, cashier_id, subtotal, discount_amount, tax_amount, total, idempotency_key)
  values (p_store_id, gen_receipt_number(p_store_id), auth.uid(), v_subtotal, p_discount_amount, v_tax, v_total, p_idempotency_key)
  returning * into v_sale;

  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_product from products where id=(v_item->>'product_id')::uuid;
    v_line := v_product.selling_price * (v_item->>'quantity')::int;
    insert into sale_items(sale_id, product_id, product_name, unit_price, quantity, line_total)
    values (v_sale.id, v_product.id, v_product.name, v_product.selling_price, (v_item->>'quantity')::int, v_line);
    update products set stock_quantity = stock_quantity - (v_item->>'quantity')::int where id=v_product.id;
    insert into inventory_movements(store_id, product_id, type, quantity_change, stock_after, reference_id, created_by)
    values (p_store_id, v_product.id, 'sale', -(v_item->>'quantity')::int, v_product.stock_quantity - (v_item->>'quantity')::int, v_sale.id, auth.uid());
  end loop;

  -- Card = recorded as externally processed / manual. No card data is accepted or stored.
  insert into payments(sale_id, method, status, amount, amount_received, change_due, external_reference)
  values (v_sale.id, p_payment_method, 'paid', v_total, p_amount_received, v_change, p_external_reference);

  return jsonb_build_object('sale_id', v_sale.id, 'receipt_number', v_sale.receipt_number, 'subtotal', v_subtotal, 'discount', p_discount_amount, 'tax', v_tax, 'total', v_total, 'change_due', v_change, 'idempotent_replay', false);
end $$;

create or replace function adjust_stock(p_product_id uuid, p_change int, p_reason text, p_type movement_type default 'adjustment')
returns int language plpgsql security definer set search_path = public as $$
declare v_product public.products; v_new int;
begin
  select * into v_product from products where id=p_product_id for update;
  if not found then raise exception 'Product not found'; end if;
  if not is_store_member(v_product.store_id, array['owner','manager']::member_role[]) then raise exception 'Only owner/manager can adjust stock'; end if;
  v_new := v_product.stock_quantity + p_change;
  if v_new < 0 then raise exception 'Stock cannot go negative'; end if;
  update products set stock_quantity=v_new where id=p_product_id;
  insert into inventory_movements(store_id, product_id, type, quantity_change, stock_after, reason, created_by)
  values (v_product.store_id, p_product_id, p_type, p_change, v_new, p_reason, auth.uid());
  return v_new;
end $$;

create or replace function process_refund(p_sale_id uuid, p_items jsonb, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_sale public.sales; v_refund public.refunds; v_item jsonb; v_si public.sale_items; v_total numeric := 0; v_amount numeric;
begin
  select * into v_sale from sales where id=p_sale_id for update;
  if not found then raise exception 'Sale not found'; end if;
  if not is_store_member(v_sale.store_id, array['owner','manager']::member_role[]) then raise exception 'Only owner/manager can issue refunds'; end if;
  if v_sale.status='voided' then raise exception 'Cannot refund a voided sale'; end if;
  create temp table _calc(amount numeric) on commit drop;
  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_si from sale_items where id=(v_item->>'sale_item_id')::uuid and sale_id=p_sale_id for update;
    if not found then raise exception 'Sale item not found'; end if;
    if v_si.refunded_quantity + (v_item->>'quantity')::int > v_si.quantity then raise exception 'Refund quantity exceeds sold quantity for %', v_si.product_name; end if;
    insert into _calc values (v_si.unit_price * (v_item->>'quantity')::int);
  end loop;
  select coalesce(sum(amount),0) into v_total from _calc;
  insert into refunds(store_id, sale_id, processed_by, reason, total_refunded) values (v_sale.store_id, p_sale_id, auth.uid(), p_reason, v_total) returning * into v_refund;
  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_si from sale_items where id=(v_item->>'sale_item_id')::uuid;
    v_amount := v_si.unit_price * (v_item->>'quantity')::int;
    insert into refund_items(refund_id, sale_item_id, quantity, amount) values (v_refund.id, v_si.id, (v_item->>'quantity')::int, v_amount);
    update sale_items set refunded_quantity = refunded_quantity + (v_item->>'quantity')::int where id=v_si.id;
    if v_si.product_id is not null then
      update products set stock_quantity = stock_quantity + (v_item->>'quantity')::int where id=v_si.product_id returning stock_quantity into v_amount;
      insert into inventory_movements(store_id, product_id, type, quantity_change, stock_after, reference_id, created_by)
      values (v_sale.store_id, v_si.product_id, 'refund', (v_item->>'quantity')::int, (select stock_quantity from products where id=v_si.product_id), v_refund.id, auth.uid());
    end if;
  end loop;
  update sales set status = case when not exists (select 1 from sale_items where sale_id=p_sale_id and refunded_quantity < quantity) then 'refunded'::sale_status else 'partially_refunded'::sale_status end where id=p_sale_id;
  update payments set status='refunded' where sale_id=p_sale_id;
  return jsonb_build_object('refund_id', v_refund.id, 'total_refunded', v_total);
end $$;

create or replace function get_dashboard_stats(p_store_id uuid, p_day date default current_date)
returns jsonb language plpgsql security definer set search_path = public stable as $$
begin
  if not is_store_member(p_store_id) then raise exception 'Not a member of this store'; end if;
  return jsonb_build_object(
    'today_sales', coalesce((select sum(total) from sales where store_id=p_store_id and created_at::date=p_day and status<>'voided'),0),
    'today_transactions', (select count(*) from sales where store_id=p_store_id and created_at::date=p_day and status<>'voided'),
    'total_products', (select count(*) from products where store_id=p_store_id and is_active),
    'low_stock_count', (select count(*) from products where store_id=p_store_id and is_active and stock_quantity <= low_stock_threshold),
    'week_sales', coalesce((select sum(total) from sales where store_id=p_store_id and created_at >= p_day - 6 and status<>'voided'),0),
    'month_sales', coalesce((select sum(total) from sales where store_id=p_store_id and date_trunc('month', created_at)=date_trunc('month', p_day::timestamptz) and status<>'voided'),0)
  );
end $$;
revoke all on function complete_checkout(uuid,text,jsonb,numeric,payment_method,numeric,text) from public;
grant execute on function complete_checkout(uuid,text,jsonb,numeric,payment_method,numeric,text) to authenticated;
grant execute on function adjust_stock(uuid,int,text,movement_type) to authenticated;
grant execute on function process_refund(uuid,jsonb,text) to authenticated;
grant execute on function create_store(text,text,text,text) to authenticated;
grant execute on function get_dashboard_stats(uuid,date) to authenticated;
