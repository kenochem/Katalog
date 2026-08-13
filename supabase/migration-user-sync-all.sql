-- Pełna synchronizacja użytkownika: ulubione + foldery + lokalizacja
-- Wklej w Supabase Dashboard → SQL Editor → Run (raz).

grant usage on schema public to anon, authenticated, service_role;

-- === user_favorites ===
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
  on public.user_favorites for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "user_favorites_insert_own" on public.user_favorites;
create policy "user_favorites_insert_own"
  on public.user_favorites for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "user_favorites_delete_own" on public.user_favorites;
create policy "user_favorites_delete_own"
  on public.user_favorites for delete to authenticated
  using (user_id = auth.uid());

drop policy if exists "user_favorites_update_own" on public.user_favorites;
create policy "user_favorites_update_own"
  on public.user_favorites for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, update, delete on public.user_favorites to authenticated;
grant select, insert, update, delete on public.user_favorites to service_role;

-- === product_collections ===
create table if not exists public.product_collections (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  note text not null default '',
  intent text not null default 'general',
  product_ids jsonb not null default '[]'::jsonb,
  created_at bigint not null,
  updated_at bigint not null
);

create index if not exists product_collections_user_idx
  on public.product_collections (user_id, updated_at desc);

alter table public.product_collections enable row level security;

drop policy if exists "collections_own_select" on public.product_collections;
drop policy if exists "collections_own_all" on public.product_collections;

create policy "collections_own_select"
  on public.product_collections for select
  using (auth.uid() = user_id);

create policy "collections_own_insert"
  on public.product_collections for insert
  with check (auth.uid() = user_id);

create policy "collections_own_update"
  on public.product_collections for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "collections_own_delete"
  on public.product_collections for delete
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.product_collections to authenticated;
grant select, insert, update, delete on public.product_collections to service_role;

-- === warehouse_location on products ===
alter table public.products
  add column if not exists warehouse_location jsonb;

notify pgrst, 'reload schema';
