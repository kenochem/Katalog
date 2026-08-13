-- TASK 3 (push) — tabela subskrypcji Web Push
-- Supabase Dashboard → SQL Editor → Run
-- (VAPID + Edge Function chat-push + webhook — patrz komentarze w migration-chat-voice-push.sql)

create table if not exists public.chat_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null,
  keys jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

create index if not exists chat_push_subscriptions_user_idx
  on public.chat_push_subscriptions (user_id, updated_at desc);

alter table public.chat_push_subscriptions enable row level security;

drop policy if exists "chat_push_subs_own_select" on public.chat_push_subscriptions;
create policy "chat_push_subs_own_select"
  on public.chat_push_subscriptions for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "chat_push_subs_own_upsert" on public.chat_push_subscriptions;
create policy "chat_push_subs_own_upsert"
  on public.chat_push_subscriptions for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "chat_push_subs_own_update" on public.chat_push_subscriptions;
create policy "chat_push_subs_own_update"
  on public.chat_push_subscriptions for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "chat_push_subs_own_delete" on public.chat_push_subscriptions;
create policy "chat_push_subs_own_delete"
  on public.chat_push_subscriptions for delete
  to authenticated
  using (user_id = auth.uid());

grant select, insert, update, delete on public.chat_push_subscriptions to authenticated;
grant all on public.chat_push_subscriptions to service_role;

notify pgrst, 'reload schema';
