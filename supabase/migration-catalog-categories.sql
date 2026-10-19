-- Drzewo kategorii katalogu: kategorie dodane ręcznie oraz zmiany kategorii ze sklepu (przeniesienia, usunięcia).
-- Drzewo bazowe pochodzi ze sklepu (public/data/shop-category-tree.json); ta tabela przechowuje różnice,
-- wspólne dla wszystkich użytkowników. Supabase Dashboard -> SQL Editor -> Run (można uruchamiać wielokrotnie).

create table if not exists public.catalog_categories (
  name_key text primary key,                 -- nazwa małymi literami, bez podwójnych spacji
  name text not null,
  parent text,                               -- nazwa kategorii nadrzędnej; null = kategoria główna
  source text not null default 'custom',     -- custom = własna; shop = kategoria ze sklepu (przeniesiona / usunięta)
  removed boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.catalog_categories enable row level security;

drop policy if exists "catalog_categories_select" on public.catalog_categories;
create policy "catalog_categories_select" on public.catalog_categories
  for select to authenticated using (true);

drop policy if exists "catalog_categories_insert" on public.catalog_categories;
create policy "catalog_categories_insert" on public.catalog_categories
  for insert to authenticated with check (true);

drop policy if exists "catalog_categories_update" on public.catalog_categories;
create policy "catalog_categories_update" on public.catalog_categories
  for update to authenticated using (true);

drop policy if exists "catalog_categories_delete" on public.catalog_categories;
create policy "catalog_categories_delete" on public.catalog_categories
  for delete to authenticated using (true);

-- uprawnienia dla zalogowanych (bez tego baza zwraca "permission denied")
grant select, insert, update, delete on public.catalog_categories to authenticated;
grant select, insert, update, delete on public.catalog_categories to service_role;

notify pgrst, 'reload schema';
