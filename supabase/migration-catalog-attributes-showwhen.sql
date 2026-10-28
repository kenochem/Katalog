-- Atrybuty zależne od innych atrybutów (np. „Grupa części” tylko dla typu towaru „Część do myjek ciśnieniowych”).
-- show_when = {"key": "typ_towaru", "values": ["Część do myjek ciśnieniowych", "Pianownica / opryskiwacz"]}
-- Supabase Dashboard -> SQL Editor -> Run (można uruchamiać wielokrotnie).

alter table public.catalog_attributes
  add column if not exists show_when jsonb;

grant select, insert, update, delete on public.catalog_attributes to authenticated;
grant select, insert, update, delete on public.catalog_attributes to service_role;

notify pgrst, 'reload schema';
