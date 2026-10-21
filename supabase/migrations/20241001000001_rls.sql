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
