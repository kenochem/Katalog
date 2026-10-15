-- Ranking pracownikow w "Moj profil": punkty pracy (XP) z dziennika aktywnosci.
-- Funkcja (security definer) liczy punkty wszystkich aktywnych kont, ale oddaje tylko dane do rankingu:
-- nazwe, punkty, date ostatniej aktywnosci i wyglad profilu (ramka/tlo/nakladka/kolor/motto).
-- Osoby z wlaczona opcja "ukryj mnie w rankingu" (profiles.user_preferences -> profile.hideFromBoard) widza tylko siebie.
-- Dashboard -> SQL Editor -> Run

create or replace function public.catalog_leaderboard(p_since timestamptz)
returns table (
  user_id uuid,
  display_name text,
  role text,
  xp_period bigint,
  xp_total bigint,
  actions_period bigint,
  last_at timestamptz,
  profile jsonb
)
language sql
security definer
set search_path = public
stable
as $$
  with ev as (
    select
      a.user_id,
      a.created_at,
      least(
        25,
        greatest(
          1,
          case
            when jsonb_typeof(a.changes -> 'count' -> 'to') = 'number'
              then (a.changes -> 'count' ->> 'to')::numeric
            else 1
          end
        )
      )::bigint as w
    from public.audit_log a
    where a.action in (
      'product.update', 'product.category', 'product.stock', 'product.price', 'product.image',
      'baselinker.images', 'product.create', 'kit.save', 'baselinker.push', 'baselinker.import',
      'tech.approve', 'image.optimize', 'task.done'
    )
      and a.created_at > now() - interval '800 days'
  )
  select
    p.id,
    p.display_name,
    p.role::text,
    coalesce(sum(ev.w) filter (where ev.created_at >= p_since), 0)::bigint,
    coalesce(sum(ev.w), 0)::bigint,
    (count(ev.w) filter (where ev.created_at >= p_since))::bigint,
    max(ev.created_at),
    coalesce(p.user_preferences -> 'profile', '{}'::jsonb)
  from public.profiles p
  left join ev on ev.user_id = p.id
  where auth.uid() is not null
    and p.active = true
    and (
      p.id = auth.uid()
      or not coalesce((p.user_preferences -> 'profile' ->> 'hideFromBoard')::boolean, false)
    )
  group by p.id, p.display_name, p.role, p.user_preferences
  order by 4 desc, 5 desc;
$$;

revoke all on function public.catalog_leaderboard(timestamptz) from public;
grant execute on function public.catalog_leaderboard(timestamptz) to authenticated;
