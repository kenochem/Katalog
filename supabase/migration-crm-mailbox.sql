-- Skrzynka e-mail CRM (IMAP/SMTP) — uruchom w Supabase SQL Editor
-- Hasło trzymane tylko po stronie serwera (RLS bez SELECT dla klienta).

create table if not exists public.crm_mailbox_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  mailbox_email text not null,
  imap_host text not null,
  imap_port int not null default 993,
  imap_secure boolean not null default true,
  smtp_host text not null,
  smtp_port int not null default 465,
  smtp_secure boolean not null default true,
  username text not null,
  last_sync_at timestamptz,
  last_sync_error text,
  last_imap_uid bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_mailbox_credentials (
  user_id uuid primary key references auth.users (id) on delete cascade,
  password text not null,
  updated_at timestamptz not null default now()
);

alter table public.crm_mailbox_credentials enable row level security;
-- Brak polityk → tylko service_role (Edge Function) czyta/zapisuje hasło.

create table if not exists public.crm_inbox_sync (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists crm_inbox_sync_user_received
  on public.crm_inbox_sync (user_id, received_at desc);

-- Jeśli tabela istniała wcześniej:
alter table public.crm_mailbox_settings
  add column if not exists last_imap_uid bigint;

alter table public.crm_mailbox_settings enable row level security;
alter table public.crm_inbox_sync enable row level security;

create policy crm_mailbox_settings_own on public.crm_mailbox_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy crm_inbox_sync_select_own on public.crm_inbox_sync
  for select using (auth.uid() = user_id);

create policy crm_inbox_sync_update_own on public.crm_inbox_sync
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
