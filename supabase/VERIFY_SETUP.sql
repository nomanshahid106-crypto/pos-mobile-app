-- Run in SQL Editor AFTER COMBINED_SETUP.sql. Expect:
-- 12 tables, RLS = true on all of them, 6 functions listed.
select count(*) as tables_expect_12 from information_schema.tables
 where table_schema='public' and table_name in ('profiles','stores','store_members','store_settings','categories','products','sales','sale_items','payments','inventory_movements','refunds','refund_items');

select tablename, rowsecurity as rls_enabled from pg_tables where schemaname='public' order by tablename;

select routine_name from information_schema.routines where routine_schema='public'
 and routine_name in ('complete_checkout','process_refund','adjust_stock','create_store','get_dashboard_stats','handle_new_user') order by 1;
-- expect 6 rows
