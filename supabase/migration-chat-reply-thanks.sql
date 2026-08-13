-- Odpowiedzi na wiadomości + „Dzięki” (jedna reakcja na usera / wiadomość)
-- SQL Editor → Run (po migration-chat.sql)

alter table public.chat_messages
  add column if not exists reply_to_id uuid
  references public.chat_messages (id) on delete set null;

create index if not exists chat_messages_reply_to_idx
  on public.chat_messages (reply_to_id)
  where reply_to_id is not null;

create or replace function public.chat_messages_reply_same_thread()
returns trigger
language plpgsql
as $$
begin
  if new.reply_to_id is null then
    return new;
  end if;
  if not exists (
    select 1
    from public.chat_messages m
    where m.id = new.reply_to_id
      and m.thread_id = new.thread_id
  ) then
    raise exception 'reply must be in the same thread';
  end if;
  return new;
end;
$$;

drop trigger if exists chat_messages_reply_same_thread_trg on public.chat_messages;
create trigger chat_messages_reply_same_thread_trg
  before insert or update of reply_to_id, thread_id
  on public.chat_messages
  for each row
  execute function public.chat_messages_reply_same_thread();

create table if not exists public.chat_message_thanks (
  message_id uuid not null references public.chat_messages (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

create index if not exists chat_message_thanks_message_idx
  on public.chat_message_thanks (message_id);

alter table public.chat_message_thanks enable row level security;

drop policy if exists "chat_thanks_select" on public.chat_message_thanks;
create policy "chat_thanks_select"
  on public.chat_message_thanks for select
  to authenticated
  using (
    exists (
      select 1
      from public.chat_messages m
      where m.id = message_id
        and public.chat_can_access_thread(m.thread_id)
    )
  );

drop policy if exists "chat_thanks_insert_own" on public.chat_message_thanks;
create policy "chat_thanks_insert_own"
  on public.chat_message_thanks for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.chat_messages m
      where m.id = message_id
        and public.chat_can_access_thread(m.thread_id)
    )
  );

drop policy if exists "chat_thanks_delete_own" on public.chat_message_thanks;
create policy "chat_thanks_delete_own"
  on public.chat_message_thanks for delete
  to authenticated
  using (user_id = auth.uid());

do $$
begin
  alter publication supabase_realtime add table public.chat_message_thanks;
exception
  when duplicate_object then null;
end $$;
