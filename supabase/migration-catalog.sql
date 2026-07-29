-- Uruchom w Supabase SQL Editor
alter table products add column if not exists catalog text not null default 'accessories';
create index if not exists products_catalog_idx on products (catalog);
