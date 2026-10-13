-- Centrum promocji: kampanie cenowe (daty od-do) i ceny promocyjne produktow
-- Dashboard -> SQL Editor -> Run

create table if not exists public.promo_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  note text not null default '',
  -- draft = szkic, scheduled = zatwierdzona (czeka na start), active = ceny wyslane do BaseLinkera, ended = zakonczona
  status text not null default 'draft'
    check (status in ('draft', 'scheduled', 'active', 'ended')),
  starts_at timestamptz,                 -- puste = start od razu po zatwierdzeniu
  ends_at timestamptz,                   -- puste = bezterminowo (do recznego zakonczenia)
  min_margin numeric,                    -- minimalna dopuszczalna marza % (ostrzezenie / pomijanie)
  created_by uuid references auth.users (id) on delete set null,
  created_by_label text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  applied_at timestamptz,                -- kiedy ceny poszly do BaseLinkera
  ended_at timestamptz,
  last_error text not null default ''
);

create table if not exists public.promo_items (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.promo_campaigns (id) on delete cascade,
  sku text not null,
  product_name text not null default '',
  vat numeric not null default 23,
  regular_gross numeric,                 -- cena zwykla brutto w chwili dodania (do przywrocenia po promocji)
  purchase_net numeric,                  -- cena zakupu netto w chwili dodania (do marzy)
  promo_gross numeric not null,          -- cena promocyjna brutto
  bl_state text not null default 'pending'
    check (bl_state in ('pending', 'applied', 'restored', 'error', 'skipped')),
  bl_error text not null default '',
  created_at timestamptz not null default now(),
  unique (campaign_id, sku)
);

create index if not exists promo_items_campaign_idx on public.promo_items (campaign_id);
create index if not exists promo_items_sku_idx on public.promo_items (sku);
create index if not exists promo_campaigns_status_idx on public.promo_campaigns (status, starts_at, ends_at);

alter table public.promo_campaigns enable row level security;
alter table public.promo_items enable row level security;

drop policy if exists "promo_campaigns_all_auth" on public.promo_campaigns;
create policy "promo_campaigns_all_auth" on public.promo_campaigns
  for all to authenticated using (true) with check (true);

drop policy if exists "promo_items_all_auth" on public.promo_items;
create policy "promo_items_all_auth" on public.promo_items
  for all to authenticated using (true) with check (true);
