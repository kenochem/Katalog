-- Zarezerwowane sztuki produktu (R) — odczyt z WAPRO przez agenta zamowien (co ~5 min)
-- Dashboard -> SQL Editor -> Run
alter table public.products
  add column if not exists stock_reserved numeric not null default 0;
