/**
 * Test CLIP matching — symuluje zdjęcie z katalogu vs indeks.
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { pipeline, RawImage } from '@xenova/transformers';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SKU = process.argv[2] || 'CIDL0192';

const products = JSON.parse(readFileSync(join(ROOT, 'data', 'shop-products.json'), 'utf8'));
const pack = JSON.parse(readFileSync(join(ROOT, 'public', 'data', 'shop-embeddings.json'), 'utf8'));
const product = products.find((p) => p.sku === SKU);
if (!product) {
  console.error('Product not found:', SKU);
  process.exit(1);
}

function cosine(a, b) {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}

function l2normalize(vec) {
  let s = 0;
  for (const v of vec) s += v * v;
  const n = Math.sqrt(s) || 1;
  return vec.map((v) => v / n);
}

console.log('Product:', product.displayName);
console.log('Image:', product.imageUrl);
console.log('Has embedding:', !!pack.vectors[product.id]);

const extractor = await pipeline('image-feature-extraction', 'Xenova/clip-vit-base-patch32', {
  quantized: true,
});

const image = await RawImage.read(product.imageUrl);
const out = await extractor(image, { pooling: 'mean', normalize: true });
const queryVec = l2normalize(Array.from(out.data));

const scored = [];
for (const [id, vec] of Object.entries(pack.vectors)) {
  const sim = cosine(queryVec, vec);
  const p = products.find((x) => x.id === id);
  scored.push({ id, sku: p?.sku, name: p?.displayName?.slice(0, 60), score: Math.round(sim * 100) });
}
scored.sort((a, b) => b.score - a.score);

console.log('\nTop 10 matches:');
for (const s of scored.slice(0, 10)) {
  console.log(`  ${s.score}% ${s.sku} ${s.name}`);
}

const selfScore = scored.find((s) => s.id === product.id)?.score;
console.log(`\nSelf match score: ${selfScore}%`);
