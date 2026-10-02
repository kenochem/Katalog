-- Globalne ustawienia aplikacji (feature flags), edytowalne przez admina w panelu.
-- Jeden wiersz 'default' z jsonb, np. { "crmMailEnabled": true }.
-- Supabase Dashboard -> SQL Editor -> Run (wymaga funkcji public.is_admin() z migration-user-cloud-platform.sql)

create table if not exists public.app_settings (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

insert into public.app_settings (id, data)
values ('default', '{}'::jsonb)
on conflict (id) do nothing;

alter table public.app_settings enable row level security;

drop policy if exists "app_settings_select_authenticated" on public.app_settings;
create policy "app_settings_select_authenticated"
  on public.app_settings for select
  to authenticated
  using (true);

drop policy if exists "app_settings_upsert_admin" on public.app_settings;
create policy "app_settings_upsert_admin"
  on public.app_settings for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "app_settings_update_admin" on public.app_settings;
create policy "app_settings_update_admin"
  on public.app_settings for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select on public.app_settings to authenticated;
grant insert, update on public.app_settings to authenticated;
grant all on public.app_settings to service_role;

notify pgrst, 'reload schema';
