-- CRM: przypisanie leada do konkretnego handlowca (nazwa widoczna na karcie).
-- Dashboard -> SQL Editor -> Run

alter table public.crm_leads
  add column if not exists owner_name text;
