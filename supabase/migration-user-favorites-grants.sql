-- Uzupełnienie RLS / GRANT dla ulubionych (upsert w PostgREST)
-- Uruchamiane razem z migration-user-favorites.sql

drop policy if exists "user_favorites_update_own" on public.user_favorites;
create policy "user_favorites_update_own"
  on public.user_favorites for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, update, delete on public.user_favorites to authenticated;
grant select, insert, update, delete on public.user_favorites to service_role;

grant select, insert, update, delete on public.product_collections to authenticated;
grant select, insert, update, delete on public.product_collections to service_role;

-- Odśwież cache PostgREST (Supabase robi to okresowo; NOTIFY pomaga lokalnie)
notify pgrst, 'reload schema';
