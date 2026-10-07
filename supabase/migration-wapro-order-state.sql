-- Stan realizacji ZO odczytany z WAPRO (agent aktualizuje co ~10 min)
-- Dashboard -> SQL Editor -> Run
alter table public.wapro_order_requests
  add column if not exists wapro_state text
    check (wapro_state in ('new', 'partial', 'realized', 'deleted')),
  add column if not exists wapro_realized_pct numeric,
  add column if not exists wapro_raw text,
  add column if not exists wapro_checked_at timestamptz;
