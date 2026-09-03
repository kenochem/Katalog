-- CRM: tagi/segmentacja klientow (np. VIP, ryzykowny, nowy prospekt).
-- Dashboard -> SQL Editor -> Run

alter table public.crm_clients
  add column if not exists tags text[] not null default '{}';

create index if not exists crm_clients_tags_gin_idx
  on public.crm_clients using gin (tags);
