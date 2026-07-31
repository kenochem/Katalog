-- Tagi produktów (np. Sonax = dziedziczony katalog sonax.sklep.pl)
-- Dashboard → SQL Editor → Run (bezpieczne: IF NOT EXISTS)

alter table public.products
  add column if not exists tags jsonb not null default '[]'::jsonb;

comment on column public.products.tags is 'Tagi źródła/oznaczenia, np. ["Sonax"]';
