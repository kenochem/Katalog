-- CRM: własni klienci + historia zamówień (per auth user)
-- Dashboard → SQL Editor → Run

create table if not exists public.crm_clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  display_name text not null,
  legal_name text,
  nip text,
  address text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists crm_clients_user_name_idx
  on public.crm_clients (user_id, display_name);

create unique index if not exists crm_clients_user_nip_uidx
  on public.crm_clients (user_id, nip)
  where nip is not null and nip <> '';

alter table public.crm_clients enable row level security;

drop policy if exists "crm_clients_select_own" on public.crm_clients;
create policy "crm_clients_select_own"
  on public.crm_clients for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "crm_clients_insert_own" on public.crm_clients;
create policy "crm_clients_insert_own"
  on public.crm_clients for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "crm_clients_update_own" on public.crm_clients;
create policy "crm_clients_update_own"
  on public.crm_clients for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "crm_clients_delete_own" on public.crm_clients;
create policy "crm_clients_delete_own"
  on public.crm_clients for delete
  to authenticated
  using (user_id = auth.uid());

create table if not exists public.crm_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  client_id uuid references public.crm_clients (id) on delete set null,
  client_name text not null default '',
  note text not null default '',
  items jsonb not null default '[]'::jsonb,
  status text not null default 'saved'
    check (status in ('sent', 'saved')),
  kind text not null default 'order'
    check (kind in ('order', 'quote')),
  created_at timestamptz not null default now()
);

create index if not exists crm_orders_user_created_idx
  on public.crm_orders (user_id, created_at desc);

alter table public.crm_orders enable row level security;

drop policy if exists "crm_orders_select_own" on public.crm_orders;
create policy "crm_orders_select_own"
  on public.crm_orders for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "crm_orders_insert_own" on public.crm_orders;
create policy "crm_orders_insert_own"
  on public.crm_orders for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "crm_orders_delete_own" on public.crm_orders;
create policy "crm_orders_delete_own"
  on public.crm_orders for delete
  to authenticated
  using (user_id = auth.uid());
