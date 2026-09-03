/**
 * Naprawia zdjęcia w magazynie BaseLinker — podmienia martwe kenochem.com/hpeciai/…
 * na działające URL ze sklepu WooCommerce (/wp-content/uploads/…).
 *
 * Metoda API: addInventoryProduct + product_id (updateInventoryProductsData nie istnieje).
 * NIGDY nie wysyła istniejących URL CDN BaseLinker — tylko sloty z martwymi linkami.
 *
 *   node --env-file=.env scripts/fix-baselinker-images.mjs
 *   node --env-file=.env scripts/fix-baselinker-images.mjs --apply
 *   node --env-file=.env scripts/fix-baselinker-images.mjs --apply --sku ATAS0083
 *   node --env-file=.env scripts/fix-baselinker-images.mjs --apply --resume --max-per-run 80
 */
import { createClient } from '@supabase/supabase-js';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { isBaselinkerCdnUrl, uniqueHttpUrls } from './lib/catalogImageUrls.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const APPLY = process.argv.includes('--apply');
const RESUME = process.argv.includes('--resume');
const WC_BASE = 'https://kenochem.com/wp-json/wc/store/products';
const BATCH = 100;
const PREVIEW_PATH = resolve('data/baselinker-image-fix-preview.json');
const PLAN_PATH = resolve('data/baselinker-image-fix-plan.json');
const DONE_PATH = resolve('data/baselinker-image-fix-done.json');
const BACKUP_DIR = resolve('data/baselinker-image-backups');
const WC_CACHE_PATH = resolve('data/kenochem-wc-images-cache.json');
const REQUEST_DELAY_MS = Number(process.env.BASELINKER_REQUEST_DELAY_MS || 2000);
const MAX_PER_RUN = Math.max(0, Number(argValue('--max-per-run') || process.env.BASELINKER_IMAGE_FIX_MAX || 80));

function argValue(name) {
  const pref = `${name}=`;
  const hit = process.argv.find((arg) => arg.startsWith(pref));
  if (hit) return hit.slice(pref.length);
  const idx = process.argv.indexOf(name);
  return idx >= 0 ? process.argv[idx + 1] : undefined;
}

const skuFilter = String(argValue('--sku') || '')
  .trim()
  .toUpperCase();
const limit = Math.max(0, Number(argValue('--limit') || 0));

const token = process.env.BASELINKER_TOKEN?.trim();
const inventoryId = Number(process.env.BASELINKER_INVENTORY_ID || 17991);

if (!token || !inventoryId) {
  console.error('Ustaw BASELINKER_TOKEN i BASELINKER_INVENTORY_ID w .env');
  process.exit(1);
}

async function blCall(method, parameters, attempt = 0) {
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
    const msg = json.error_message || JSON.stringify(json);
    const blocked = /blocked until (\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/i.exec(msg);
    if (blocked && attempt < 8) {
      const until = new Date(`${blocked[1].replace(' ', 'T')}+02:00`);
      const waitMs = Math.max(5000, until.getTime() - Date.now() + 3000);
      console.log(`\nLimit API BL — czekam ${Math.ceil(waitMs / 1000)}s (${blocked[1]})…`);
      await new Promise((r) => setTimeout(r, waitMs));
      return blCall(method, parameters, attempt + 1);
    }
    throw new Error(`${method}: ${msg}`);
  }
  return json;
}

function loadDoneIds() {
  if (!existsSync(DONE_PATH)) return new Set();
  const ids = JSON.parse(readFileSync(DONE_PATH, 'utf8'));
  return new Set(Array.isArray(ids) ? ids : []);
}

function saveDoneIds(done) {
  writeFileSync(DONE_PATH, JSON.stringify([...done].sort((a, b) => a - b)), 'utf8');
}

function isDeadKenochemHpeciai(url) {
  return /kenochem\.com\/hpeciai\//i.test(String(url || ''));
}

