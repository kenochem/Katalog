-- CRM: ikona typu klienta (osoba, firma, myjnia, silownia, warsztat, sklep...).
-- Dashboard -> SQL Editor -> Run

alter table public.crm_clients
  add column if not exists icon text;
