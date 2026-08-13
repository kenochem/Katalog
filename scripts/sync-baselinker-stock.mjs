/**
 * Wgranie stanów z Supabase (WAPRO) do magazynu BaseLinker.
 *
 *   node --env-file=.env scripts/sync-baselinker-stock.mjs           # dry-run
 *   node --env-file=.env scripts/sync-baselinker-stock.mjs --apply
 *
 * Wymaga: BASELINKER_TOKEN, BASELINKER_INVENTORY_ID, SUPABASE_SERVICE_ROLE_KEY
 * Zobacz: docs/products/BASELINKER-STOCK-SYNC.md
 */
import { createClient } from '@supabase/supabase-js';

const apply = process.argv.includes('--apply');
const token = process.env.BASELINKER_TOKEN?.trim();
const inventoryId = Number(process.env.BASELINKER_INVENTORY_ID || 0);
const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!token || !inventoryId) {
  console.error('Ustaw BASELINKER_TOKEN i BASELINKER_INVENTORY_ID w .env');
  process.exit(1);
}
if (!url || !key) {
  console.error('Brak Supabase URL / SERVICE_ROLE_KEY');
  process.exit(1);
}

async function blCall(method, parameters) {
  const body = new URLSearchParams({
    method,
    parameters: JSON.stringify(parameters),
  });
  const res = await fetch('https://api.baselinker.com/connector.php', {
    method: 'POST',
    headers: { 'X-BLToken': token },
    body,
  });
  const json = await res.json();
  if (json.status !== 'SUCCESS') {
    throw new Error(json.error_message || JSON.stringify(json));
  }
  return json;
}

const supabase = createClient(url, key);
const { data: rows, error } = await supabase
  .from('products')
  .select('id, sku, stock, product_meta')
  .limit(5000);

if (error) throw error;

const linked = [];
for (const p of rows || []) {
  const meta = p.product_meta && typeof p.product_meta === 'object' ? p.product_meta : {};
  const blId = String(meta.baselinkerProductId || '').trim();
  if (!blId) continue;
  const stock = Number(p.stock);
  if (!Number.isFinite(stock)) continue;
  linked.push({
    product_id: Number(blId),
    variant_id: 0,
    stock: Math.max(0, Math.floor(stock)),
    sku: p.sku,
  });
}

console.log(`Produkty z baselinkerProductId: ${linked.length} / ${rows?.length ?? 0}`);

if (linked.length === 0) {
  console.log('Brak powiązań — uzupełnij meta z eksportu Base lub import-wapro-missing.');
  process.exit(0);
}

const sample = linked.slice(0, 5).map((x) => `${x.sku}→BL#${x.product_id}=${x.stock}`);
console.log('Przykład:', sample.join(', '));

if (!apply) {
  console.log('\nDry-run. Aby wysłać stany: dodaj --apply');
  process.exit(0);
}

const chunk = 100;
for (let i = 0; i < linked.length; i += chunk) {
  const products = linked.slice(i, i + chunk).map(({ product_id, variant_id, stock }) => ({
    product_id,
    variant_id,
    stock,
  }));
  await blCall('updateInventoryProductsStock', {
    inventory_id: inventoryId,
    products,
  });
  console.log(`BL stock: ${Math.min(i + chunk, linked.length)} / ${linked.length}`);
}

console.log('Gotowe.');
