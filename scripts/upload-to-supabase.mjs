import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error(`
Brak kluczy Supabase. Utwórz plik .env:

  VITE_SUPABASE_URL=https://twoj-projekt.supabase.co
  SUPABASE_SERVICE_ROLE_KEY=eyJ...   (z Dashboard → Settings → API)

Potem uruchom:
  npm run import:supabase
`);
  process.exit(1);
}

const catalogArg = (process.argv[2] || 'accessories').toLowerCase();
const catalogs =
  catalogArg === 'all'
    ? ['accessories', 'shop']
    : catalogArg === 'shop'
      ? ['shop']
      : ['accessories'];

const supabase = createClient(url, key);
const BATCH = 200;
const PAGE = 1000;

const fileForCatalog = {
  accessories: 'products.json',
  shop: 'shop-products.json',
};

async function fetchAllExisting() {
  const all = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('products')
      .select('id, sku, stock, stock_manual, extra_images, custom_image_url, catalog')
      .range(from, from + PAGE - 1);

    if (error) throw error;
    if (!data?.length) break;
    all.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

console.log('Fetching existing overrides (all pages)...');
let existingRows;
try {
  existingRows = await fetchAllExisting();
} catch (err) {
  console.error('Fetch overrides error:', err.message);
  console.error('Czy uruchomiłeś migrację catalog / extra_images / stock?');
  process.exit(1);
}
console.log(`Loaded ${existingRows.length} existing products`);

const existingOverrides = new Map(
  existingRows.map((r) => [
    r.id,
    {
      stock: r.stock,
      stockManual: r.stock_manual,
      extraImages: r.extra_images || [],
      customImageUrl: r.custom_image_url || '',
      catalog: r.catalog || 'accessories',
      sku: r.sku,
    },
  ]),
);

function toRow(p, catalog) {
  const existing = existingOverrides.get(p.id);
  const stockManual = existing?.stockManual || p.stockManual || false;
  // Nie nadpisuj stanów z syncu WAPRO przy reimportcie JSON (Baselinker ma inne stany).
  // Nowe produkty: bierz stock z JSON. Istniejące + nie-ręczne: zostaw stock z DB.
  const stock = stockManual
    ? Number(existing?.stock ?? p.stock ?? 0)
    : existing
      ? Number(existing.stock ?? p.stock ?? 0)
      : Number(p.stock ?? 0);
  const extraImages = existing?.extraImages?.length
    ? existing.extraImages
    : (p.extraImageUrls || []);
  const customImageUrl = existing?.customImageUrl || p.customImageUrl || '';

  return {
    id: p.id,
    sku: p.sku,
    name: p.name,
    display_name: p.displayName,
    category: p.category,
    manufacturer: p.manufacturer || '',
    ean: p.ean || '',
    image_url: p.imageUrl || '',
    custom_image_url: customImageUrl,
    description: p.description || '',
    has_image: !!(customImageUrl || p.imageUrl || extraImages.length || p.hasImage),
    stock,
    stock_manual: stockManual,
    price_purchase_net:
      p.pricePurchaseNet != null && Number.isFinite(Number(p.pricePurchaseNet))
        ? Number(p.pricePurchaseNet)
        : null,
    price_sale_net:
      p.priceSaleNet != null && Number.isFinite(Number(p.priceSaleNet))
        ? Number(p.priceSaleNet)
        : null,
    price_sale_gross:
      p.priceSaleGross != null && Number.isFinite(Number(p.priceSaleGross))
        ? Number(p.priceSaleGross)
        : null,
    tags: Array.isArray(p.tags) ? p.tags.filter(Boolean) : [],
    extra_images: extraImages,
    variants: p.variants || [],
    is_group: p.isGroup || false,
    catalog: p.catalog || catalog,
  };
}

async function deleteIds(ids, label) {
  if (!ids.length) return;
  console.log(`Removing ${ids.length} ${label}...`);
  for (let i = 0; i < ids.length; i += BATCH) {
    const chunk = ids.slice(i, i + BATCH);
    const { error } = await supabase.from('products').delete().in('id', chunk);
    if (error) {
      console.error('Delete error:', error.message);
      process.exit(1);
    }
    console.log(`  deleted ${Math.min(i + BATCH, ids.length)}/${ids.length}`);
  }
}

for (const catalog of catalogs) {
  const productsPath = join(__dirname, '../data', fileForCatalog[catalog]);
  let products;
  try {
    products = JSON.parse(readFileSync(productsPath, 'utf8'));
  } catch (err) {
    console.error(`Nie mogę wczytać ${productsPath}:`, err.message);
    process.exit(1);
  }

  // Zabezpieczenie: jeden wpis na SKU
  const bySku = new Map();
  let dropped = 0;
  for (const p of products) {
    const sku = String(p.sku || '').toUpperCase();
    if (!sku) continue;
    if (bySku.has(sku)) {
      dropped += 1;
      continue;
    }
    bySku.set(sku, {
      ...p,
      sku,
      id: p.id || `${catalog === 'shop' ? 'shop-' : ''}${sku}`,
      catalog: p.catalog || catalog,
    });
  }
  products = [...bySku.values()];
  if (dropped) {
    console.log(`Dropped ${dropped} duplicate SKU rows before upload`);
  }

  const newIds = new Set(products.map((p) => p.id));
  const newSkus = new Set(products.map((p) => p.sku));
  console.log(`\n=== Catalog: ${catalog} (${products.length} products) ===`);

  const existingInCatalog = existingRows.filter(
    (r) => (r.catalog || 'accessories') === catalog,
  );

  // 1) stare ID spoza nowego zestawu
  const obsoleteIds = existingInCatalog
    .map((r) => r.id)
    .filter((id) => !newIds.has(id));

  // 2) konflikty SKU: ten sam catalog+sku, ale inne id (np. shop-SKU-123456)
  const conflictIds = existingInCatalog
    .filter((r) => newSkus.has(String(r.sku || '').toUpperCase()) && !newIds.has(r.id))
    .map((r) => r.id);

  const toDelete = [...new Set([...obsoleteIds, ...conflictIds])];
  await deleteIds(toDelete, `obsolete/conflict ${catalog} products`);

  let done = 0;
  for (let i = 0; i < products.length; i += BATCH) {
    const chunk = products.slice(i, i + BATCH).map((p) => toRow(p, catalog));
    const { error } = await supabase.from('products').upsert(chunk, { onConflict: 'id' });
    if (error) {
      console.error('Error at batch', i, error.message);
      // diagnostyka: znajdź SKU z batcha już istniejące pod innym id
      const skus = chunk.map((r) => r.sku);
      const clashes = existingInCatalog.filter(
        (r) => skus.includes(r.sku) && !chunk.some((c) => c.id === r.id),
      );
      if (clashes.length) {
        console.error(
          'Possible SKU clashes still in DB:',
          clashes.slice(0, 10).map((r) => `${r.id} / ${r.sku}`),
        );
      }
      process.exit(1);
    }
    done += chunk.length;
    console.log(`  upserted ${done}/${products.length}`);
  }
}

console.log('\nDone!');
