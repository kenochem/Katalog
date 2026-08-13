-- Cache statystyk sprzedaży WAPRO na produkcie (sync zbiorczy z Mag)
-- Dashboard → SQL Editor → Run

alter table public.products
  add column if not exists wapro_sales_stats jsonb;

alter table public.products
  add column if not exists wapro_sales_synced_at timestamptz;

comment on column public.products.wapro_sales_stats is
  'Agregat sprzedaży Mag: okresy 1/3/6/12 m (qty, netValue), lastSaleDate';

comment on column public.products.wapro_sales_synced_at is
  'Czas ostatniego sync sprzedaży z Mag WAPRO';