function isWorkingKenochemShopUrl(url) {
  return /kenochem\.com\/wp-content\/uploads\//i.test(String(url || ''));
}

function extractBlImageSlots(imagesObj) {
  if (!imagesObj || typeof imagesObj !== 'object') return [];
  const slots = [];
  for (const [k, v] of Object.entries(imagesObj)) {
    if (!/^\d+$/.test(String(k))) continue;
    const pos = Number(k);
    const url = String(v || '').trim();
    if (url.startsWith('http')) slots.push({ pos, url });
  }
  slots.sort((a, b) => a.pos - b.pos);
  return slots;
}

function slotNeedsFix(url) {
  if (!url) return true;
  if (isBaselinkerCdnUrl(url)) return false;
  if (isWorkingKenochemShopUrl(url)) return false;
  if (isDeadKenochemHpeciai(url)) return true;
  return false;
}

function productNeedsFix(slots) {
  if (!slots.length) return true;
  return slots.some((s) => slotNeedsFix(s.url));
}

function catalogSourceUrls(product) {
  const urls = uniqueHttpUrls([
    product?.image_url,
    ...(Array.isArray(product?.extra_images) ? product.extra_images : []),
  ]);
  return urls.filter((u) => isBaselinkerCdnUrl(u) || isWorkingKenochemShopUrl(u));
}

function buildImagesPatch(slots, sourceUrls) {
  if (!sourceUrls.length) return null;

  const maxPos = slots.length ? Math.max(...slots.map((s) => s.pos)) : 0;
  const hasCdn = slots.some((s) => isBaselinkerCdnUrl(s.url));
  const allBroken =
    !slots.length || slots.every((s) => slotNeedsFix(s.url) && !isBaselinkerCdnUrl(s.url));

  const patch = {};
  let sourceIdx = 0;

  if (!hasCdn && allBroken) {
    const count = Math.min(sourceUrls.length, 16);
    for (let i = 0; i < count; i += 1) {
      patch[String(i)] = `url:${sourceUrls[i]}`;
    }
    for (let i = count; i < Math.min(Math.max(maxPos, count), 16); i += 1) {
      patch[String(i)] = '';
    }
    return patch;
  }

  for (const slot of slots) {
    const key = String(slot.pos - 1);
    if (isBaselinkerCdnUrl(slot.url)) continue;
    if (!slotNeedsFix(slot.url)) continue;

    if (sourceIdx < sourceUrls.length) {
      const next = sourceUrls[sourceIdx];
      sourceIdx += 1;
      if (slot.url !== next) patch[key] = `url:${next}`;
    } else {
      patch[key] = '';
    }
  }

  if (!slots.length) {
    const count = Math.min(sourceUrls.length, 16);
    for (let i = 0; i < count; i += 1) {
      patch[String(i)] = `url:${sourceUrls[i]}`;
    }
  }

  return Object.keys(patch).length ? patch : null;
}

async function fetchAllWcProducts() {
  if (existsSync(WC_CACHE_PATH)) {
    const cached = JSON.parse(readFileSync(WC_CACHE_PATH, 'utf8'));
    const ageMs = Date.now() - Number(cached.fetchedAt || 0);
    if (ageMs < 6 * 60 * 60 * 1000 && cached.bySku) {
      console.log(`WC cache: ${Object.keys(cached.bySku).length} SKU (${Math.round(ageMs / 60000)} min temu)`);
      return new Map(Object.entries(cached.bySku));
    }
  }

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
      bySku.set(sku, urls);
    }
    if (page % 20 === 0) console.log(`WC: strona ${page}, SKU z foto: ${bySku.size}`);
    page += 1;
    await new Promise((r) => setTimeout(r, 120));
  }

  mkdirSync('data', { recursive: true });
  writeFileSync(
    WC_CACHE_PATH,
    JSON.stringify({ fetchedAt: Date.now(), bySku: Object.fromEntries(bySku) }, null, 0),
    'utf8',
  );
  return bySku;
}

