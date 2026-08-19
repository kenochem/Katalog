-- Uruchom w Supabase SQL Editor
-- Przechowuje edytowalną treść artykułów Biblioteki Technicznej (zeszyty).
-- Domyślnie strona pokazuje treść wbudowaną w plik HTML; jeśli istnieje
-- zapisany wiersz dla danego "slug", strona podmienia treść na tę z bazy.

create table if not exists technical_library_articles (
  slug text primary key,
  html text not null,
  updated_at timestamptz not null default now(),
  updated_by text
);

alter table technical_library_articles enable row level security;

drop policy if exists "public read library" on technical_library_articles;
create policy "public read library" on technical_library_articles
  for select using (true);

drop policy if exists "authenticated insert library" on technical_library_articles;
create policy "authenticated insert library" on technical_library_articles
  for insert with check (auth.role() = 'authenticated');

drop policy if exists "authenticated update library" on technical_library_articles;
create policy "authenticated update library" on technical_library_articles
  for update using (auth.role() = 'authenticated');
