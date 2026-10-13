-- Alerty systemowe + historia dostepnosci agentow (Logi -> Status systemow)
-- Dashboard -> SQL Editor -> Run  (po migration-system-status.sql)

-- Aktywne i zamkniete alerty (tworzy je funkcja system-alerts; kazdy klucz = jedno zdarzenie do obslugi)
create table if not exists public.system_alerts (
  id uuid primary key default gen_random_uuid(),
  key text not null,                         -- np. agent-stock-down, error-baselinker, orders-stuck
  level text not null default 'error' check (level in ('info', 'warning', 'error')),
  title text not null default '',
  message text not null default '',
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  resolved_at timestamptz,                   -- puste = alert nadal aktywny
  ack_by text,                               -- kto kliknal "Przyjalem"
  ack_at timestamptz,
  notified_at timestamptz                    -- kiedy poszlo powiadomienie na Discord
);

create index if not exists system_alerts_active_idx on public.system_alerts (key) where resolved_at is null;
create index if not exists system_alerts_seen_idx on public.system_alerts (last_seen desc);

-- Dostepnosc agentow: jeden wiersz na agenta na 15-minutowy przedzial, w ktorym agent dal znak zycia
create table if not exists public.agent_uptime (
  agent text not null,
  bucket timestamptz not null,
  primary key (agent, bucket)
);

alter table public.system_alerts enable row level security;
alter table public.agent_uptime enable row level security;

drop policy if exists "system_alerts_select_auth" on public.system_alerts;
create policy "system_alerts_select_auth" on public.system_alerts for select to authenticated using (true);

-- potwierdzenie ("Przyjalem") z aplikacji
drop policy if exists "system_alerts_update_auth" on public.system_alerts;
create policy "system_alerts_update_auth" on public.system_alerts for update to authenticated using (true) with check (true);

drop policy if exists "agent_uptime_select_auth" on public.agent_uptime;
create policy "agent_uptime_select_auth" on public.agent_uptime for select to authenticated using (true);

-- ---------------------------------------------------------------------------------------------
-- OPCJONALNIE: sprawdzanie alertow co 5 min takze gdy nikt nie ma otwartej aplikacji (Discord 24/7).
-- Wymaga wlaczonych rozszerzen pg_cron i pg_net (Dashboard -> Database -> Extensions).
-- Podstaw swoj adres projektu i klucz service_role, potem uruchom OSOBNO (klucz jest tajny!):
--
--   select cron.schedule('system-alerts-check', '*/5 * * * *', $$
--     select net.http_post(
--       url := 'https://TWOJ-PROJEKT.supabase.co/functions/v1/system-alerts',
--       headers := jsonb_build_object('Content-Type', 'application/json',
--                                     'Authorization', 'Bearer TWOJ_SERVICE_ROLE_KEY'),
--       body := '{"action":"check"}'::jsonb
--     );
--   $$);
-- ---------------------------------------------------------------------------------------------
