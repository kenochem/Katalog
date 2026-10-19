-- Reguły jakości katalogu: „jeśli produkt spełnia warunki, to wykonaj akcję” (ustaw kategorię / producenta,
-- dodaj tag, ukryj, ustaw wyjątek). Reguły są wspólne dla zespołu i uruchamiane ręcznie z podglądem.
-- Supabase Dashboard -> SQL Editor -> Run (można uruchamiać wielokrotnie).

create table if not exists public.catalog_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  enabled boolean not null default true,
  conditions jsonb not null default '[]'::jsonb,   -- [{ field, op, value }]
  action jsonb not null default '{}'::jsonb,        -- { type, value / reason / kinds / note }
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_run_at timestamptz,
  last_run_count integer
);

alter table public.catalog_rules enable row level security;

drop policy if exists "catalog_rules_select" on public.catalog_rules;
create policy "catalog_rules_select" on public.catalog_rules for select to authenticated using (true);

drop policy if exists "catalog_rules_insert" on public.catalog_rules;
create policy "catalog_rules_insert" on public.catalog_rules for insert to authenticated with check (true);

drop policy if exists "catalog_rules_update" on public.catalog_rules;
create policy "catalog_rules_update" on public.catalog_rules for update to authenticated using (true);

drop policy if exists "catalog_rules_delete" on public.catalog_rules;
create policy "catalog_rules_delete" on public.catalog_rules for delete to authenticated using (true);

grant select, insert, update, delete on public.catalog_rules to authenticated;
grant select, insert, update, delete on public.catalog_rules to service_role;

notify pgrst, 'reload schema';
