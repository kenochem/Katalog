-- Kanal kampanii promocyjnej: baselinker (sklep internetowy) albo internal (wewnetrzna: tylko katalog i etykiety)
-- Dashboard -> SQL Editor -> Run
alter table public.promo_campaigns
  add column if not exists channel text not null default 'baselinker'
  check (channel in ('baselinker', 'internal'));
