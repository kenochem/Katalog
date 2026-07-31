-- Chat: kanał ogólny + DM (Supabase Realtime)
-- Dashboard → SQL Editor → Run

-- Stały UUID kanału ogólnego
-- 00000000-0000-0000-0000-0000000000c1

create table if not exists public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('general', 'dm')),
  -- para userów posortowana: "uuidA:uuidB" (tylko DM)
  dm_key text,
  created_at timestamptz not null default now(),
  constraint chat_threads_dm_key_chk check (
    (kind = 'general' and dm_key is null)
    or (kind = 'dm' and dm_key is not null)
  )
);

create unique index if not exists chat_threads_general_uidx
  on public.chat_threads ((kind))
  where kind = 'general';

create unique index if not exists chat_threads_dm_key_uidx
  on public.chat_threads (dm_key)
  where kind = 'dm';

insert into public.chat_threads (id, kind, dm_key)
values ('00000000-0000-0000-0000-0000000000c1', 'general', null)
on conflict (id) do nothing;

create table if not exists public.chat_thread_members (
  thread_id uuid not null references public.chat_threads (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (thread_id, user_id)
);

create index if not exists chat_thread_members_user_idx
  on public.chat_thread_members (user_id);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  body text not null
    check (char_length(trim(body)) > 0 and char_length(body) <= 2000),
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_thread_created_idx
  on public.chat_messages (thread_id, created_at desc);

alter table public.chat_threads enable row level security;
alter table public.chat_thread_members enable row level security;
alter table public.chat_messages enable row level security;

-- Czy user ma dostęp do wątku
create or replace function public.chat_can_access_thread(p_thread_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.chat_threads t
    where t.id = p_thread_id
      and (
        t.kind = 'general'
        or exists (
          select 1
          from public.chat_thread_members m
          where m.thread_id = t.id
            and m.user_id = auth.uid()
        )
      )
  );
$$;

revoke all on function public.chat_can_access_thread(uuid) from public;
grant execute on function public.chat_can_access_thread(uuid) to authenticated;

-- Lista aktywnych użytkowników do DM (bez pełnego odczytu profiles)
create or replace function public.list_chat_peers()
returns table (
  id uuid,
  display_name text,
  email text
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.display_name, p.email
  from public.profiles p
  where p.active = true
    and p.id <> auth.uid()
  order by p.display_name;
$$;

revoke all on function public.list_chat_peers() from public;
grant execute on function public.list_chat_peers() to authenticated;

-- Otwórz / utwórz DM z drugim userem
create or replace function public.get_or_create_dm(p_other_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  a uuid;
  b uuid;
  k text;
  tid uuid;
begin
  if me is null then
    raise exception 'not authenticated';
  end if;
  if p_other_user_id is null or p_other_user_id = me then
    raise exception 'invalid peer';
  end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = p_other_user_id and p.active = true
  ) then
    raise exception 'peer not found';
  end if;

  if me < p_other_user_id then
    a := me; b := p_other_user_id;
  else
    a := p_other_user_id; b := me;
  end if;
  k := a::text || ':' || b::text;

  select t.id into tid
  from public.chat_threads t
  where t.kind = 'dm' and t.dm_key = k;

  if tid is null then
    insert into public.chat_threads (kind, dm_key)
    values ('dm', k)
    returning id into tid;

    insert into public.chat_thread_members (thread_id, user_id)
    values (tid, a), (tid, b)
    on conflict do nothing;
  else
    insert into public.chat_thread_members (thread_id, user_id)
    values (tid, a), (tid, b)
    on conflict do nothing;
  end if;

  return tid;
end;
$$;

revoke all on function public.get_or_create_dm(uuid) from public;
grant execute on function public.get_or_create_dm(uuid) to authenticated;

create or replace function public.mark_chat_thread_read(p_thread_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.chat_can_access_thread(p_thread_id) then
    raise exception 'forbidden';
  end if;

  if exists (
    select 1 from public.chat_threads t
    where t.id = p_thread_id and t.kind = 'general'
  ) then
    insert into public.chat_thread_members (thread_id, user_id, last_read_at)
    values (p_thread_id, auth.uid(), now())
    on conflict (thread_id, user_id)
    do update set last_read_at = excluded.last_read_at;
  else
    update public.chat_thread_members
    set last_read_at = now()
    where thread_id = p_thread_id
      and user_id = auth.uid();
  end if;
end;
$$;

revoke all on function public.mark_chat_thread_read(uuid) from public;
grant execute on function public.mark_chat_thread_read(uuid) to authenticated;

-- RLS: threads
drop policy if exists "chat_threads_select" on public.chat_threads;
create policy "chat_threads_select"
  on public.chat_threads for select
  to authenticated
  using (
    kind = 'general'
    or exists (
      select 1 from public.chat_thread_members m
      where m.thread_id = id and m.user_id = auth.uid()
    )
  );

-- RLS: members
drop policy if exists "chat_members_select" on public.chat_thread_members;
create policy "chat_members_select"
  on public.chat_thread_members for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.chat_can_access_thread(thread_id)
  );

drop policy if exists "chat_members_update_own" on public.chat_thread_members;
create policy "chat_members_update_own"
  on public.chat_thread_members for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- RLS: messages
drop policy if exists "chat_messages_select" on public.chat_messages;
create policy "chat_messages_select"
  on public.chat_messages for select
  to authenticated
  using (public.chat_can_access_thread(thread_id));

drop policy if exists "chat_messages_insert" on public.chat_messages;
create policy "chat_messages_insert"
  on public.chat_messages for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and public.chat_can_access_thread(thread_id)
  );

-- Realtime
do $$
begin
  alter publication supabase_realtime add table public.chat_messages;
exception
  when duplicate_object then null;
end $$;
