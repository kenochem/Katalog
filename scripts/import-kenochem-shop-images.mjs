/**
 * Aktualizuje image_url z nowego sklepu kenochem.com (WooCommerce Store API).
 * Stare URL /hpeciai/... po migracji zwracają 404 — nowe są w /wp-content/uploads/.
 *
 *   node scripts/import-kenochem-shop-images.mjs
 *   node scripts/import-kenochem-shop-images.mjs --apply
 *   node scripts/import-kenochem-shop-images.mjs --apply --only-dead-kenochem
 */
import { createClient } from '@supabase/supabase-js';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { isBaselinkerCdnUrl, isKenochemShopUrl, uniqueHttpUrls } from './lib/catalogImageUrls.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const PREVIEW = resolve('data/kenochem-shop-image-import-preview.json');
const APPLY = process.argv.includes('--apply');
const ONLY_DEAD = process.argv.includes('--only-dead-kenochem');
const WC_BASE = 'https://kenochem.com/wp-json/wc/store/products';

function isDeadKenochemUrl(url) {
  const u = String(url || '');
  return /kenochem\.com\/hpeciai\//i.test(u);
}

function isNewKenochemUrl(url) {
  const u = String(url || '');
  return /kenochem\.com\/wp-content\/uploads\//i.test(u);
}

async function fetchAllWcProducts() {
  const bySku = new Map();
  let page = 1;
  while (page <= 300) {
    const res = await fetch(`${WC_BASE}?per_page=100&page=${page}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KenochemCatalog/1.0)' },
    });
    if (!res.ok) throw new Error(`WC API page ${page}: HTTP ${res.status}`);
    const items = await res.json();
    if (!Array.isArray(items) || items.length === 0) break;
    for (const p of items) {
      const sku = String(p.sku || '').trim().toUpperCase();
      if (!sku) continue;
      const urls = uniqueHttpUrls((p.images || []).map((img) => img?.src).filter(Boolean));
      if (!urls.length) continue;
      bySku.set(sku, { name: p.name, urls });
    }
    if (page % 20 === 0) console.log(`WC: strona ${page}, SKU z foto: ${bySku.size}`);
    page += 1;
    await new Promise((r) => setTimeout(r, 120));
  }
  return bySku;
}

function shouldUpdate(product) {
  if (product.custom_image_url) return false;
  const primary = String(product.image_url || '').trim();
  if (isBaselinkerCdnUrl(primary)) return false;
  if (ONLY_DEAD) return isDeadKenochemUrl(primary);
  if (!primary) return true;
  if (isDeadKenochemUrl(primary)) return true;
  if (isKenochemShopUrl(primary) && !isNewKenochemUrl(primary)) return true;
  return false;
}

function buildPatch(product, wc) {
  const currentPrimary = String(product.image_url || '').trim();
  const currentExtras = Array.isArray(product.extra_images) ? product.extra_images : [];
  const primary = wc.urls[0];
  const extras = uniqueHttpUrls([
    ...wc.urls.slice(1),
    ...currentExtras,
    ...(currentPrimary && currentPrimary !== primary ? [currentPrimary] : []),
  ]).filter((u) => u.split('?')[0] !== primary.split('?')[0]);

  if (primary === currentPrimary && JSON.stringify(extras) === JSON.stringify(currentExtras)) {
    return null;
  }

  const patch = { image_url: primary, extra_images: extras, has_image: true };
  const fields = [];
  if (primary !== currentPrimary) fields.push('image_url');
  if (JSON.stringify(extras) !== JSON.stringify(currentExtras)) fields.push('extra_images');
  return { patch, fields };
}

function patchJson(filename, updatesBySku) {
  if (!updatesBySku.size) return 0;
  let changed = 0;
  for (const dir of ['data', join('public', 'data')]) {
    const filePath = join(ROOT, dir, filename);
    if (!existsSync(filePath)) continue;
    const products = JSON.parse(readFileSync(filePath, 'utf8'));
    let n = 0;
    for (const p of products) {
      const sku = String(p.sku || '').trim().toUpperCase();
      const patch = updatesBySku.get(sku);
      if (!patch) continue;
      if (patch.image_url !== undefined) p.imageUrl = patch.image_url;
      if (patch.extra_images !== undefined) p.extraImageUrls = patch.extra_images;
      if (patch.has_image !== undefined) p.hasImage = patch.has_image;
      n++;
    }
    if (n && APPLY) writeFileSync(filePath, JSON.stringify(products), 'utf8');
    changed = Math.max(changed, n);
  }
  return changed;
}

const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Brak Supabase w .env');
  process.exit(1);
}

console.log('Pobieram katalog WooCommerce kenochem.com...');
const wcIndex = await fetchAllWcProducts();
console.log(`WC: ${wcIndex.size} SKU ze zdjęciami`);

const supabase = createClient(url, key);
const all = [];
for (let from = 0; ; from += 1000) {
  const { data, error } = await supabase
    .from('products')
    .select('id,sku,display_name,catalog,custom_image_url,image_url,extra_images,has_image')
    .order('sku')
    .range(from, from + 999);
  if (error) throw error;
  if (!data?.length) break;
  all.push(...data);
  if (data.length < 1000) break;
}

const plan = [];
for (const product of all) {
  const sku = String(product.sku || '').trim().toUpperCase();
  const wc = wcIndex.get(sku);
  if (!wc) continue;
  if (!shouldUpdate(product)) continue;
  const change = buildPatch(product, wc);
  if (!change) continue;
  plan.push({
    id: product.id,
    sku,
    catalog: product.catalog,
    name: product.display_name,
    fields: change.fields,
    before: product.image_url || '',
    after: change.patch.image_url,
    patch: change.patch,
  });
}

mkdirSync('data', { recursive: true });
writeFileSync(PREVIEW, JSON.stringify(plan.map(({ patch, ...r }) => r), null, 2), 'utf8');
console.log(`Plan: ${plan.length} aktualizacji (z ${all.length} produktów katalogu)`);
console.log(`Preview: ${PREVIEW}`);
for (const item of plan.slice(0, 15)) {
  console.log(`  ${item.sku}: ${item.fields.join(', ')}`);
}

if (!APPLY) {
  console.log('Dry-run. Dodaj --apply.');
  process.exit(0);
}

const updatesBySku = new Map();
let done = 0;
for (const item of plan) {
  const { error } = await supabase.from('products').update(item.patch).eq('id', item.id);
  if (error) throw new Error(`${item.sku}: ${error.message}`);
  updatesBySku.set(item.sku, item.patch);
  done += 1;
  if (done % 200 === 0) console.log(`Supabase: ${done}/${plan.length}`);
}

const shop = patchJson('shop-products.json', updatesBySku);
const acc = patchJson('products.json', updatesBySku);
console.log(`JSON: shop=${shop}, acc=${acc}`);

spawnSync(process.execPath, ['scripts/generate-light-product-data.mjs'], { cwd: ROOT, stdio: 'inherit' });
console.log(`Gotowe. Zaktualizowano ${done} produktów.`);
