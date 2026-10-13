-- Status systemow i zdarzenia serwerowe (strona Logi -> Status systemow)
-- Dashboard -> SQL Editor -> Run

-- Zdarzenia zapisywane przez agentow na serwerze WAPRO (kazdy przebieg, takze automatyczny)
create table if not exists public.system_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  source text not null,                  -- stock | sales | orders | reserved | promotions | system
  kind text not null default '',         -- np. sync-auto, sync-manual, sync-error, reserved-sync, promo-tick
  level text not null default 'info'
    check (level in ('info', 'success', 'warning', 'error')),
  title text not null default '',
  message text not null default '',
  details jsonb not null default '{}'::jsonb
);

create index if not exists system_events_created_idx on public.system_events (created_at desc);
create index if not exists system_events_source_idx on public.system_events (source, created_at desc);

-- Sygnal "agent zyje": jeden wiersz na agenta, aktualizowany przy kazdym uruchomieniu zadania
create table if not exists public.agent_heartbeats (
  agent text primary key,                -- stock | orders
  last_run_at timestamptz not null default now(),
  last_ok_at timestamptz,
  last_status text not null default 'ok',
  message text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.system_events enable row level security;
alter table public.agent_heartbeats enable row level security;

drop policy if exists "system_events_select_auth" on public.system_events;
create policy "system_events_select_auth" on public.system_events
  for select to authenticated using (true);

drop policy if exists "agent_heartbeats_select_auth" on public.agent_heartbeats;
create policy "agent_heartbeats_select_auth" on public.agent_heartbeats
  for select to authenticated using (true);

-- Zapis robi agent kluczem service_role (omija RLS). Porzadki (opcjonalnie, np. raz w miesiacu):
--   delete from public.system_events where created_at < now() - interval '90 days';
