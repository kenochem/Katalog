-- Warstwa techniczna produktow (nyple, trojniki, kolanka, redukcje, dysze): typ, parametry, nazwa katalogowa, aliasy.
-- Nazwy z WAPRO zostaja nietkniete - tu trzymamy tylko zatwierdzone / poprawione opisy techniczne.
-- Dashboard -> SQL Editor -> Run

create table if not exists public.product_tech (
  sku text primary key,                       -- SKU z WAPRO (wielkie litery)
  type text not null,                         -- nypel | trojnik | kolanko | redukcja | dysza
  subtype text not null default '',
  attrs jsonb not null default '{}'::jsonb,   -- koncowki (gwinty), material, otwor, kod, ...
  display_name text not null default '',      -- nazwa katalogowa zlozona z parametrow
  aliases text[] not null default '{}',       -- dodatkowe frazy do wyszukiwania ("po waprowemu")
  status text not null default 'approved'
    check (status in ('approved', 'rejected')),  -- rejected = to nie jest element techniczny tego typu
  updated_by text not null default '',
  updated_at timestamptz not null default now()
);

create index if not exists product_tech_type_idx on public.product_tech (type, subtype);

alter table public.product_tech enable row level security;

drop policy if exists "product_tech_all_auth" on public.product_tech;
create policy "product_tech_all_auth" on public.product_tech
  for all to authenticated using (true) with check (true);
