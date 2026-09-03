/**
 * Imports product images from BaseLinker CSV into Supabase products.
 *
 * Safe defaults:
 * - does not overwrite custom_image_url uploaded manually in the catalog,
 * - fills missing image_url,
 * - updates image_url when BaseLinker primary image changed and no custom image exists,
 * - merges extra_images without duplicates,
 * - dry-run by default; use --apply to write.
 */
import { createClient } from '@supabase/supabase-js';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import {
  isBaselinkerCdnUrl,
  isKenochemShopUrl,
  pickBaselinkerPrimaryImage,
  sortCatalogImageCandidates,
  uniqueHttpUrls,
} from './lib/catalogImageUrls.mjs';

const PREVIEW_PATH = resolve('data/baselinker-image-import-preview.json');
const APPLY = process.argv.includes('--apply');
const MISSING_ONLY = process.argv.includes('--missing-only');

function argValue(name) {
  const pref = `${name}=`;
  const hit = process.argv.find((arg) => arg.startsWith(pref));
  if (hit) return hit.slice(pref.length);
  const idx = process.argv.indexOf(name);
  return idx >= 0 ? process.argv[idx + 1] : undefined;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  const clean = String(text || '').replace(/^\uFEFF/, '');

  for (let i = 0; i < clean.length; i += 1) {
    const ch = clean[i];
    const next = clean[i + 1];

    if (quoted) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') {
      quoted = true;
    } else if (ch === ';') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n') {
      row.push(cell.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }

  if (cell || row.length) {
    row.push(cell.replace(/\r$/, ''));
    rows.push(row);
  }

  const nonEmpty = rows.filter((r) => r.some((c) => String(c || '').trim()));
  const header = nonEmpty.shift()?.map((h) => String(h || '').trim()) ?? [];
  return nonEmpty.map((cols) => {
    const out = {};
    for (let i = 0; i < header.length; i += 1) out[header[i]] = String(cols[i] || '').trim();
    return out;
  });
}

function normalizeSku(value) {
  const s = String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const m = s.match(/^([A-Z]+)0*([0-9]+)$/);
  return m ? `${m[1]}${Number(m[2])}` : s;
}

function collectImages(row) {
  const primary = String(row.zdjecie || '').trim();
  const extras = [];
  for (let i = 1; i <= 20; i += 1) {
    const url = String(row[`zdjecie_dodatkowe_${i}`] || '').trim();
    if (url.startsWith('http') && url !== primary && !extras.includes(url)) extras.push(url);
  }
  return {
    primary: primary.startsWith('http') ? primary : '',
    extras,
  };
}

function betterImageRecord(current, incoming) {
  const curScore = Number(Boolean(current.primary)) * 10 + current.extras.length;
  const nextScore = Number(Boolean(incoming.primary)) * 10 + incoming.extras.length;
  return nextScore > curScore ? incoming : current;
}

function buildBaselinkerIndex(rows) {
  const bySku = new Map();
  const byNormSku = new Map();
  const byBlId = new Map();

  for (const row of rows) {
    const sku = String(row.produkt_sku || '').trim().toUpperCase();
    const blId = String(row.produkt_id || '').trim();
    const images = collectImages(row);
    if (!images.primary && images.extras.length === 0) continue;
    if (!sku && !blId) continue;

    const rec = {
      sku: sku || (blId ? `BL${blId}` : ''),
      skuNorm: normalizeSku(sku),
      baselinkerProductId: blId,
      name: String(row.produkt_nazwa || '').trim(),
      ...images,
    };

    if (rec.sku) {
      const prev = bySku.get(rec.sku);
      bySku.set(rec.sku, prev ? betterImageRecord(prev, rec) : rec);
    }
    if (rec.skuNorm) {
      const prev = byNormSku.get(rec.skuNorm);
      byNormSku.set(rec.skuNorm, prev ? betterImageRecord(prev, rec) : rec);
    }
    if (blId) {
      const prev = byBlId.get(blId);
      byBlId.set(blId, prev ? betterImageRecord(prev, rec) : rec);
    }
  }

  return { bySku, byNormSku, byBlId };
}

