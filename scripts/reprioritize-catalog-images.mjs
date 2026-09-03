/**
 * Repriorytetyzacja URL zdjęć: Baselinker CDN → inne → kenochem.com (rezerwa).
 * Działa na Supabase (--apply) i/lub plikach JSON w data/ + public/data/.
 *
 *   node scripts/reprioritize-catalog-images.mjs
 *   node scripts/reprioritize-catalog-images.mjs --apply
 *   node scripts/reprioritize-catalog-images.mjs --csv path/to/Base__Produkty__.csv --apply
 */
import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import {
  isBaselinkerCdnUrl,
  isKenochemShopUrl,
  pickBaselinkerPrimaryImage,
  sortCatalogImageCandidates,
  uniqueHttpUrls,
} from './lib/catalogImageUrls.mjs';

const APPLY = process.argv.includes('--apply');
const ROOT = resolve(import.meta.dirname, '..');

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
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ';') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n') {
      row.push(cell.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
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

function collectBlImages(row) {
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

function buildBlIndex(rows) {
  const bySku = new Map();
  const byNormSku = new Map();
  for (const row of rows) {
    const sku = String(row.produkt_sku || '').trim().toUpperCase();
    if (!sku) continue;
    const images = collectBlImages(row);
    if (!images.primary && !images.extras.length) continue;
    const rec = { sku, skuNorm: normalizeSku(sku), ...images };
    const prev = bySku.get(sku);
    if (!prev || pickBaselinkerPrimaryImage(rec)) bySku.set(sku, rec);
    const prevN = byNormSku.get(rec.skuNorm);
    if (!prevN || pickBaselinkerPrimaryImage(rec)) byNormSku.set(rec.skuNorm, rec);
  }
  return { bySku, byNormSku };
}

function pickBlRecord(sku, index) {
  const key = String(sku || '').trim().toUpperCase();
  return index.bySku.get(key) || index.byNormSku.get(normalizeSku(key)) || null;
}

/** Zwraca patch { imageUrl/image_url, extraImageUrls/extra_images, hasImage/has_image } lub null. */
export function reprioritizeImageFields(input, blRecord = null) {
  const custom = String(input.customImageUrl || input.custom_image_url || '').trim();
  const currentPrimary = String(input.imageUrl || input.image_url || '').trim();
  const currentExtras = Array.isArray(input.extraImageUrls)
    ? input.extraImageUrls
    : Array.isArray(input.extra_images)
      ? input.extra_images
      : [];

  const pool = uniqueHttpUrls([
    ...(blRecord ? [blRecord.primary, ...blRecord.extras] : []),
    currentPrimary,
    ...currentExtras,
  ]);

  let primary = '';
  if (!custom) {
    primary = blRecord ? pickBaselinkerPrimaryImage(blRecord) : '';
    if (!primary) {
      const sorted = sortCatalogImageCandidates(pool, '');
      primary = sorted[0] || '';
    }
  } else {
    const withoutCustom = pool.filter(
      (u) => u.split('?')[0] !== custom.split('?')[0],
    );
    const sorted = sortCatalogImageCandidates(withoutCustom, '');
    primary = sorted[0] || currentPrimary;
  }

  const extras = sortCatalogImageCandidates(
    pool.filter((u) => !primary || u.split('?')[0] !== primary.split('?')[0]),
    '',
  );

  const hasImage = Boolean(custom || primary || extras.length);
  const samePrimary = primary === currentPrimary;
  const sameExtras = JSON.stringify(extras) === JSON.stringify(currentExtras);

  if (samePrimary && sameExtras) return null;

  const isRow = 'image_url' in input || 'custom_image_url' in input;
  if (isRow) {
    return {
      image_url: primary,
      extra_images: extras,
      has_image: hasImage,
    };
  }
  return {
    imageUrl: primary,
    extraImageUrls: extras.length ? extras : undefined,
    hasImage,
  };
}

function patchJsonFile(relPath, blIndex) {
  const paths = [join(ROOT, 'data', relPath), join(ROOT, 'public/data', relPath)];
  let changed = 0;
  for (const filePath of paths) {
    if (!existsSync(filePath)) continue;
    const products = JSON.parse(readFileSync(filePath, 'utf8'));
    if (!Array.isArray(products)) continue;
    let fileChanged = 0;
    for (const p of products) {
      const bl = blIndex ? pickBlRecord(p.sku, blIndex) : null;
      const patch = reprioritizeImageFields(p, bl);
      if (!patch) continue;
      Object.assign(p, patch);
      fileChanged += 1;
    }
    if (fileChanged && APPLY) {
      writeFileSync(filePath, JSON.stringify(products), 'utf8');
    }
    changed += fileChanged;
    console.log(`${basename(filePath)}: ${fileChanged} produktow${APPLY ? ' zapisanych' : ' do zmiany'}`);
  }
  return changed;
}

async function patchSupabase(blIndex) {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.warn('Pomijam Supabase — brak SUPABASE_SERVICE_ROLE_KEY');
    return 0;
  }
  const supabase = createClient(url, key);
  const all = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('products')
      .select('id,sku,custom_image_url,image_url,extra_images,has_image')
      .range(from, from + 999);
    if (error) throw error;
    if (!data?.length) break;
    all.push(...data);
    if (data.length < 1000) break;
  }

  let changed = 0;
  let toBaselinker = 0;
  let kenReserve = 0;
  for (const row of all) {
    const bl = blIndex ? pickBlRecord(row.sku, blIndex) : null;
    const patch = reprioritizeImageFields(row, bl);
    if (!patch) continue;
    if (isBaselinkerCdnUrl(patch.image_url)) toBaselinker += 1;
    else if (isKenochemShopUrl(patch.image_url)) kenReserve += 1;
    if (!APPLY) {
      changed += 1;
      continue;
    }
    const { error } = await supabase.from('products').update(patch).eq('id', row.id);
    if (error) throw error;
    changed += 1;
    if (changed % 200 === 0) console.log(`Supabase: ${changed}...`);
  }
  console.log(
    `Supabase: ${changed} produktow${APPLY ? ' zaktualizowanych' : ' do zmiany'} (baselinker=${toBaselinker}, kenochem-rezerwa=${kenReserve})`,
  );
  return changed;
}

const csvPath = argValue('--csv');
let blIndex = null;
if (csvPath && existsSync(csvPath)) {
  blIndex = buildBlIndex(parseCsv(readFileSync(csvPath, 'utf8')));
  console.log(`CSV: ${basename(csvPath)} — indeks SKU: ${blIndex.bySku.size}`);
} else if (csvPath) {
  console.warn(`CSV nie znaleziony: ${csvPath}`);
}

console.log(APPLY ? 'TRYB: zapis (--apply)' : 'TRYB: podgląd (dodaj --apply)');

await patchSupabase(blIndex);
patchJsonFile('products.json', blIndex);
patchJsonFile('shop-products.json', blIndex);

if (APPLY) {
  const { spawnSync } = await import('node:child_process');
  spawnSync(process.execPath, ['scripts/generate-light-product-data.mjs'], {
    cwd: ROOT,
    stdio: 'inherit',
  });
}

console.log('Gotowe.');
