-- Naprawa ulubionych gdy tabela istnieje, ale zapis/odczyt nadal pada (RLS / GRANT).
-- Supabase Dashboard → SQL Editor → Run (bezpieczne wielokrotnie).

grant usage on schema public to anon, authenticated, service_role;

drop policy if exists "user_favorites_select_own" on public.user_favorites;
drop policy if exists "user_favorites_insert_own" on public.user_favorites;
drop policy if exists "user_favorites_delete_own" on public.user_favorites;
drop policy if exists "user_favorites_update_own" on public.user_favorites;

create policy "user_favorites_select_own"
  on public.user_favorites for select
  to authenticated
  using (user_id = auth.uid());

create policy "user_favorites_insert_own"
  on public.user_favorites for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "user_favorites_delete_own"
  on public.user_favorites for delete
  to authenticated
  using (user_id = auth.uid());

create policy "user_favorites_update_own"
  on public.user_favorites for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, update, delete on public.user_favorites to authenticated;
grant select, insert, update, delete on public.user_favorites to service_role;

notify pgrst, 'reload schema';
