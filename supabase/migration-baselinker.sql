-- BaseLinker: mapowanie SKU katalogu -> ID produktu w BaseLinker (cache, odswiezane akcja "compare").
-- Dashboard -> SQL Editor -> Run
-- Zapisuje wylacznie Edge Function `baselinker` (service_role); odczyt dla zalogowanych.

create table if not exists public.baselinker_links (
  sku text primary key,
  bl_product_id bigint not null,
  bl_sku text,
  bl_name text,
  bl_stock numeric,
  checked_at timestamptz not null default now()
);

create index if not exists baselinker_links_bl_id_idx on public.baselinker_links (bl_product_id);

alter table public.baselinker_links enable row level security;

drop policy if exists "baselinker_links_select_auth" on public.baselinker_links;
create policy "baselinker_links_select_auth"
  on public.baselinker_links for select
  to authenticated
  using (true);

grant select on public.baselinker_links to authenticated;
grant all on public.baselinker_links to service_role;
