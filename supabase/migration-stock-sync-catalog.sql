-- Zakres syncu WAPRO: accessories | shop | all (null = all dla starych zleceń)
alter table public.stock_sync_requests
  add column if not exists catalog text null;

comment on column public.stock_sync_requests.catalog is
  'Zakres: accessories | shop | all (null traktowane jak all)';
