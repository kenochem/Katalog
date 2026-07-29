-- Uruchom w Supabase SQL Editor
alter table products add column if not exists stock numeric not null default 0;
alter table products add column if not exists stock_manual boolean not null default false;
