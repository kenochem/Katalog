/**
 * Wzbogaca shop-embeddings.json o colors (8×8) — pomaga rozróżniać podobne butelki.
 * Tekst CLIP (textVectors) jest opcjonalny i obecnie SŁABO zgrywa się z image-feature-extraction
 * (brak wspólnej przestrzeni projection) — nie używamy go w matchowaniu.
 *
 *   node scripts/enrich-shop-embeddings.mjs
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { pipeline } from '@xenova/transformers';

const require = createRequire(import.meta.url);
const sharp = require('sharp');

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PRODUCTS_PATH = join(ROOT, 'data', 'shop-products.json');
const OUT_PATH = join(ROOT, 'data', 'shop-embeddings.json');
const PUBLIC_OUT = join(ROOT, 'public', 'data', 'shop-embeddings.json');
const PROGRESS_TEXT = join(ROOT, 'data', 'shop-embeddings-text.progress.json');
const PROGRESS_COLOR = join(ROOT, 'data', 'shop-embeddings-color.progress.json');

const MODEL = 'Xenova/clip-vit-base-patch32';
const DIM = 512;
const COLOR_SIDE = 8;

function l2normalize(vec) {
  let s = 0;
  for (const v of vec) s += v * v;
  const n = Math.sqrt(s) || 1;
  return Float32Array.from(vec, (v) => v / n);
}

function quantize(vec) {
  return Array.from(vec, (v) => Math.round(v * 1e5) / 1e5);
}

function loadJson(path, fallback = {}) {
  if (!existsSync(path)) return fallback;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return fallback;
  }
}

async function colorFingerprint(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const { data } = await sharp(buf)
    .resize(COLOR_SIDE, COLOR_SIDE, { fit: 'fill' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  // normalizuj 0..1
  return Array.from(data, (v) => Math.round((v / 255) * 1e4) / 1e4);
}

const products = JSON.parse(readFileSync(PRODUCTS_PATH, 'utf8'));
const pack = loadJson(OUT_PATH, null);
if (!pack?.vectors) {
  console.error('Brak data/shop-embeddings.json — najpierw: npm run embeddings:shop');
  process.exit(1);
}

const withImages = products.filter((p) => String(p.imageUrl || '').startsWith('http'));
console.log(`Enriching ${withImages.length} products…`);

// --- kolory ---
const colors = loadJson(PROGRESS_COLOR, {});
let colorDone = Object.keys(colors).length;
console.log(`Colors resume: ${colorDone}`);
for (let i = 0; i < withImages.length; i++) {
  const p = withImages[i];
  if (colors[p.id]?.length === COLOR_SIDE * COLOR_SIDE * 3) continue;
  try {
    colors[p.id] = await colorFingerprint(p.imageUrl);
    colorDone += 1;
  } catch (err) {
    console.warn(`COLOR FAIL ${p.sku}: ${err.message || err}`);
  }
  if (colorDone % 50 === 0 || i === withImages.length - 1) {
    writeFileSync(PROGRESS_COLOR, JSON.stringify(colors));
    console.log(`  colors ${colorDone}/${withImages.length}`);
  }
}
writeFileSync(PROGRESS_COLOR, JSON.stringify(colors));

// --- tekst CLIP ---
console.log(`Loading CLIP text encoder: ${MODEL} …`);
const textPipe = await pipeline('feature-extraction', MODEL, { quantized: true });
const textVectors = loadJson(PROGRESS_TEXT, {});
let textDone = Object.keys(textVectors).length;
console.log(`Text resume: ${textDone}`);

for (let i = 0; i < products.length; i++) {
  const p = products[i];
  if (!pack.vectors[p.id]) continue;
  if (textVectors[p.id]?.length === DIM) continue;

  const prompt = `a product photo of ${p.displayName || p.name}`;
  try {
    const out = await textPipe(prompt, { pooling: 'mean', normalize: true });
    textVectors[p.id] = quantize(l2normalize(Array.from(out.data)));
    textDone += 1;
  } catch (err) {
    console.warn(`TEXT FAIL ${p.sku}: ${err.message || err}`);
  }

  if (textDone % 50 === 0 || i === products.length - 1) {
    writeFileSync(PROGRESS_TEXT, JSON.stringify(textVectors));
    console.log(`  text ${textDone}`);
  }
}
writeFileSync(PROGRESS_TEXT, JSON.stringify(textVectors));

const payload = {
  ...pack,
  model: MODEL,
  dim: DIM,
  enrichedAt: new Date().toISOString(),
  count: Object.keys(pack.vectors).length,
  colors,
  textVectors,
};

mkdirSync(dirname(OUT_PATH), { recursive: true });
writeFileSync(OUT_PATH, JSON.stringify(payload));
mkdirSync(dirname(PUBLIC_OUT), { recursive: true });
writeFileSync(PUBLIC_OUT, JSON.stringify(payload));

console.log(
  `\nSaved enrich: ${Object.keys(colors).length} colors, ${Object.keys(textVectors).length} text → ${OUT_PATH}`,
);
