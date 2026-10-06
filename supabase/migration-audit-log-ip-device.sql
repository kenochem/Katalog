-- Dziennik aktywnosci: adres IP (odczytywany PO STRONIE SERWERA) i dane urzadzenia.
-- Dashboard -> SQL Editor -> Run
-- Wymaga wczesniej: migration-audit-log.sql
--
-- Zapis idzie teraz przez funkcje public.audit_log_write(): ustala user_id z sesji,
-- nazwe i role bierze z tabeli profiles, a IP z naglowkow zadania (cf-connecting-ip /
-- x-forwarded-for). Klient nie moze ich podrobic. Bezposredni INSERT do tabeli jest zablokowany.

alter table public.audit_log
  add column if not exists ip text,
  add column if not exists device jsonb;

create or replace function public.audit_log_write(
  p_app text,
  p_action text,
  p_entity_type text default '',
  p_entity_id text default '',
  p_entity_label text default '',
  p_summary text default '',
  p_changes jsonb default null,
  p_device jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_headers json;
  v_ip text;
  v_label text := '';
  v_role text := '';
begin
  if v_uid is null then
    return;
  end if;

  begin
    v_headers := current_setting('request.headers', true)::json;
  exception when others then
    v_headers := null;
  end;

  v_ip := coalesce(
    nullif(trim(v_headers ->> 'cf-connecting-ip'), ''),
    nullif(trim(split_part(coalesce(v_headers ->> 'x-forwarded-for', ''), ',', 1)), ''),
    nullif(trim(v_headers ->> 'x-real-ip'), '')
  );

  select coalesce(nullif(display_name, ''), email, ''), coalesce(role, '')
    into v_label, v_role
    from public.profiles
   where id = v_uid;

  insert into public.audit_log (
    user_id, user_label, user_role, app, action,
    entity_type, entity_id, entity_label, summary, changes, ip, device
  ) values (
    v_uid, coalesce(v_label, ''), coalesce(v_role, ''), coalesce(p_app, ''), p_action,
    coalesce(p_entity_type, ''), coalesce(p_entity_id, ''), coalesce(p_entity_label, ''),
    coalesce(p_summary, ''), p_changes, v_ip, p_device
  );
end;
$$;

revoke all on function public.audit_log_write(text, text, text, text, text, text, jsonb, jsonb) from public;
grant execute on function public.audit_log_write(text, text, text, text, text, text, jsonb, jsonb) to authenticated;

-- Od teraz tylko funkcja (security definer) zapisuje do tabeli.
drop policy if exists "audit_log_insert_self" on public.audit_log;
revoke insert on public.audit_log from authenticated;
