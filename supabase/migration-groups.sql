-- Uruchom w Supabase SQL Editor przed import:supabase
-- Dashboard → SQL → New query → Run

alter table products add column if not exists variants jsonb not null default '[]';
alter table products add column if not exists is_group boolean not null default false;
