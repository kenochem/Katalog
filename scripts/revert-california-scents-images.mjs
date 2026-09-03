/**
 * Cofa błędną podmianę zdjęć California Scents (californiascents.com → kenochem.com).
 * Używa data/california-scents-image-fix-preview.json zapisany przed zmianą.
 *
 *   node --env-file=.env scripts/revert-california-scents-images.mjs --apply
 */
import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = resolve(import.meta.dirname, '..');
const PREVIEW = resolve('data/california-scents-image-fix-preview.json');
const APPLY = process.argv.includes('--apply');

if (!existsSync(PREVIEW)) {
  console.error('Brak pliku preview:', PREVIEW);
  process.exit(1);
}

const plan = JSON.parse(readFileSync(PREVIEW, 'utf8'));
const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Brak Supabase w .env');
  process.exit(1);
}

function revertPatch(item) {
  const extras = (item.patch?.extra_images || []).filter(
    (u) => !/californiascents\.com/i.test(String(u)),
  );
  return {
    image_url: item.before,
    extra_images: extras,
    has_image: Boolean(item.before || extras.length),
  };
}

console.log(`Do cofnięcia: ${plan.length} produktów`);
for (const item of plan) {
  console.log(`  ${item.sku}: californiascents -> kenochem`);
}

if (!APPLY) {
  console.log('Dry-run. Dodaj --apply.');
  process.exit(0);
}

const supabase = createClient(url, key);
const updatesBySku = new Map();

for (const item of plan) {
  const patch = revertPatch(item);
  const { error } = await supabase.from('products').update(patch).eq('id', item.id);
  if (error) throw new Error(`${item.sku}: ${error.message}`);
  updatesBySku.set(String(item.sku).trim().toUpperCase(), patch);
}

for (const filename of ['shop-products.json', 'products.json']) {
  for (const dir of ['data', join('public', 'data')]) {
    const filePath = join(ROOT, dir, filename);
    if (!existsSync(filePath)) continue;
    const products = JSON.parse(readFileSync(filePath, 'utf8'));
    let n = 0;
    for (const p of products) {
      const sku = String(p.sku || '').trim().toUpperCase();
      const patch = updatesBySku.get(sku);
      if (!patch) continue;
      p.imageUrl = patch.image_url;
      p.extraImageUrls = patch.extra_images;
      p.hasImage = patch.has_image;
      n++;
    }
    if (n) writeFileSync(filePath, JSON.stringify(products), 'utf8');
    console.log(`${join(dir, filename)}: ${n}`);
  }
}

spawnSync(process.execPath, ['scripts/generate-light-product-data.mjs'], {
  cwd: ROOT,
  stdio: 'inherit',
});
console.log('Cofnięto błędne zdjęcia California Scents.');
