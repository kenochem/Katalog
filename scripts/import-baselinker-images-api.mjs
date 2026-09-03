/**
 * Pobiera zdjęcia produktów z API BaseLinker (CDN upload.cdn.baselinker.com)
 * i aktualizuje Supabase + pliki JSON katalogu.
 *
 * CSV eksport BaseLinker nadal zwraca stare URL-e kenochem.com — API ma prawdziwe CDN.
 *
 *   node --env-file=.env scripts/import-baselinker-images-api.mjs
 *   node --env-file=.env scripts/import-baselinker-images-api.mjs --apply
 *   node --env-file=.env scripts/import-baselinker-images-api.mjs --apply --sku ATAS0083
 *
 * Wymaga: BASELINKER_TOKEN, BASELINKER_INVENTORY_ID (np. 6011214), SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from '@supabase/supabase-js';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  isBaselinkerCdnUrl,
  isKenochemShopUrl,
  pickBaselinkerPrimaryImage,
  sortCatalogImageCandidates,
  uniqueHttpUrls,
} from './lib/catalogImageUrls.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const PREVIEW_PATH = resolve('data/baselinker-image-api-preview.json');
const APPLY = process.argv.includes('--apply');
const MISSING_ONLY = process.argv.includes('--missing-only');
const BATCH = 100;

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

const token = process.env.BASELINKER_TOKEN?.trim();
const inventoryId = Number(process.env.BASELINKER_INVENTORY_ID || 17991);

if (!token || !inventoryId) {
  console.error('Ustaw BASELINKER_TOKEN i BASELINKER_INVENTORY_ID w .env');
  console.error('  BASELINKER_INVENTORY_ID=17991  (Kenochem główny — getInventories)');
  process.exit(1);
}

const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Brak SUPABASE_URL/VITE_SUPABASE_URL lub SUPABASE_SERVICE_ROLE_KEY w .env');
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

function extractApiImages(blProduct) {
  const imagesObj = blProduct?.images;
  if (!imagesObj || typeof imagesObj !== 'object') {
    return { primary: '', extras: [] };
  }
  const urls = [];
  for (const [k, v] of Object.entries(imagesObj)) {
    if (!/^\d+$/.test(String(k))) continue;
    const u = String(v || '').trim();
    if (u.startsWith('http')) urls.push(u);
  }
  urls.sort((a, b) => {
    const posA = Number(Object.entries(imagesObj).find(([, val]) => val === a)?.[0] || 99);
    const posB = Number(Object.entries(imagesObj).find(([, val]) => val === b)?.[0] || 99);
    return posA - posB;
  });
  const unique = uniqueHttpUrls(urls);
  return {
    primary: unique[0] || '',
    extras: unique.slice(1),
  };
}

function hasCatalogPrimaryImage(product) {
  return Boolean(
    String(product.custom_image_url || '').trim() ||
      String(product.image_url || '').trim(),
  );
}

function isDeadKenochemHpeciaiUrl(url) {
  return /kenochem\.com\/hpeciai\//i.test(String(url || ''));
}

function isNewKenochemShopUrl(url) {
  return /kenochem\.com\/wp-content\/uploads\//i.test(String(url || ''));
}

function pickApiBaselinkerPrimary(blImages) {
  const pool = uniqueHttpUrls([blImages.primary, ...(blImages.extras || [])]);
  return pool.find(isBaselinkerCdnUrl) || '';
}

function buildPatch(product, blImages) {
  const currentCustom = String(product.custom_image_url || '').trim();
  if (currentCustom) return null;

  const currentPrimary = String(product.image_url || '').trim();
  const currentExtras = Array.isArray(product.extra_images) ? product.extra_images : [];
  const incomingPrimary = pickApiBaselinkerPrimary(blImages);
  // API BaseLinker: aktualizujemy tylko gdy magazyn ma CDN — nie nadpisuj nowych URL sklepu starymi /hpeciai/
  if (!incomingPrimary) return null;

  const patch = {};
  const fields = [];

  const pool = uniqueHttpUrls([
    incomingPrimary,
    ...blImages.extras.filter((u) => isBaselinkerCdnUrl(u) || isNewKenochemShopUrl(u)),
    currentPrimary,
    ...currentExtras,
  ]).filter((u) => !isDeadKenochemHpeciaiUrl(u));

  const primary = incomingPrimary;

  const shouldReplacePrimary =
    isBaselinkerCdnUrl(primary) && primary.split('?')[0] !== currentPrimary.split('?')[0];

  if (shouldReplacePrimary) {
    patch.image_url = primary;
    fields.push(currentPrimary ? 'image_url_changed' : 'image_url_added');
  }

  const extras = sortCatalogImageCandidates(
    pool.filter((u) => !primary || u.split('?')[0] !== primary.split('?')[0]),
    '',
  );
  if (JSON.stringify(extras) !== JSON.stringify(currentExtras)) {
    patch.extra_images = extras;
    fields.push('extra_images_merged');
  }

  const nextPrimary = patch.image_url ?? currentPrimary;
  const hasImage = Boolean(nextPrimary || extras.length);
  if (hasImage !== Boolean(product.has_image)) {
    patch.has_image = hasImage;
    fields.push('has_image');
  }

  return fields.length ? { patch, fields } : null;
}

async function fetchAllProducts(supabase) {
  const all = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('products')
      .select('id,sku,display_name,catalog,image_url,custom_image_url,extra_images,has_image,product_meta')
      .order('sku')
      .range(from, from + 999);
    if (error) throw error;
    if (!data?.length) break;
    all.push(...data);
    if (data.length < 1000) break;
  }
  return all;
}

function loadSkuIndex() {
  const path = join(ROOT, 'src/lib/baselinkerSkuIndex.generated.ts');
  if (!existsSync(path)) return {};
  const text = readFileSync(path, 'utf8');
  const map = {};
  for (const m of text.matchAll(/"([^"]+)":\s*"(\d+)"/g)) {
    map[m[1].toUpperCase()] = m[2];
  }
  return map;
}

function patchJsonCatalog(filename, updatesBySku) {
  if (!updatesBySku.size) return 0;
  let changed = 0;
  for (const dir of ['data', join('public', 'data')]) {
    const filePath = join(ROOT, dir, filename);
    if (!existsSync(filePath)) continue;
    const products = JSON.parse(readFileSync(filePath, 'utf8'));
    let fileChanged = 0;
    for (const p of products) {
      const sku = String(p.sku || '').trim().toUpperCase();
      const upd = updatesBySku.get(sku);
      if (!upd) continue;
      if (upd.image_url !== undefined) p.imageUrl = upd.image_url;
      if (upd.extra_images !== undefined) p.extraImageUrls = upd.extra_images;
      if (upd.has_image !== undefined) p.hasImage = upd.has_image;
      fileChanged += 1;
    }
    if (fileChanged && APPLY) {
      writeFileSync(filePath, JSON.stringify(products), 'utf8');
    }
    changed = Math.max(changed, fileChanged);
  }
  return changed;
}

const supabase = createClient(url, key);
const products = await fetchAllProducts(supabase);
const skuIndex = loadSkuIndex();

let catalogProducts = products;
if (skuFilter) {
  catalogProducts = products.filter((p) => String(p.sku || '').trim().toUpperCase() === skuFilter);
  if (!catalogProducts.length) {
    console.error(`Brak produktu SKU=${skuFilter} w Supabase`);
    process.exit(1);
  }
}

/** productId -> { product, blId } */
const linked = new Map();
for (const product of catalogProducts) {
  const meta = product.product_meta && typeof product.product_meta === 'object' ? product.product_meta : {};
  const sku = String(product.sku || '').trim().toUpperCase();
  const blId = String(meta.baselinkerProductId || skuIndex[sku] || '').trim();
  if (!blId) continue;
  linked.set(Number(blId), { product, blId });
}

