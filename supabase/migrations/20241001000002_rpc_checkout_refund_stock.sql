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
