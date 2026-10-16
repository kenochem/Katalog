-- Uprawnienia (GRANT) do nowszych tabel katalogu dla zalogowanych użytkowników.
-- W tym projekcie tabele utworzone w SQL Editorze nie dostają automatycznie dostępu dla roli authenticated,
-- przez co aplikacja widzi błąd „permission denied” (np. Moja kolejka mówi „brak tabeli”).
-- Dostęp do wierszy nadal ogranicza RLS (polityki w migracjach). Pomija tabele, których jeszcze nie ma.
-- Można uruchamiać wielokrotnie. Supabase Dashboard -> SQL Editor -> Run

do $$
declare
  t text;
begin
  -- pełny dostęp (zakres wierszy ogranicza RLS)
  foreach t in array array[
    'catalog_tasks', 'catalog_manufacturers', 'product_tech', 'catalog_product_overrides',
    'promo_campaigns', 'promo_items'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('grant select, insert, update, delete on public.%I to authenticated', t);
      execute format('grant select, insert, update, delete on public.%I to service_role', t);
    end if;
  end loop;

  -- tabele tylko do odczytu / zmiany statusu dla użytkowników
  foreach t in array array['system_alerts', 'agent_uptime', 'system_events', 'agent_heartbeats'] loop
    if to_regclass('public.' || t) is not null then
      execute format('grant select on public.%I to authenticated', t);
      execute format('grant select, insert, update, delete on public.%I to service_role', t);
    end if;
  end loop;
  if to_regclass('public.system_alerts') is not null then
    execute 'grant update on public.system_alerts to authenticated';
  end if;
end $$;

notify pgrst, 'reload schema';
