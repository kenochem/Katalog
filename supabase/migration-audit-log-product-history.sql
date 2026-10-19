-- Historia zmian produktu dla wszystkich zalogowanych: odczyt wpisów dziennika dotyczących produktów
-- (kto, kiedy i co zmienił) w karcie produktu oraz w panelu operacji masowych.
-- Pozostałe wpisy dziennika (logowania, konta, uprawnienia) nadal widzi tylko administrator, a użytkownik własne.
-- Supabase Dashboard -> SQL Editor -> Run (można uruchamiać wielokrotnie).

drop policy if exists "audit_log_select_product_history" on public.audit_log;
create policy "audit_log_select_product_history"
  on public.audit_log for select
  to authenticated
  using (entity_type = 'product');

grant select on public.audit_log to authenticated;

notify pgrst, 'reload schema';
