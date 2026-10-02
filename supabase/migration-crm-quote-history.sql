-- CRM: historia wygenerowanych ofert (per uzytkownik, RLS jak crm_orders).
-- Dashboard -> SQL Editor -> Run
-- Wymaga wczesniej: migration-crm-clients-orders.sql

alter table public.crm_orders
  add column if not exists quote_number text,
  add column if not exists quote_html text,
  add column if not exists quote_total_net numeric,
  add column if not exists quote_total_gross numeric,
  add column if not exists quote_meta jsonb;

create index if not exists crm_orders_user_quote_idx
  on public.crm_orders (user_id, created_at desc)
  where kind = 'quote';
