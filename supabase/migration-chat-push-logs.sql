create table if not exists public.chat_push_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  mode text not null check (mode in ('message', 'self-test')),
  message_id uuid null,
  thread_id uuid null,
  sender_user_id uuid null,
  recipient_count integer not null default 0,
  subscription_count integer not null default 0,
  attempted integer not null default 0,
  sent integer not null default 0,
  failed integer not null default 0,
  stale integer not null default 0,
  failures jsonb not null default '[]'::jsonb
);

create index if not exists chat_push_logs_created_idx
  on public.chat_push_logs (created_at desc);

create index if not exists chat_push_logs_sender_idx
  on public.chat_push_logs (sender_user_id, created_at desc);

alter table public.chat_push_logs enable row level security;

drop policy if exists "chat_push_logs_admin_select" on public.chat_push_logs;
create policy "chat_push_logs_admin_select"
  on public.chat_push_logs for select
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role in ('admin', 'manager')
    )
  );

grant select on public.chat_push_logs to authenticated;
grant all on public.chat_push_logs to service_role;
