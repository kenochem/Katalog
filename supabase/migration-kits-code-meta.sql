-- Zestawy: kod katalogowy (np. ZST-0001) i powiazanie z BaseLinkerem (meta: blId, blActive).
-- Dashboard -> SQL Editor -> Run

alter table public.kits add column if not exists code text;
alter table public.kits add column if not exists meta jsonb not null default '{}'::jsonb;

-- kod katalogowy jest unikalny (puste = jeszcze nie nadany)
create unique index if not exists kits_code_unique_idx on public.kits (code) where code is not null and code <> '';
