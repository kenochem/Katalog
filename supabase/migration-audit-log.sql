-- Dziennik aktywnosci uzytkownikow (audit log): kto, co i kiedy zmienil.
-- Dashboard -> SQL Editor -> Run
-- Wymaga wczesniej: public.is_admin() (migration-auth-profiles.sql / migration-user-cloud-platform.sql)
--
-- Zasady:
--  * kazdy zalogowany moze DOPISAC wpis tylko jako on sam (user_id = auth.uid())
--  * ODCZYT tylko dla admina
--  * brak UPDATE/DELETE z aplikacji - wpisy sa niezmienne

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null references auth.users (id) on delete cascade,
  user_label text not null default '',
  user_role text not null default '',
  app text not null default '',
  action text not null,
  entity_type text not null default '',
  entity_id text not null default '',
  entity_label text not null default '',
  summary text not null default '',
  changes jsonb
);

create index if not exists audit_log_created_idx on public.audit_log (created_at desc);
create index if not exists audit_log_user_idx on public.audit_log (user_id, created_at desc);
create index if not exists audit_log_entity_idx on public.audit_log (entity_id, created_at desc);
create index if not exists audit_log_action_idx on public.audit_log (action, created_at desc);

alter table public.audit_log enable row level security;

drop policy if exists "audit_log_insert_self" on public.audit_log;
create policy "audit_log_insert_self"
  on public.audit_log for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "audit_log_select_admin" on public.audit_log;
create policy "audit_log_select_admin"
  on public.audit_log for select
  to authenticated
  using (public.is_admin());

grant select, insert on public.audit_log to authenticated;
grant select, insert, delete on public.audit_log to service_role;

-- Opcjonalnie (rzadko): czyszczenie wpisow starszych niz 18 miesiecy - uruchamiane recznie jako admin w SQL Editor:
--   delete from public.audit_log where created_at < now() - interval '18 months';