function pickImages(product, index) {
  const sku = String(product.sku || '').trim().toUpperCase();
  const meta = product.product_meta && typeof product.product_meta === 'object' ? product.product_meta : {};
  const blId = String(meta.baselinkerProductId || '').trim();
  return (
    (blId ? index.byBlId.get(blId) : null) ||
    index.bySku.get(sku) ||
    index.byNormSku.get(normalizeSku(sku)) ||
    null
  );
}

function hasCatalogPrimaryImage(product) {
  return Boolean(
    String(product.custom_image_url || '').trim() ||
      String(product.image_url || '').trim(),
  );
}

function buildPatch(product, bl) {
  const currentCustom = String(product.custom_image_url || '').trim();
  if (currentCustom) return null;

  const currentPrimary = String(product.image_url || '').trim();
  const currentExtras = Array.isArray(product.extra_images) ? product.extra_images : [];
  const patch = {};
  const fields = [];

  const incomingPrimary = pickBaselinkerPrimaryImage(bl);
  const pool = uniqueHttpUrls([
    incomingPrimary,
    ...bl.extras,
    currentPrimary,
    ...currentExtras,
  ]);

  const primary =
    incomingPrimary ||
    sortCatalogImageCandidates(pool.filter(Boolean), '')[0] ||
    '';

  const shouldReplacePrimary =
    primary &&
    (primary !== currentPrimary ||
      (isKenochemShopUrl(currentPrimary) && isBaselinkerCdnUrl(primary)));

  if (MISSING_ONLY && hasCatalogPrimaryImage(product) && !shouldReplacePrimary) return null;

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
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await supabase
      .from('products')
      .select('id,sku,display_name,catalog,image_url,custom_image_url,extra_images,has_image,product_meta')
      .order('sku')
      .range(from, from + page - 1);
    if (error) throw error;
    if (!data?.length) break;
    all.push(...data);
    if (data.length < page) break;
  }
  return all;
}

const csvPath = resolve(argValue('--csv') || '');
if (!csvPath || !existsSync(csvPath)) {
  console.error('Podaj --csv sciezka_do_Base__Produkty__.csv');
  process.exit(1);
}

const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Brak SUPABASE_URL/VITE_SUPABASE_URL lub SUPABASE_SERVICE_ROLE_KEY w .env');
  process.exit(1);
}

const rows = parseCsv(readFileSync(csvPath, 'utf8'));
const index = buildBaselinkerIndex(rows);
const sourceWithImages = new Set([...index.bySku.keys(), ...index.byNormSku.keys()]).size;
console.log(`CSV: ${basename(csvPath)} rows=${rows.length}, imageSkuKeys=${sourceWithImages}`);

const supabase = createClient(url, key);
const products = await fetchAllProducts(supabase);
console.log(`Supabase products=${products.length}`);
if (MISSING_ONLY) {
  const missingPrimary = products.filter((p) => !hasCatalogPrimaryImage(p)).length;
  console.log(`Tryb --missing-only: sprawdzam tylko produkty bez glownego zdjecia (${missingPrimary})`);
}

const plan = [];
for (const product of products) {
  const bl = pickImages(product, index);
  if (!bl) continue;
  const change = buildPatch(product, bl);
  if (!change) continue;
  plan.push({
    id: product.id,
    sku: product.sku,
    catalog: product.catalog,
    name: product.display_name,
    baselinkerProductId: bl.baselinkerProductId,
    fields: change.fields,
    before: {
      imageUrl: product.image_url || '',
      customImageUrl: product.custom_image_url || '',
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
const extras = plan.filter((p) => p.fields.includes('extra_images_merged')).length;
console.log(`Plan: ${plan.length} aktualizacji (glowne nowe=${added}, glowne zmienione=${changed}, dodatkowe=${extras})`);
console.log(`Preview: ${PREVIEW_PATH}`);
for (const item of plan.slice(0, 15)) {
  console.log(`  ${item.sku}: ${item.fields.join(', ')} -> ${item.name}`);
}

if (!APPLY) {
  console.log('Dry-run. Dodaj --apply, zeby zapisac do Supabase.');
  process.exit(0);
}

let updated = 0;
for (const item of plan) {
  const { error } = await supabase.from('products').update(item.patch).eq('id', item.id);
  if (error) throw new Error(`${item.sku}: ${error.message}`);
  updated += 1;
  if (updated % 100 === 0) console.log(`Updated ${updated}/${plan.length}`);
}
console.log(`Gotowe. Zaktualizowano ${updated} produktow.`);
