-- Moja kolejka: zadania w katalogu przydzielane osobom (uzupelnij zdjecie, zatwierdz opis, sprawdz dane...)
-- Dashboard -> SQL Editor -> Run

create table if not exists public.catalog_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  note text not null default '',
  -- photo = uzupelnij zdjecie, tech = zatwierdz opis techniczny, data = sprawdz dane, other = inne
  kind text not null default 'other' check (kind in ('photo', 'tech', 'data', 'other')),
  sku text not null default '',
  product_name text not null default '',
  assigned_to uuid not null references auth.users (id) on delete cascade,
  assigned_to_label text not null default '',
  created_by uuid not null references auth.users (id) on delete cascade,
  created_by_label text not null default '',
  status text not null default 'open' check (status in ('open', 'done')),
  created_at timestamptz not null default now(),
  done_at timestamptz,
  done_auto boolean not null default false
);

create index if not exists catalog_tasks_assignee_idx on public.catalog_tasks (assigned_to, status, created_at desc);
create index if not exists catalog_tasks_creator_idx on public.catalog_tasks (created_by, created_at desc);

alter table public.catalog_tasks enable row level security;

-- widac zadania przydzielone Tobie albo utworzone przez Ciebie
drop policy if exists "catalog_tasks_select" on public.catalog_tasks;
create policy "catalog_tasks_select" on public.catalog_tasks
  for select to authenticated
  using (assigned_to = auth.uid() or created_by = auth.uid());

-- tworzyc moze kazdy zalogowany (jako on sam)
drop policy if exists "catalog_tasks_insert" on public.catalog_tasks;
create policy "catalog_tasks_insert" on public.catalog_tasks
  for insert to authenticated
  with check (created_by = auth.uid());

-- zmieniac (np. oznaczyc jako wykonane) moze wykonawca i autor
drop policy if exists "catalog_tasks_update" on public.catalog_tasks;
create policy "catalog_tasks_update" on public.catalog_tasks
  for update to authenticated
  using (assigned_to = auth.uid() or created_by = auth.uid())
  with check (assigned_to = auth.uid() or created_by = auth.uid());

-- usuwac moze autor
drop policy if exists "catalog_tasks_delete" on public.catalog_tasks;
create policy "catalog_tasks_delete" on public.catalog_tasks
  for delete to authenticated
  using (created_by = auth.uid());

-- uprawnienia dla zalogowanych (bez tego baza zwraca "permission denied")
grant select, insert, update, delete on public.catalog_tasks to authenticated;
grant select, insert, update, delete on public.catalog_tasks to service_role;
