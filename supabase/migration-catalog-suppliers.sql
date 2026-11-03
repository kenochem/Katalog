-- Rejestr dostawców katalogu (od kogo mamy towar) + ich profile (kontakt, warunki).
-- Dostawca to nie producent: producent = marka na opakowaniu, dostawca = źródło w WAPRO.
-- Produkt wskazuje dostawcę nazwą w polu meta.supplier (docelowo wypełnianym z WAPRO).
-- Supabase Dashboard -> SQL Editor -> Run. Można uruchamiać wielokrotnie.

create table if not exists public.catalog_suppliers (
  name_key text primary key,                 -- nazwa małymi literami (unikalność bez względu na wielkość liter)
  name text not null,
  source text not null default 'manual',     -- manual | wapro | produkty
  wapro_code text,                           -- kod kontrahenta w WAPRO (gdy znany)
  nip text,
  website text,
  email text,
  phone text,
  contact_person text,
  lead_time_days integer,                    -- typowy czas dostawy
  min_order_net numeric,                     -- minimalne zamówienie netto
  notes text,
  removed boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.catalog_suppliers add column if not exists wapro_code text;
alter table public.catalog_suppliers add column if not exists nip text;
alter table public.catalog_suppliers add column if not exists contact_person text;
alter table public.catalog_suppliers add column if not exists lead_time_days integer;
alter table public.catalog_suppliers add column if not exists min_order_net numeric;

alter table public.catalog_suppliers enable row level security;

drop policy if exists "catalog_suppliers_select" on public.catalog_suppliers;
create policy "catalog_suppliers_select" on public.catalog_suppliers
  for select to authenticated using (true);

drop policy if exists "catalog_suppliers_insert" on public.catalog_suppliers;
create policy "catalog_suppliers_insert" on public.catalog_suppliers
  for insert to authenticated with check (true);

drop policy if exists "catalog_suppliers_update" on public.catalog_suppliers;
create policy "catalog_suppliers_update" on public.catalog_suppliers
  for update to authenticated using (true);

drop policy if exists "catalog_suppliers_delete" on public.catalog_suppliers;
create policy "catalog_suppliers_delete" on public.catalog_suppliers
  for delete to authenticated using (true);

grant select, insert, update, delete on public.catalog_suppliers to authenticated;
grant select, insert, update, delete on public.catalog_suppliers to service_role;
