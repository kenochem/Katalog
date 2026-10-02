-- Zlecenia utworzenia zamówienia ZO w WAPRO Mag (jak WFSync, ale z katalogu)
-- Dashboard → SQL Editor → Run

create table if not exists public.wapro_order_requests (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'pending'
    check (status in ('pending', 'running', 'done', 'error')),
  requested_by uuid references auth.users (id) on delete set null,
  requested_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  message text,
  -- payload: { clientName, clientNip?, note?, kind?, items:[{sku,qty,priceSaleNet?,priceSaleGross?,discountPercent?,displayName?}] }
  payload jsonb not null default '{}'::jsonb,
  wapro_order_id numeric,
  wapro_order_number text
);

create index if not exists wapro_order_requests_status_idx
  on public.wapro_order_requests (status, requested_at);

alter table public.wapro_order_requests enable row level security;

drop policy if exists "wapro_order_insert_auth" on public.wapro_order_requests;
create policy "wapro_order_insert_auth"
  on public.wapro_order_requests for insert
  to authenticated
  with check (true);

drop policy if exists "wapro_order_select_auth" on public.wapro_order_requests;
create policy "wapro_order_select_auth"
  on public.wapro_order_requests for select
  to authenticated
  using (true);

-- Update status robi agent (service_role)
