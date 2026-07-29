-- Auth + profiles (Supabase Auth)
-- Dashboard → SQL Editor → Run
-- Potem: Authentication → Providers → Email ON
-- Authentication → Providers → Email → wyłącz "Allow new users to sign up"

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text not null,
  role text not null
    check (role in ('admin', 'operator', 'magazynier', 'handlowiec')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists profiles_role_idx on public.profiles (role);
create index if not exists profiles_active_idx on public.profiles (active);

alter table public.profiles enable row level security;

-- Helper: czy bieżący user jest aktywnym adminem
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and p.active = true
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin"
  on public.profiles for select
  to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_update_own_or_admin" on public.profiles;
create policy "profiles_update_own_or_admin"
  on public.profiles for update
  to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (
    (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()))
    or public.is_admin()
  );

-- Insert tylko przez trigger / service role (nie z klienta)
drop policy if exists "profiles_insert_admin" on public.profiles;
create policy "profiles_insert_admin"
  on public.profiles for insert
  to authenticated
  with check (public.is_admin());

-- Auto-profil przy tworzeniu usera (meta: display_name, role)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r text;
  dn text;
begin
  r := coalesce(nullif(new.raw_user_meta_data->>'role', ''), 'handlowiec');
  if r not in ('admin', 'operator', 'magazynier', 'handlowiec') then
    r := 'handlowiec';
  end if;
  dn := coalesce(
    nullif(new.raw_user_meta_data->>'display_name', ''),
    split_part(new.email, '@', 1)
  );
  insert into public.profiles (id, email, display_name, role, active)
  values (new.id, coalesce(new.email, ''), dn, r, true)
  on conflict (id) do update
    set email = excluded.email,
        display_name = coalesce(nullif(excluded.display_name, ''), profiles.display_name);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- TODO (follow-up): zaostrzyć products/kits insert/update do ról magazyn+/admin
-- Obecnie policies pozostają otwarte — ochrona edycji w UI.

-- Pierwszy admin (po utworzeniu usera w Dashboard → Authentication → Users):
-- update public.profiles set role = 'admin', display_name = 'Admin'
-- where email = 'twoj@email.pl';
