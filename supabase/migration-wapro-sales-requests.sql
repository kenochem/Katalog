-- Statystyki sprzedaży WAPRO na żądanie (zakładka w podglądzie produktu)
-- Dashboard → SQL Editor → Run

create table if not exists public.wapro_sales_requests (
  id uuid primary key default gen_random_uuid(),
  sku text not null,
  product_id text,
  status text not null default 'pending'
    check (status in ('pending', 'running', 'done', 'error')),
  requested_by uuid references auth.users (id) on delete set null,
  requested_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  result jsonb,
  message text
);

create index if not exists wapro_sales_requests_status_idx
  on public.wapro_sales_requests (status, requested_at desc);

create index if not exists wapro_sales_requests_sku_idx
  on public.wapro_sales_requests (sku, requested_at desc);

alter table public.wapro_sales_requests enable row level security;

drop policy if exists "wapro_sales_insert_auth" on public.wapro_sales_requests;
create policy "wapro_sales_insert_auth"
  on public.wapro_sales_requests for insert
  to authenticated
  with check (true);

drop policy if exists "wapro_sales_select_auth" on public.wapro_sales_requests;
create policy "wapro_sales_select_auth"
  on public.wapro_sales_requests for select
  to authenticated
  using (true);

-- Update status + result: agent na serwerze (service_role)
