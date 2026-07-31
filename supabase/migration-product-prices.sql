-- Ceny z WAPRO na produktach
-- Dashboard → SQL Editor → Run (bezpieczne: IF NOT EXISTS)

alter table public.products
  add column if not exists price_purchase_net numeric null;

alter table public.products
  add column if not exists price_sale_net numeric null;

alter table public.products
  add column if not exists price_sale_gross numeric null;

comment on column public.products.price_purchase_net is 'Cena zakupu netto z WAPRO';
comment on column public.products.price_sale_net is 'Cena sprzedaży netto z WAPRO';
comment on column public.products.price_sale_gross is 'Cena sprzedaży brutto z WAPRO (sklep / klient)';
