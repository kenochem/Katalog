-- Atrybuty strukturalne produktów (parametry): definicje (typ, jednostka, lista wartości, zakres kategorii).
-- Wartości atrybutów zapisujemy w product_meta produktu (klucz „attrs”), więc ta migracja dotyczy tylko definicji.
-- Supabase Dashboard -> SQL Editor -> Run (można uruchamiać wielokrotnie).

create table if not exists public.catalog_attributes (
  key text primary key,                      -- krótki identyfikator, np. pojemnosc
  label text not null,                       -- nazwa widoczna dla użytkownika, np. Pojemność
  type text not null default 'text',         -- text | number | select | bool
  unit text,                                 -- np. l, ml, kg
  options jsonb not null default '[]'::jsonb,-- lista wartości dla typu select
  categories jsonb not null default '[]'::jsonb, -- nazwy kategorii, w których atrybut obowiązuje (puste = wszystkie)
  required boolean not null default false,
  sort integer not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.catalog_attributes enable row level security;

drop policy if exists "catalog_attributes_select" on public.catalog_attributes;
create policy "catalog_attributes_select" on public.catalog_attributes for select to authenticated using (true);

drop policy if exists "catalog_attributes_insert" on public.catalog_attributes;
create policy "catalog_attributes_insert" on public.catalog_attributes for insert to authenticated with check (true);

drop policy if exists "catalog_attributes_update" on public.catalog_attributes;
create policy "catalog_attributes_update" on public.catalog_attributes for update to authenticated using (true);

drop policy if exists "catalog_attributes_delete" on public.catalog_attributes;
create policy "catalog_attributes_delete" on public.catalog_attributes for delete to authenticated using (true);

grant select, insert, update, delete on public.catalog_attributes to authenticated;
grant select, insert, update, delete on public.catalog_attributes to service_role;

notify pgrst, 'reload schema';
