-- Wspólny rejestr producentów (marek) katalogu + ich profile (logo, opis, kontakt).
-- Uzupełnia listę z WAPRO o producentów dodanych ręcznie lub pobranych z BaseLinkera.
-- Supabase Dashboard -> SQL Editor -> Run. Można uruchamiać wielokrotnie.

create table if not exists public.catalog_manufacturers (
  name_key text primary key,                 -- nazwa małymi literami (unikalność bez względu na wielkość liter)
  name text not null,
  source text not null default 'manual',     -- manual | baselinker | wapro
  bl_manufacturer_id bigint,                 -- id producenta w BaseLinkerze (gdy znany)
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

-- profil producenta
alter table public.catalog_manufacturers add column if not exists logo_url text;
alter table public.catalog_manufacturers add column if not exists description text;
alter table public.catalog_manufacturers add column if not exists website text;
alter table public.catalog_manufacturers add column if not exists email text;
alter table public.catalog_manufacturers add column if not exists phone text;
alter table public.catalog_manufacturers add column if not exists notes text;
alter table public.catalog_manufacturers add column if not exists removed boolean not null default false;
alter table public.catalog_manufacturers add column if not exists updated_at timestamptz not null default now();

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
  for delete to authenticated using (true);

-- uprawnienia dla zalogowanych (bez tego baza zwraca "permission denied")
grant select, insert, update, delete on public.catalog_manufacturers to authenticated;
grant select, insert, update, delete on public.catalog_manufacturers to service_role;
