-- Avatar w liście osób do DM (RPC security definer)
-- SQL Editor → Run

create or replace function public.list_chat_peers()
returns table (
  id uuid,
  display_name text,
  email text,
  avatar_url text
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.display_name, p.email, nullif(trim(p.avatar_url), '')
  from public.profiles p
  where p.active = true
    and p.id <> auth.uid()
  order by p.display_name;
$$;

revoke all on function public.list_chat_peers() from public;
grant execute on function public.list_chat_peers() to authenticated;

notify pgrst, 'reload schema';
