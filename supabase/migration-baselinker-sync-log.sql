-- BaseLinker: historia wysylek (log) + cache ceny BL w baselinker_links.
-- Dashboard -> SQL Editor -> Run
-- Wymaga wczesniej: migration-baselinker.sql oraz public.is_admin()

alter table public.baselinker_links
  add column if not exists bl_price_gross numeric;

create table if not exists public.baselinker_sync_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  trigger text not null default 'manual',      -- manual | auto
  user_label text not null default '',
  field text not null default '',              -- stock | price | stock+price
  requested integer not null default 0,
  updated integer not null default 0,
  skipped integer not null default 0,
  status text not null default 'ok',           -- ok | warning | error | blocked
  note text not null default '',
  sample jsonb
);

create index if not exists baselinker_sync_log_created_idx
  on public.baselinker_sync_log (created_at desc);

alter table public.baselinker_sync_log enable row level security;

drop policy if exists "baselinker_sync_log_select_admin" on public.baselinker_sync_log;
create policy "baselinker_sync_log_select_admin"
  on public.baselinker_sync_log for select
  to authenticated
  using (public.is_admin());

grant select on public.baselinker_sync_log to authenticated;
grant all on public.baselinker_sync_log to service_role;