const blIds = [...linked.keys()];
console.log(`Produkty z ID BaseLinker: ${blIds.length} / ${catalogProducts.length}`);

if (blIds.length === 0) {
  console.log('Brak powiązań baselinkerProductId — uruchom build-baselinker-sku-index + import enrich.');
  process.exit(0);
}

/** blId -> images */
const apiImages = new Map();
for (let i = 0; i < blIds.length; i += BATCH) {
  const chunk = blIds.slice(i, i + BATCH);
  const res = await blCall('getInventoryProductsData', {
    inventory_id: inventoryId,
    products: chunk,
  });
  for (const [idStr, data] of Object.entries(res.products || {})) {
    const imgs = extractApiImages(data);
    if (imgs.primary || imgs.extras.length) {
      apiImages.set(Number(idStr), imgs);
    }
  }
  console.log(`API: ${Math.min(i + BATCH, blIds.length)} / ${blIds.length} (z CDN: ${apiImages.size})`);
  if (i + BATCH < blIds.length) {
    await new Promise((r) => setTimeout(r, 350));
  }
}

const plan = [];
for (const [blId, { product }] of linked) {
  const blImages = apiImages.get(blId);
  if (!blImages) continue;
  const change = buildPatch(product, blImages);
  if (!change) continue;
  plan.push({
    id: product.id,
    sku: product.sku,
    catalog: product.catalog,
    name: product.display_name,
    baselinkerProductId: String(blId),
    fields: change.fields,
    before: {
      imageUrl: product.image_url || '',
      extraImages: Array.isArray(product.extra_images) ? product.extra_images.length : 0,
    },
    after: {
      imageUrl: change.patch.image_url ?? product.image_url ?? '',
      extraImages: Array.isArray(change.patch.extra_images)
        ? change.patch.extra_images.length
        : Array.isArray(product.extra_images)
          ? product.extra_images.length
          : 0,
    },
    patch: change.patch,
  });
}

