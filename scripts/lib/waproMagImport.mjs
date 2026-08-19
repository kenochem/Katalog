/**
 * Wstawia brakujące SKU z data/wapro-mag-catalog.json (szkielet: nazwa, ceny, stan, bez zdjęć).
 */
import { readFileSync, existsSync } from 'fs';
import { normSkuKey } from './waproSkuMatch.mjs';

const INSERT_BATCH = 80;

function metaRecord(raw) {
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? { ...raw } : {};
}

export function buildSkeletonProduct(row) {
  const sku = String(row.sku || '').trim().toUpperCase();
  const name = String(row.name || sku).trim();
  const catalog = row.catalog === 'shop' ? 'shop' : 'accessories';
  const category = String(row.category || (catalog === 'shop' ? 'Inne' : 'Inne części')).trim();
  const manufacturer = String(row.manufacturer || (catalog === 'accessories' ? 'WAPRO' : '')).trim();
  const id = catalog === 'accessories' ? sku : `shop-${sku}`;
  const importedAt = new Date().toISOString();

  return {
    id,
    sku,
    name,
    display_name: name,
    category,
    manufacturer,
    ean: '',
    image_url: '',
    custom_image_url: '',
    description: '',
    has_image: false,
    stock: Number(row.stock ?? 0),
    stock_manual: false,
    price_purchase_net: row.pricePurchaseNet ?? null,
    price_sale_net: row.priceSaleNet ?? null,
    price_sale_gross: row.priceSaleGross ?? null,
    tags: ['wapro-import', 'do-uzupelnienia'],
    extra_images: [],
    variants: [],
    is_group: false,
    catalog,
    product_meta: {
      waproImport: true,
      waproSkeleton: true,
      waproSku: sku,
      ...(manufacturer ? { waproManufacturer: manufacturer } : {}),
      waproImportedAt: importedAt,
    },
  };
}

export async function fetchExistingSkuSet(supabase) {
  const seen = new Set();
  let from = 0;
  const page = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('products')
      .select('id, sku, product_meta')
      .range(from, from + page - 1)
      .order('sku');
    if (error) throw error;
    if (!data?.length) break;
    for (const row of data) {
      const sku = String(row.sku || '').trim().toUpperCase();
      const id = String(row.id || '').trim().toUpperCase();
      const meta = row.product_meta && typeof row.product_meta === 'object' ? row.product_meta : {};
      const candidates = [
        sku,
        id.startsWith('SHOP-') ? id.slice(5) : id,
        meta.waproSku,
        meta.legacySku,
        meta.previousSku,
      ];
      for (const raw of candidates) {
        const key = String(raw || '').trim().toUpperCase();
        if (!key) continue;
        seen.add(key);
        seen.add(normSkuKey(key));
      }
    }
    if (data.length < page) break;
    from += page;
  }
  return seen;
}

export function loadMagCatalogFile(path) {
  const raw = readFileSync(path, 'utf8');
  const parsed = JSON.parse(raw);
  const rows = Array.isArray(parsed) ? parsed : parsed?.rows;
  if (!Array.isArray(rows)) {
    throw new Error('wapro-mag-catalog.json: oczekiwana tablica rows');
  }
  return rows;
}

export async function importNewWaproFromCatalog(supabase, catalogPath, opts = {}) {
  const dryRun = opts.dryRun === true;
  const maxInsert = opts.maxInsert ?? 0;

  if (!existsSync(catalogPath)) {
    return { inserted: 0, skipped: 0, candidates: 0, reason: 'missing-file' };
  }

  const rows = loadMagCatalogFile(catalogPath);
  const existing = await fetchExistingSkuSet(supabase);

  const candidates = [];
  for (const row of rows) {
    const sku = String(row.sku || '').trim().toUpperCase();
    if (!sku) continue;
    if (sku.startsWith('X')) continue;
    if (existing.has(sku) || existing.has(normSkuKey(sku))) continue;
    candidates.push(buildSkeletonProduct(row));
  }

  candidates.sort((a, b) => b.stock - a.stock || a.sku.localeCompare(b.sku));

  const limit = maxInsert > 0 ? Math.min(maxInsert, candidates.length) : candidates.length;
  const batch = candidates.slice(0, limit);

  if (dryRun || !batch.length) {
    return {
      inserted: 0,
      skipped: rows.length - candidates.length,
      candidates: candidates.length,
      preview: batch.slice(0, 5).map((r) => r.sku),
    };
  }

  let inserted = 0;
  for (let i = 0; i < batch.length; i += INSERT_BATCH) {
    const chunk = batch.slice(i, i + INSERT_BATCH);
    const { error } = await supabase.from('products').insert(chunk);
    if (error) throw error;
    inserted += chunk.length;
  }

  return {
    inserted,
    skipped: rows.length - candidates.length,
    candidates: candidates.length,
  };
}
