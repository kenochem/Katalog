-- Katalog Kenochem — uruchom w Supabase SQL Editor
-- Dashboard → SQL → New query → wklej i Run

create table if not exists products (
  id text primary key,
  sku text not null,
  name text not null,
  display_name text not null,
  category text not null default 'Inne części',
  manufacturer text not null default '',
  ean text not null default '',
  image_url text not null default '',
  custom_image_url text not null default '',
  description text not null default '',
  has_image boolean not null default false,
  stock numeric not null default 0,
  stock_manual boolean not null default false,
  extra_images jsonb not null default '[]',
  variants jsonb not null default '[]',
  is_group boolean not null default false,
  catalog text not null default 'accessories',
  created_at timestamptz not null default now(),
  unique (catalog, sku)
);

-- Migracja istniejącej bazy (uruchom jeśli tabela już istnieje):
-- alter table products add column if not exists variants jsonb not null default '[]';
-- alter table products add column if not exists is_group boolean not null default false;
-- alter table products add column if not exists stock numeric not null default 0;
-- alter table products add column if not exists stock_manual boolean not null default false;
-- alter table products add column if not exists extra_images jsonb not null default '[]';
-- alter table products add column if not exists catalog text not null default 'accessories';
-- alter table products drop constraint if exists products_sku_key;
-- alter table products add constraint products_catalog_sku_key unique (catalog, sku);

create index if not exists products_sku_idx on products (sku);
create index if not exists products_category_idx on products (category);
create index if not exists products_catalog_idx on products (catalog);

create table if not exists kits (
  id text primary key,
  name text not null,
  description text not null default '',
  category text not null default 'Zestawy',
  items jsonb not null default '[]',
  image_url text not null default '',
  created_at bigint not null
);

alter table products enable row level security;
alter table kits enable row level security;

create policy "products_select" on products for select using (true);
create policy "products_insert" on products for insert with check (true);
create policy "products_update" on products for update using (true);
create policy "products_delete" on products for delete using (true);

create policy "kits_select" on kits for select using (true);
create policy "kits_insert" on kits for insert with check (true);
create policy "kits_update" on kits for update using (true);
create policy "kits_delete" on kits for delete using (true);

-- === STORAGE (uruchom po utworzeniu bucketa "product-images" jako Public) ===
-- Dashboard → Storage → New bucket → product-images → Public: ON

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update set public = true;

create policy "storage_public_read" on storage.objects
  for select using (bucket_id = 'product-images');

create policy "storage_public_insert" on storage.objects
  for insert with check (bucket_id = 'product-images');

create policy "storage_public_update" on storage.objects
  for update using (bucket_id = 'product-images');

create policy "storage_public_delete" on storage.objects
  for delete using (bucket_id = 'product-images');
