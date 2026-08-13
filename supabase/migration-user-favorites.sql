-- Ulubione per użytkownik (Supabase Auth)
-- Dashboard → SQL Editor → Run

create table if not exists public.user_favorites (
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

create index if not exists user_favorites_user_idx
  on public.user_favorites (user_id, created_at desc);

alter table public.user_favorites enable row level security;

drop policy if exists "user_favorites_select_own" on public.user_favorites;
create policy "user_favorites_select_own"
  on public.user_favorites for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "user_favorites_insert_own" on public.user_favorites;
create policy "user_favorites_insert_own"
  on public.user_favorites for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "user_favorites_delete_own" on public.user_favorites;
create policy "user_favorites_delete_own"
  on public.user_favorites for delete
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "user_favorites_update_own" on public.user_favorites;
create policy "user_favorites_update_own"
  on public.user_favorites for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, update, delete on public.user_favorites to authenticated;
grant select, insert, update, delete on public.user_favorites to service_role;