mkdirSync('data', { recursive: true });
writeFileSync(
  PREVIEW_PATH,
  JSON.stringify(plan.map(({ patch, ...item }) => item), null, 2),
  'utf8',
);

const added = plan.filter((p) => p.fields.includes('image_url_added')).length;
const changed = plan.filter((p) => p.fields.includes('image_url_changed')).length;
const toBl = plan.filter((p) => isBaselinkerCdnUrl(p.after.imageUrl)).length;
console.log(
  `Plan: ${plan.length} aktualizacji (nowe=${added}, zmienione=${changed}, CDN primary=${toBl})`,
);
console.log(`Preview: ${PREVIEW_PATH}`);
for (const item of plan.slice(0, 20)) {
  console.log(`  ${item.sku}: ${item.fields.join(', ')}`);
}

if (!APPLY) {
  console.log('Dry-run. Dodaj --apply, zeby zapisac do Supabase i JSON.');
  process.exit(0);
}

let updated = 0;
const updatesBySku = new Map();
for (const item of plan) {
  const { error } = await supabase.from('products').update(item.patch).eq('id', item.id);
  if (error) throw new Error(`${item.sku}: ${error.message}`);
  updatesBySku.set(String(item.sku).trim().toUpperCase(), item.patch);
  updated += 1;
  if (updated % 100 === 0) console.log(`Supabase: ${updated}/${plan.length}`);
}

const shopChanged = patchJsonCatalog('shop-products.json', updatesBySku);
const accChanged = patchJsonCatalog('products.json', updatesBySku);
console.log(`JSON: shop=${shopChanged}, accessories=${accChanged}`);

spawnSync(process.execPath, ['scripts/generate-light-product-data.mjs'], {
  cwd: ROOT,
  stdio: 'inherit',
});

console.log(`Gotowe. Zaktualizowano ${updated} produktow w Supabase.`);
