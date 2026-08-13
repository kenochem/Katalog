-- Reakcje emoji + edycja własnych wiadomości (jak hub-platform)
-- SQL Editor → Run (po migration-chat.sql)

create table if not exists public.chat_message_reactions (
  message_id uuid not null references public.chat_messages (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 16),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

create index if not exists chat_message_reactions_message_idx
  on public.chat_message_reactions (message_id);

alter table public.chat_message_reactions enable row level security;

drop policy if exists "chat_reactions_select" on public.chat_message_reactions;
create policy "chat_reactions_select"
  on public.chat_message_reactions for select
  to authenticated
  using (
    exists (
      select 1 from public.chat_messages m
      where m.id = message_id
        and public.chat_can_access_thread(m.thread_id)
    )
  );

drop policy if exists "chat_reactions_insert" on public.chat_message_reactions;
create policy "chat_reactions_insert"
  on public.chat_message_reactions for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.chat_messages m
      where m.id = message_id
        and public.chat_can_access_thread(m.thread_id)
    )
  );

drop policy if exists "chat_reactions_update" on public.chat_message_reactions;
create policy "chat_reactions_update"
  on public.chat_message_reactions for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "chat_reactions_delete" on public.chat_message_reactions;
create policy "chat_reactions_delete"
  on public.chat_message_reactions for delete
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "chat_messages_update_own" on public.chat_messages;
create policy "chat_messages_update_own"
  on public.chat_messages for update
  to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and public.chat_can_access_thread(thread_id)
  );

do $$
begin
  alter publication supabase_realtime add table public.chat_message_reactions;
exception
  when duplicate_object then null;
end $$;
