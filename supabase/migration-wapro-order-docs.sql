-- Numery dokumentow (WZ / faktura) powiazanych z ZO, odczytane z WAPRO przez agenta
-- Dashboard -> SQL Editor -> Run
alter table public.wapro_order_requests
  add column if not exists wapro_docs text;
