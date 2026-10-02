import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const SKUS = [
  'HYD000448', 'HYD000241', 'HYD000847', 'HYD000057', 'HYD000573',
  'HYD000199', 'HYD000823', 'HYD000626', 'HYD000605', 'HYD001111',
  'HYD000205', 'HYD000186', 'HYD000178', 'HYD000181', 'HYD000184',
];
const wanted = new Set(SKUS);

function loadJson(rel) {
  return JSON.parse(readFileSync(resolve(ROOT, rel), 'utf8'));
}

const index = loadJson('public/data/baselinker-sku-index.json');
const skuToId = index.skuToId || index.skus || index;
const ids = {};
for (const sku of SKUS) {
  ids[sku] = skuToId[sku] || skuToId[sku.toLowerCase()] || null;
}

function pickFromLite(arr) {
  const out = {};
  for (const row of arr) {
    const sku = String(row.sku || '').toUpperCase();
    if (!wanted.has(sku)) continue;
    out[sku] = {
      name: row.name || row.displayName,
      imageUrl: row.imageUrl || '',
      extra: (row.extraImageUrls || []).slice(0, 5),
      hasImage: row.hasImage,
    };
  }
  return out;
}

const catalog = pickFromLite(loadJson('public/data/products-lite.json'));
const shop = pickFromLite(loadJson('public/data/shop-products-lite.json'));

const report = { ids, catalog, shop };
writeFileSync(resolve(ROOT, 'data/hyd-missing-shop-images.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
