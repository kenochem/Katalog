/**
 * Eksport biblioteki wiedzy o produktach (JSON + JSONL) pod boty AI / RAG.
 *
 *   node --env-file=.env scripts/export-product-knowledge.mjs
 *   node --env-file=.env scripts/export-product-knowledge.mjs --batch-size 400
 *
 * Pliki: public/data/knowledge/
 */
import { createClient } from '@supabase/supabase-js';
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT_DIR = join(ROOT, 'public/data/knowledge');

const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const batchSize = Number(process.argv.find((a) => a.startsWith('--batch-size='))?.split('=')[1]) || 500;

if (!url || !key) {
  console.error('Potrzebne SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, key);

function rowToProduct(row) {
  const meta = row.product_meta && typeof row.product_meta === 'object' ? row.product_meta : {};
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    displayName: row.display_name || row.name,
    category: row.category,
    manufacturer: row.manufacturer,
    ean: row.ean,
    catalog: row.catalog || 'accessories',
    description: row.description,
    tags: row.tags || [],
    stock: row.stock,
    hasImage: row.has_image,
    imageUrl: row.image_url,
    customImageUrl: row.custom_image_url,
    extraImageUrls: row.extra_images || [],
    isGroup: row.is_group,
    variants: row.variants || [],
    meta,
    warehouseLocation: row.warehouse_location,
  };
}

function stripHtml(s) {
  return (s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function formatDimensions(meta) {
  const w = meta.widthCm;
  const h = meta.heightCm;
  const d = meta.depthCm;
  const parts = [w, h, d].filter((n) => n != null && !Number.isNaN(n));
  if (parts.length < 2) return '';
  return parts.map((n) => `${n} cm`).join(' × ');
}

function assessProductKnowledge(p) {
  const meta = p.meta || {};
  const checks = [
    { weight: 22, ok: (meta.shortDescription?.trim().length ?? 0) >= 18 },
    { weight: 22, ok: stripHtml(p.description).length >= 40 },
    { weight: 18, ok: Object.keys(meta.parameters ?? {}).length >= 2 },
    {
      weight: 10,
      ok: !!p.ean?.trim() || !!(p.variants?.some((v) => v.ean?.trim())),
    },
    { weight: 10, ok: !!(p.hasImage || p.imageUrl || p.customImageUrl) },
    {
      weight: 6,
      ok: (() => {
        const m = p.manufacturer?.trim().toLowerCase();
        return !!m && m !== 'wapro';
      })(),
    },
    {
      weight: 6,
      ok: meta.weightKg != null || !!formatDimensions(meta) || !!meta.unit?.trim(),
    },
    { weight: 6, ok: !!p.warehouseLocation?.trim() },
  ];
  let score = 0;
  const missing = [];
  const labels = [
    'Krótki opis (co to jest)',
    'Opis pełny',
    'Parametry techniczne',
    'EAN',
    'Zdjęcie',
    'Producent',
    'Logistyka (waga / wymiary / j.m.)',
    'Lokalizacja magazynowa',
  ];
  checks.forEach((c, i) => {
    if (c.ok) score += c.weight;
    else missing.push(labels[i]);
  });
  score = Math.min(100, score);
  let level = 'weak';
  if (score >= 85) level = 'rich';
  else if (score >= 65) level = 'good';
  else if (score >= 40) level = 'fair';
  return { score, level, missing };
}

function buildRecord(p) {
  const meta = p.meta || {};
  const desc = stripHtml(p.description);
  const short = meta.shortDescription?.trim() || null;
  const params = meta.parameters && Object.keys(meta.parameters).length ? meta.parameters : null;
  const catalogLabel = p.catalog === 'shop' ? 'Produkty' : 'Akcesoria';
  const completeness = assessProductKnowledge(p);

  const lines = [
    `Produkt Kenochem: ${p.displayName}`,
    `SKU: ${p.sku}`,
    p.ean ? `EAN: ${p.ean}` : null,
    `Katalog: ${catalogLabel}`,
    `Kategoria: ${p.category}`,
    p.manufacturer ? `Producent: ${p.manufacturer}` : null,
    p.stock != null ? `Stan magazynowy: ${p.stock}` : null,
    p.warehouseLocation ? `Lokalizacja: ${p.warehouseLocation}` : null,
    meta.weightKg != null ? `Waga: ${meta.weightKg} kg` : null,
    short ? `Krótki opis: ${short}` : null,
    desc ? `Opis: ${desc}` : null,
  ].filter(Boolean);

  if (params) {
    lines.push('Parametry:');
    for (const [k, v] of Object.entries(params)) {
      lines.push(`${k}: ${v}`);
    }
  }

  return {
    id: p.id,
    sku: p.sku,
    ean: p.ean || null,
    catalog: catalogLabel,
    category: p.category,
    name: p.name,
    displayName: p.displayName,
    manufacturer: p.manufacturer || null,
    descriptionPlain: desc || null,
    shortDescription: short,
    parameters: params,
    tags: p.tags,
    stock: p.stock,
    hasImage: !!p.hasImage,
    imageUrl: p.imageUrl || p.customImageUrl || null,
    knowledgeText: lines.join('\n'),
    completenessScore: completeness.score,
    completenessLevel: completeness.level,
    missingKnowledge: completeness.missing,
  };
}

const all = [];
let from = 0;
const page = 1000;
while (true) {
  const { data, error } = await supabase
    .from('products')
    .select(
      'id, sku, name, display_name, category, manufacturer, ean, catalog, description, tags, stock, has_image, image_url, custom_image_url, extra_images, is_group, variants, product_meta, warehouse_location',
    )
    .order('sku')
    .range(from, from + page - 1);
  if (error) throw error;
  if (!data?.length) break;
  for (const row of data) {
    all.push(buildRecord(rowToProduct(row)));
  }
  if (data.length < page) break;
  from += page;
}

mkdirSync(OUT_DIR, { recursive: true });

const batches = [];
for (let i = 0; i < all.length; i += batchSize) {
  const chunk = all.slice(i, i + batchSize);
  const n = String(Math.floor(i / batchSize) + 1).padStart(2, '0');
  const file = `batch-${n}.jsonl`;
  const path = join(OUT_DIR, file);
  writeFileSync(
    path,
    chunk.map((r) => JSON.stringify(r)).join('\n') + '\n',
    'utf8',
  );
  batches.push({
    file,
    count: chunk.length,
    skuFrom: chunk[0]?.sku,
    skuTo: chunk[chunk.length - 1]?.sku,
  });
}

const manifest = {
  updatedAt: new Date().toISOString(),
  source: 'kenochem-katalog',
  totalProducts: all.length,
  batchSize,
  batches,
  usage:
    'Każda linia w batch-*.jsonl to JSON produktu. Pole knowledgeText — gotowy chunk do RAG. Crawl: /data/knowledge/manifest.json',
  contentPhases: [
    { phase: 1, name: 'Tożsamość', fields: ['sku', 'ean', 'name', 'catalog', 'category'] },
    { phase: 2, name: 'Opisy', fields: ['shortDescription', 'descriptionPlain', 'parameters'] },
    { phase: 3, name: 'Logistyka', fields: ['stock', 'warehouseLocation', 'weightKg', 'dimensions'] },
    { phase: 4, name: 'Media', fields: ['imageUrl', 'hasImage'] },
  ],
};

writeFileSync(join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

console.log(`Zapisano ${all.length} produktów → public/data/knowledge/ (${batches.length} paczek JSONL)`);
