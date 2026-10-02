-- Uruchom w Supabase SQL Editor
-- Przechowuje edytowalne nadpisania treści w "Katalogach marek" (Biblioteka →
-- Katalogi marek do druku: eco-shine.html, freshtek.html, kolejne...).
-- Domyślnie strona pokazuje opis i kategorię wbudowane w plik HTML; jeśli
-- istnieje zapisany wiersz dla danego (catalog_slug, sku), strona podmienia
-- opis i/lub kategorię na wartość z bazy. Pozwala to pracownikowi zmienić
-- opis produktu lub przenieść go do innej kategorii bez edycji kodu.

create table if not exists catalog_product_overrides (
  catalog_slug text not null,
  sku text not null,
  category text,
  description text,
  updated_at timestamptz not null default now(),
  updated_by text,
  primary key (catalog_slug, sku)
);

alter table catalog_product_overrides enable row level security;

drop policy if exists "public read catalog overrides" on catalog_product_overrides;
create policy "public read catalog overrides" on catalog_product_overrides
  for select using (true);

drop policy if exists "authenticated insert catalog overrides" on catalog_product_overrides;
create policy "authenticated insert catalog overrides" on catalog_product_overrides
  for insert with check (auth.role() = 'authenticated');

drop policy if exists "authenticated update catalog overrides" on catalog_product_overrides;
create policy "authenticated update catalog overrides" on catalog_product_overrides
  for update using (auth.role() = 'authenticated');
