-- TASK 2 (głosówki) — tylko Storage
-- Supabase Dashboard → SQL Editor → Run

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-voice',
  'chat-voice',
  true,
  1048576,
  array['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "chat_voice_select" on storage.objects;
create policy "chat_voice_select"
  on storage.objects for select
  to public
  using (bucket_id = 'chat-voice');

drop policy if exists "chat_voice_insert" on storage.objects;
create policy "chat_voice_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'chat-voice'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "chat_voice_delete_own" on storage.objects;
create policy "chat_voice_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'chat-voice'
    and auth.uid()::text = split_part(name, '/', 1)
  );
