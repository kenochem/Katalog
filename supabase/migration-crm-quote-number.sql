-- CRM: wspolny, rosnacy numer oferty (np. OF/2026/00042).
-- Dashboard -> SQL Editor -> Run

create sequence if not exists public.crm_quote_number_seq;

create or replace function public.next_crm_quote_number()
returns bigint
language sql
security definer
set search_path = public
as $$
  select nextval('public.crm_quote_number_seq');
$$;

grant execute on function public.next_crm_quote_number() to authenticated;
