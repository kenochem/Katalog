-- CRM: notatki wlasne handlowca, opcjonalnie oznaczone klientem lub leadem.
-- Dashboard -> SQL Editor -> Run

create table if not exists public.crm_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  body text,
  client_id uuid references public.crm_clients (id) on delete set null,
  lead_id uuid references public.crm_leads (id) on delete set null,
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists crm_notes_user_pinned_idx
  on public.crm_notes (user_id, pinned desc, updated_at desc);

alter table public.crm_notes enable row level security;

drop policy if exists "crm_notes_select_own" on public.crm_notes;
create policy "crm_notes_select_own"
  on public.crm_notes for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "crm_notes_insert_own" on public.crm_notes;
create policy "crm_notes_insert_own"
  on public.crm_notes for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "crm_notes_update_own" on public.crm_notes;
create policy "crm_notes_update_own"
  on public.crm_notes for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "crm_notes_delete_own" on public.crm_notes;
create policy "crm_notes_delete_own"
  on public.crm_notes for delete
  to authenticated
  using (user_id = auth.uid());
