-- Uruchom w Supabase SQL Editor
alter table products add column if not exists extra_images jsonb not null default '[]';
