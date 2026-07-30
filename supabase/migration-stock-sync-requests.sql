-- Zlecenia ręcznego syncu stanów WAPRO (przycisk w aplikacji)
-- Dashboard → SQL Editor → Run

create table if not exists public.stock_sync_requests (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'pending'
    check (status in ('pending', 'running', 'done', 'error')),
  requested_by uuid references auth.users (id) on delete set null,
  requested_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  message text
);

create index if not exists stock_sync_requests_status_idx
  on public.stock_sync_requests (status, requested_at);

alter table public.stock_sync_requests enable row level security;

drop policy if exists "stock_sync_insert_auth" on public.stock_sync_requests;
create policy "stock_sync_insert_auth"
  on public.stock_sync_requests for insert
  to authenticated
  with check (true);

drop policy if exists "stock_sync_select_auth" on public.stock_sync_requests;
create policy "stock_sync_select_auth"
  on public.stock_sync_requests for select
  to authenticated
  using (true);

-- Update status robi agent na serwerze (service_role) — bez policy dla authenticated update
