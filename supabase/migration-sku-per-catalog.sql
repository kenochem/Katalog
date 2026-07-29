-- Uruchom w Supabase SQL Editor
-- SKU może się powtarzać między katalogami (accessories vs shop),
-- unikalność jest w ramach katalogu.

alter table products drop constraint if exists products_sku_key;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'products_catalog_sku_key'
  ) then
    alter table products
      add constraint products_catalog_sku_key unique (catalog, sku);
  end if;
end $$;

create index if not exists products_sku_idx on products (sku);
create index if not exists products_catalog_idx on products (catalog);
