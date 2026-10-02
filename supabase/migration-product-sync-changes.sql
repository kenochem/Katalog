-- Szczegółowy log zmian z syncu WAPRO — który produkt, które pole, stara i nowa
-- wartość. Uzupełnia stock_sync_requests.message (tylko zbiorcze liczniki) o
-- rzeczywiste, przeszukiwalne wpisy per produkt.
-- Dashboard → SQL Editor → Run

create table if not exists public.product_sync_changes (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.stock_sync_requests (id) on delete cascade,
  product_id text not null,
  sku text not null,
  display_name text,
  field text not null
    check (field in ('stock', 'price_purchase_net', 'price_sale_net', 'price_sale_gross')),
  old_value numeric,
  new_value numeric,
  changed_at timestamptz not null default now()
);

create index if not exists product_sync_changes_changed_at_idx
  on public.product_sync_changes (changed_at desc);
create index if not exists product_sync_changes_sku_idx
  on public.product_sync_changes (sku);
create index if not exists product_sync_changes_request_idx
  on public.product_sync_changes (request_id);

alter table public.product_sync_changes enable row level security;

drop policy if exists "product_sync_changes_select_auth" on public.product_sync_changes;
create policy "product_sync_changes_select_auth"
  on public.product_sync_changes for select
  to authenticated
  using (true);

-- Insert robi agent na serwerze (service_role) — bez policy dla authenticated insert.

-- Porządkowanie: bez auto-pruningu w bazie. Jeśli tabela urośnie zbyt duża,
-- najprościej okresowo (ręcznie albo cronem w Supabase) usunąć stare wpisy, np.:
--   delete from public.product_sync_changes where changed_at < now() - interval '90 days';
