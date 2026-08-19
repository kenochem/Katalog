import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const publicData = join(root, 'public', 'data');

const FILES = [
  ['products.json', 'products-lite.json'],
  ['shop-products.json', 'shop-products-lite.json'],
];

function lightMeta(meta) {
  if (!meta || typeof meta !== 'object') return undefined;
  const keep = {};
  for (const key of [
    'baselinkerProductId',
    'legacySku',
    'waproSku',
    'previousSku',
    'shopCategoryPath',
    'baselinkerDescriptionImportedAt',
    'baselinkerDescriptionChars',
    'baselinkerDescriptionFull',
    'waproImport',
    'waproSkeleton',
    'waproImportedAt',
    'salesExcludeFromSum',
  ]) {
    if (meta[key] !== undefined && meta[key] !== null && meta[key] !== '') {
      keep[key] = meta[key];
    }
  }
  return Object.keys(keep).length ? keep : undefined;
}

function lightProduct(product) {
  const next = {
    ...product,
    description: '',
  };
  const meta = lightMeta(product.meta);
  if (meta) next.meta = meta;
  else delete next.meta;
  return next;
}

for (const [source, target] of FILES) {
  const sourcePath = join(publicData, source);
  if (!existsSync(sourcePath)) continue;
  const products = JSON.parse(readFileSync(sourcePath, 'utf8'));
  const out = Array.isArray(products) ? products.map(lightProduct) : products;
  const targetPath = join(publicData, target);
  writeFileSync(targetPath, JSON.stringify(out), 'utf8');
  const beforeKb = Math.round(readFileSync(sourcePath).length / 1024);
  const afterKb = Math.round(readFileSync(targetPath).length / 1024);
  console.log(`light-data: ${source} ${beforeKb}KB -> ${target} ${afterKb}KB`);
}
