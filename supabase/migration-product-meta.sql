-- Dodatkowe pola produktu (BaseLinker / oferta / AI) — elastyczny JSONB
alter table public.products
  add column if not exists product_meta jsonb not null default '{}'::jsonb;

create index if not exists products_product_meta_gin
  on public.products using gin (product_meta);

notify pgrst, 'reload schema';
