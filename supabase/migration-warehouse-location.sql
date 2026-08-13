-- Lokalizacja magazynowa na karcie produktu (wspólna dla zespołu)
-- Supabase Dashboard → SQL Editor

alter table public.products
  add column if not exists warehouse_location jsonb;

comment on column public.products.warehouse_location is
  'Strefa/alejka/regał/półka/pojemnik — JSON { zone, aisle, rack, shelf, bin }';