async function fetchAllBlProducts() {
  const products = new Map();
  let page = 1;
  while (page <= 50) {
    const list = await blCall('getInventoryProductsList', {
      inventory_id: inventoryId,
      page,
      filter_sort: 'id',
    });
    const batch = list.products || {};
    const ids = Object.keys(batch);
    if (!ids.length) break;

    for (let i = 0; i < ids.length; i += BATCH) {
      const chunk = ids.slice(i, i + BATCH).map(Number);
      const res = await blCall('getInventoryProductsData', {
        inventory_id: inventoryId,
        products: chunk,
      });
      for (const [idStr, data] of Object.entries(res.products || {})) {
        const sku = String(data?.sku || batch[idStr]?.sku || '').trim().toUpperCase();
        products.set(Number(idStr), {
          productId: Number(idStr),
          sku,
          name: data?.text_fields?.name || '',
          images: data?.images || {},
          slots: extractBlImageSlots(data?.images),
        });
      }
      await new Promise((r) => setTimeout(r, 300));
    }

    console.log(`BL lista: strona ${page}, produktów: ${products.size}`);
    page += 1;
    if (ids.length < 1000) break;
  }
  return products;
}

console.log('Pobieram zdjęcia ze sklepu kenochem.com (WooCommerce)...');
const planFileExists =
  RESUME && existsSync(PLAN_PATH) && JSON.parse(readFileSync(PLAN_PATH, 'utf8')).length > 0;
const wcBySku = planFileExists ? new Map() : await fetchAllWcProducts();
if (!planFileExists) console.log(`WC: ${wcBySku.size} SKU ze zdjęciami`);

const catalogBySku = new Map();
const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!planFileExists) {
  if (url && key) {
  const supabase = createClient(url, key);
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('products')
      .select('sku,image_url,extra_images')
      .order('sku')
      .range(from, from + 999);
    if (error) throw error;
    if (!data?.length) break;
    for (const row of data) {
      const sku = String(row.sku || '').trim().toUpperCase();
      if (!sku) continue;
      const urls = catalogSourceUrls(row);
      if (urls.length) catalogBySku.set(sku, urls);
    }
    if (data.length < 1000) break;
  }
  console.log(`Katalog (fallback): ${catalogBySku.size} SKU z dobrymi URL`);
  }
}

let fullPlan = [];
const stats = {
  skippedOk: 0,
  skippedNoSource: 0,
  skippedDone: 0,
  fixDead: 0,
  fixEmpty: 0,
  fixPartialCdn: 0,
};

if (planFileExists) {
  fullPlan = JSON.parse(readFileSync(PLAN_PATH, 'utf8'));
  console.log(`Resume: plan z pliku (${fullPlan.length} pozycji)`);
} else {
  console.log(`Pobieram magazyn BaseLinker #${inventoryId}...`);
  const blProducts = await fetchAllBlProducts();
  console.log(`BL: ${blProducts.size} produktów`);

  for (const item of blProducts.values()) {
    if (skuFilter && item.sku !== skuFilter) continue;
    if (!productNeedsFix(item.slots)) {
      stats.skippedOk += 1;
      continue;
    }

    const sourceUrls =
      wcBySku.get(item.sku) ||
      catalogBySku.get(item.sku) ||
      [];
    if (!sourceUrls.length) {
      stats.skippedNoSource += 1;
      continue;
    }

    const imagesPatch = buildImagesPatch(item.slots, sourceUrls);
    if (!imagesPatch) continue;

    const hasCdn = item.slots.some((s) => isBaselinkerCdnUrl(s.url));
    const wasEmpty = !item.slots.length;
    const reason = wasEmpty ? 'empty' : hasCdn ? 'partial_cdn' : 'dead_hpeciai';
    if (reason === 'empty') stats.fixEmpty += 1;
    else if (reason === 'partial_cdn') stats.fixPartialCdn += 1;
    else stats.fixDead += 1;

    fullPlan.push({
      productId: item.productId,
      sku: item.sku,
      name: item.name,
      reason,
      source: wcBySku.has(item.sku) ? 'woocommerce' : 'catalog',
      before: item.slots.map((s) => ({ pos: s.pos, url: s.url })),
      afterUrls: sourceUrls.slice(0, 16),
      imagesPatch,
    });
  }
}

