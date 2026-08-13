-- Profil (avatar, preferencje), macierz ról, widoczność profili w zespole
-- Supabase Dashboard → SQL Editor → Run (po migration-user-sync-all.sql)

grant usage on schema public to anon, authenticated, service_role;

-- === profiles: avatar + preferencje JSON ===
alter table public.profiles
  add column if not exists avatar_url text;

alter table public.profiles
  add column if not exists user_preferences jsonb not null default '{}'::jsonb;

-- Zespół: aktywne profile widoczne dla zalogowanych (avatar, czat, imię)
drop policy if exists "profiles_select_active_team" on public.profiles;
create policy "profiles_select_active_team"
  on public.profiles for select
  to authenticated
  using (active = true);

-- === macierz uprawnień (wspólna dla całej organizacji) ===
create table if not exists public.app_role_matrix (
  id text primary key,
  matrix jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

insert into public.app_role_matrix (id, matrix)
values ('default', '{}'::jsonb)
on conflict (id) do nothing;

alter table public.app_role_matrix enable row level security;

drop policy if exists "role_matrix_select_authenticated" on public.app_role_matrix;
create policy "role_matrix_select_authenticated"
  on public.app_role_matrix for select
  to authenticated
  using (true);

drop policy if exists "role_matrix_upsert_admin" on public.app_role_matrix;
create policy "role_matrix_upsert_admin"
  on public.app_role_matrix for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "role_matrix_update_admin" on public.app_role_matrix;
create policy "role_matrix_update_admin"
  on public.app_role_matrix for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "role_matrix_delete_admin" on public.app_role_matrix;
create policy "role_matrix_delete_admin"
  on public.app_role_matrix for delete
  to authenticated
  using (public.is_admin());

grant select on public.app_role_matrix to authenticated;
grant insert, update, delete on public.app_role_matrix to authenticated;
grant all on public.app_role_matrix to service_role;

notify pgrst, 'reload schema';
