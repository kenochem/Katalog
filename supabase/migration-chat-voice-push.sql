-- Talk: głosówki + push (całość) LUB osobno:
--   supabase/migration-chat-voice-bucket.sql      (task 2)
--   supabase/migration-chat-push-subscriptions.sql (task 3)
-- Supabase Dashboard → SQL Editor → Run
--
-- Po migracji (push w tle — opcjonalnie, wymaga VAPID + deploy funkcji):
-- 1. Edge Functions → chat-push → Secrets:
--    VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT=mailto:it@kenochem.pl
--    CHAT_PUSH_WEBHOOK_SECRET=(losowy ciąg)
-- 2. Deploy: npx supabase functions deploy chat-push
-- 3. Database → Webhooks → New → chat_messages INSERT →
--    URL: https://<ref>.supabase.co/functions/v1/chat-push
--    Header: Authorization: Bearer <anon lub service>, x-chat-push-secret: <CHAT_PUSH_WEBHOOK_SECRET>
--
-- Frontend: .env VITE_VAPID_PUBLIC_KEY=(ten sam co VAPID_PUBLIC_KEY)

-- === bucket głosówek ===
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

-- === push subscriptions (Web Push / PWA) ===
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