const doneIdsForRun = loadDoneIds();
let executionPlan = fullPlan.filter((row) => !doneIdsForRun.has(row.productId));
stats.skippedDone = fullPlan.length - executionPlan.length;
if (stats.skippedDone) {
  console.log(`Pominięto ${stats.skippedDone} już zrobionych (done.json)`);
}

if (limit > 0) executionPlan = executionPlan.slice(0, limit);
else if (MAX_PER_RUN > 0) executionPlan = executionPlan.slice(0, MAX_PER_RUN);

mkdirSync('data', { recursive: true });
if (!planFileExists) {
  writeFileSync(PLAN_PATH, JSON.stringify(fullPlan, null, 2), 'utf8');
}
writeFileSync(
  PREVIEW_PATH,
  JSON.stringify(
    executionPlan.map(({ imagesPatch, ...rest }) => rest),
    null,
    2,
  ),
  'utf8',
);

console.log('\nStatystyki:');
if (stats.skippedDone) console.log(`  Już zrobione (resume): ${stats.skippedDone}`);
console.log(`  OK (bez zmian): ${stats.skippedOk}`);
console.log(`  Do naprawy: ${executionPlan.length}${MAX_PER_RUN ? ` (limit bieżącej sesji: ${MAX_PER_RUN})` : ''} (martwe=${stats.fixDead}, puste=${stats.fixEmpty}, częściowo CDN=${stats.fixPartialCdn})`);
console.log(`  Brak źródła zdjęcia: ${stats.skippedNoSource}`);
console.log(`Plan: ${PLAN_PATH} (${fullPlan.length} pozycji)`);
console.log(`Preview: ${PREVIEW_PATH}`);
for (const row of executionPlan.slice(0, 12)) {
  console.log(`  ${row.sku} [${row.reason}/${row.source}] → ${row.afterUrls[0]?.slice(0, 70)}…`);
}

if (!APPLY) {
  console.log('\nDry-run. Aby wgrać do BaseLinker: dodaj --apply');
  process.exit(0);
}

if (!executionPlan.length) {
  console.log('\nBrak produktów do wgrywania w tej sesji.');
  process.exit(0);
}

mkdirSync(BACKUP_DIR, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupPath = join(BACKUP_DIR, `baselinker-images-${stamp}.json`);
writeFileSync(
  backupPath,
  JSON.stringify(
    executionPlan.map((row) => ({
      productId: row.productId,
      sku: row.sku,
      before: row.before,
    })),
    null,
    2,
  ),
  'utf8',
);
console.log(`\nBackup: ${backupPath}`);
console.log(`Wgrywam ${executionPlan.length} produktów do BaseLinker (delay ${REQUEST_DELAY_MS}ms)...`);

const doneIds = loadDoneIds();
let done = 0;
let errors = 0;
for (const row of executionPlan) {
  try {
    await blCall('addInventoryProduct', {
      inventory_id: inventoryId,
      product_id: row.productId,
      images: row.imagesPatch,
    });
    done += 1;
    doneIds.add(row.productId);
    saveDoneIds(doneIds);
    if (done % 25 === 0) console.log(`  ${done}/${executionPlan.length}`);
    await new Promise((r) => setTimeout(r, REQUEST_DELAY_MS));
  } catch (err) {
    errors += 1;
    console.error(`  BŁĄD ${row.sku} (#${row.productId}): ${err.message}`);
    if (/Query limit exceeded/i.test(err.message)) break;
  }
}

console.log(`\nGotowe. Zaktualizowano ${done}/${executionPlan.length}, błędów: ${errors}`);
