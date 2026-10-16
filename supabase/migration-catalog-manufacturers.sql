-- Wspólny rejestr producentów (marek) katalogu: uzupełnia listę z WAPRO o producentów dodanych ręcznie
-- lub pobranych z BaseLinkera. Supabase Dashboard -> SQL Editor -> Run.

create table if not exists public.catalog_manufacturers (
  name_key text primary key,                 -- nazwa małymi literami (unikalność bez względu na wielkość liter)
  name text not null,
  source text not null default 'manual',     -- manual | baselinker
  bl_manufacturer_id bigint,                 -- id producenta w BaseLinkerze (gdy znany)
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.catalog_manufacturers enable row level security;

drop policy if exists "catalog_manufacturers_select" on public.catalog_manufacturers;
create policy "catalog_manufacturers_select" on public.catalog_manufacturers
  for select to authenticated using (true);

drop policy if exists "catalog_manufacturers_insert" on public.catalog_manufacturers;
create policy "catalog_manufacturers_insert" on public.catalog_manufacturers
  for insert to authenticated with check (true);

drop policy if exists "catalog_manufacturers_update" on public.catalog_manufacturers;
create policy "catalog_manufacturers_update" on public.catalog_manufacturers
  for update to authenticated using (true);

drop policy if exists "catalog_manufacturers_delete" on public.catalog_manufacturers;
create policy "catalog_manufacturers_delete" on public.catalog_manufacturers
  for delete to authenticated using (public.is_admin());
