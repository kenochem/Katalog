#!/usr/bin/env node
/**
 * Diagnostyka sync sprzedaży WAPRO (zbiorczy cache).
 *
 *   node --env-file=.env scripts/check-wapro-sales.mjs
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Potrzebne SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (--env-file=.env)');
  process.exit(1);
}

const supabase = createClient(url, key);

const { data: syncRows, error: syncErr } = await supabase
  .from('sales_sync_requests')
  .select('id, status, requested_at, finished_at, message')
  .order('requested_at', { ascending: false })
  .limit(5);

if (syncErr) {
  if (syncErr.message.includes('sales_sync_requests') || syncErr.code === '42P01') {
    console.error('Brak tabeli sales_sync_requests — uruchom migration-sales-sync-requests.sql');
  } else {
    console.error('Błąd sales_sync_requests:', syncErr.message);
  }
  process.exit(1);
}

console.log('=== Ostatnie sales_sync_requests ===');
if (!syncRows?.length) {
  console.log('(brak zleceń)');
} else {
  for (const row of syncRows) {
    console.log(`${row.status} @ ${row.requested_at} — ${row.message ?? '—'}`);
  }
}

const { count, error: countErr } = await supabase
  .from('products')
  .select('id', { count: 'exact', head: true })
  .not('wapro_sales_stats', 'is', null);

if (countErr) {
  if (countErr.message.includes('wapro_sales_stats')) {
    console.error('\nBrak kolumn wapro_sales_stats — uruchom migration-product-wapro-sales-stats.sql');
  } else {
    console.error('\nBłąd products:', countErr.message);
  }
  process.exit(1);
}

console.log(`\nProdukty z cache sprzedaży: ${count ?? 0}`);

const { data: sample } = await supabase
  .from('products')
  .select('sku, wapro_sales_synced_at, wapro_sales_stats')
  .not('wapro_sales_stats', 'is', null)
  .order('wapro_sales_synced_at', { ascending: false })
  .limit(3);

if (sample?.length) {
  console.log('\nPrzykłady:');
  for (const p of sample) {
    const p12 = p.wapro_sales_stats?.periods?.find((x) => x.months === 12);
    console.log(
      `  ${p.sku}: sync=${p.wapro_sales_synced_at ?? '—'}, 12m qty=${p12?.qty ?? '—'}`,
    );
  }
}

const pending = syncRows?.filter((r) => r.status === 'pending' || r.status === 'running') ?? [];
if (pending.length) {
  console.log('\n⚠ Sync sprzedaży w kolejce — agent: -SalesSyncOnly lub -OnlyIfPending');
}
