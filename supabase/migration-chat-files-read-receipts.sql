-- Talk: pliki do 2 MB + statusy dostarczenia/odczytu per wiadomość
-- SQL Editor → Run po migration-chat.sql

insert into storage.buckets (id, name, public, file_size_limit)
values ('chat-files', 'chat-files', true, 2097152)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit;

drop policy if exists "chat_files_select" on storage.objects;
create policy "chat_files_select"
  on storage.objects for select
  to public
  using (bucket_id = 'chat-files');

drop policy if exists "chat_files_insert" on storage.objects;
create policy "chat_files_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'chat-files'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "chat_files_delete_own" on storage.objects;
create policy "chat_files_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'chat-files'
    and auth.uid()::text = split_part(name, '/', 1)
  );

create table if not exists public.chat_message_reads (
  message_id uuid not null references public.chat_messages (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

create index if not exists chat_message_reads_message_idx
  on public.chat_message_reads (message_id);

alter table public.chat_message_reads enable row level security;

drop policy if exists "chat_reads_select" on public.chat_message_reads;
create policy "chat_reads_select"
  on public.chat_message_reads for select
  to authenticated
  using (
    exists (
      select 1 from public.chat_messages m
      where m.id = message_id
        and public.chat_can_access_thread(m.thread_id)
    )
  );

drop policy if exists "chat_reads_insert_own" on public.chat_message_reads;
create policy "chat_reads_insert_own"
  on public.chat_message_reads for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.chat_messages m
      where m.id = message_id
        and m.user_id <> auth.uid()
        and public.chat_can_access_thread(m.thread_id)
    )
  );

do $$
begin
  alter publication supabase_realtime add table public.chat_message_reads;
exception
  when duplicate_object then null;
end $$;
