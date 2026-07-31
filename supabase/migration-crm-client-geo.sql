-- CRM: współrzędne klientów (mapa + trasy)
-- Dashboard → SQL Editor → Run

alter table public.crm_clients
  add column if not exists lat double precision,
  add column if not exists lng double precision;

create index if not exists crm_clients_user_geo_idx
  on public.crm_clients (user_id)
  where lat is not null and lng is not null;
