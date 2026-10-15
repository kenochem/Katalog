-- Statystyki i odznaki w "Moj profil": kazdy zalogowany moze ODCZYTAC wlasne wpisy dziennika aktywnosci.
-- (Admin nadal widzi wszystkie wpisy; wpisy pozostaja niezmienne - brak UPDATE/DELETE z aplikacji.)
-- Dashboard -> SQL Editor -> Run

drop policy if exists "audit_log_select_self" on public.audit_log;
create policy "audit_log_select_self"
  on public.audit_log for select
  to authenticated
  using (user_id = auth.uid());
