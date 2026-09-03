-- CRM: przeniesienie danych z localStorage (kalendarz, lejek sprzedaży, notatki klienta,
-- ustawienia handlowca) do Supabase + nowa tabela zadań/przypomnień.
-- Dashboard -> SQL Editor -> Run

-- 1) Kalendarz -- WSPOLNY dla calego zespolu (jak prawdziwy kalendarz firmowy):
-- kazdy zalogowany widzi i edytuje wszystkie wydarzenia. user_id sluzy tylko do
-- podpisania, kto utworzyl wpis.
create table if not exists public.crm_calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  type text not null default 'task'
    check (type in ('visit', 'delivery', 'finance', 'team', 'task', 'integration')),
  date date not null,
  time text not null default '09:00',
  end_time text,
  all_day boolean not null default false,
  owner text not null default '',
  location text,
  note text,
  app text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists crm_calendar_events_date_idx
  on public.crm_calendar_events (date);

alter table public.crm_calendar_events enable row level security;

drop policy if exists "crm_calendar_events_select_team" on public.crm_calendar_events;
create policy "crm_calendar_events_select_team"
  on public.crm_calendar_events for select
  to authenticated
  using (true);

drop policy if exists "crm_calendar_events_insert_team" on public.crm_calendar_events;
create policy "crm_calendar_events_insert_team"
  on public.crm_calendar_events for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "crm_calendar_events_update_team" on public.crm_calendar_events;
create policy "crm_calendar_events_update_team"
  on public.crm_calendar_events for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "crm_calendar_events_delete_team" on public.crm_calendar_events;
create policy "crm_calendar_events_delete_team"
  on public.crm_calendar_events for delete
  to authenticated
  using (true);

-- 2) Lejek sprzedazy -- prywatny per handlowiec (jak crm_clients/crm_orders).
create table if not exists public.crm_leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  company_name text not null default '',
  contact_name text,
  phone text,
  email text,
  client_id uuid references public.crm_clients (id) on delete set null,
  stage text not null default 'new'
    check (stage in ('new', 'contact', 'offer', 'negotiation', 'won', 'lost')),
  value_estimate numeric not null default 0,
  sort_order integer not null default 0,
  source text,
  activities jsonb not null default '[]'::jsonb,
  closed_at timestamptz,
  close_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists crm_leads_user_stage_idx
  on public.crm_leads (user_id, stage, sort_order);

alter table public.crm_leads enable row level security;

drop policy if exists "crm_leads_select_own" on public.crm_leads;
create policy "crm_leads_select_own"
  on public.crm_leads for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "crm_leads_insert_own" on public.crm_leads;
create policy "crm_leads_insert_own"
  on public.crm_leads for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "crm_leads_update_own" on public.crm_leads;
create policy "crm_leads_update_own"
  on public.crm_leads for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "crm_leads_delete_own" on public.crm_leads;
create policy "crm_leads_delete_own"
  on public.crm_leads for delete
  to authenticated
  using (user_id = auth.uid());

-- 3) Notatki / oś czasu klienta -- prywatne per handlowiec.
create table if not exists public.crm_client_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  client_id uuid not null references public.crm_clients (id) on delete cascade,
  kind text not null default 'note'
    check (kind in ('order', 'note', 'chat', 'invoice', 'inbox')),
  title text not null,
  body text,
  actor_name text,
  at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists crm_client_notes_client_idx
  on public.crm_client_notes (client_id, at desc);

alter table public.crm_client_notes enable row level security;

drop policy if exists "crm_client_notes_select_own" on public.crm_client_notes;
create policy "crm_client_notes_select_own"
  on public.crm_client_notes for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "crm_client_notes_insert_own" on public.crm_client_notes;
create policy "crm_client_notes_insert_own"
  on public.crm_client_notes for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "crm_client_notes_delete_own" on public.crm_client_notes;
create policy "crm_client_notes_delete_own"
  on public.crm_client_notes for delete
  to authenticated
  using (user_id = auth.uid());

-- 4) Ustawienia handlowca (prowizja %, konfiguracja firmy) -- jeden wiersz na usera.
create table if not exists public.crm_user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  commission_pct numeric not null default 15,
  company_config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.crm_user_settings enable row level security;

drop policy if exists "crm_user_settings_select_own" on public.crm_user_settings;
create policy "crm_user_settings_select_own"
  on public.crm_user_settings for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "crm_user_settings_upsert_own" on public.crm_user_settings;
create policy "crm_user_settings_upsert_own"
  on public.crm_user_settings for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "crm_user_settings_update_own" on public.crm_user_settings;
create policy "crm_user_settings_update_own"
  on public.crm_user_settings for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- 5) Zadania / przypomnienia -- NOWA funkcja (np. "oddzwon do klienta w piatek"),
-- prywatne per handlowiec, opcjonalnie powiazane z klientem lub leadem.
create table if not exists public.crm_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  note text,
  due_date date,
  due_time text,
  client_id uuid references public.crm_clients (id) on delete set null,
  lead_id uuid references public.crm_leads (id) on delete set null,
  done boolean not null default false,
  done_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists crm_tasks_user_due_idx
  on public.crm_tasks (user_id, done, due_date);

alter table public.crm_tasks enable row level security;

drop policy if exists "crm_tasks_select_own" on public.crm_tasks;
create policy "crm_tasks_select_own"
  on public.crm_tasks for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "crm_tasks_insert_own" on public.crm_tasks;
create policy "crm_tasks_insert_own"
  on public.crm_tasks for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "crm_tasks_update_own" on public.crm_tasks;
create policy "crm_tasks_update_own"
  on public.crm_tasks for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "crm_tasks_delete_own" on public.crm_tasks;
create policy "crm_tasks_delete_own"
  on public.crm_tasks for delete
  to authenticated
  using (user_id = auth.uid());
