-- Foldery robocze (zbiory produktów pod tagi sklepu, zdjęcia itd.)
-- Uruchom w Supabase SQL Editor (opcjonalnie — bez tego działa localStorage).

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

create policy "collections_own_select"
  on public.product_collections for select
  using (auth.uid() = user_id);

create policy "collections_own_all"
  on public.product_collections for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete on public.product_collections to authenticated;
grant select, insert, update, delete on public.product_collections to service_role;
