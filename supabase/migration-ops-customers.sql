-- Operacje: wspolna baza kontrahentow/klientow z WAPRO.
-- Uruchom w Supabase SQL Editor, a potem wykonaj import:
--   py scripts/export-wapro-customers.py --file "C:\...\Kontrahenci.xls"
--   node --env-file=.env scripts/import-wapro-customers.mjs

create table if not exists public.ops_customers (
  id uuid primary key default gen_random_uuid(),
  wapro_id text not null,
  code text,
  name text not null,
  legal_name text,
  nip text,
  nip_normalized text,
  city text,
  postal_code text,
  street text,
  address text,
  country text,
  phone text,
  email text,
  payment_terms_days integer,
  credit_limit numeric(14, 2),
  balance numeric(14, 2),
  is_active boolean not null default true,
  source text not null default 'wapro',
  raw jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ops_customers_wapro_id_uidx
  on public.ops_customers (wapro_id);

create index if not exists ops_customers_name_idx
  on public.ops_customers (lower(name));

create index if not exists ops_customers_nip_idx
  on public.ops_customers (nip_normalized);

create index if not exists ops_customers_city_idx
  on public.ops_customers (lower(city));

create index if not exists ops_customers_synced_idx
  on public.ops_customers (synced_at desc);

alter table public.ops_customers enable row level security;

drop policy if exists "ops_customers_select_authenticated" on public.ops_customers;
create policy "ops_customers_select_authenticated"
  on public.ops_customers for select
  to authenticated
  using (true);

