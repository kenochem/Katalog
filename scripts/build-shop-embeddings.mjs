/**
 * Buduje embeddingi CLIP dla katalogu Produktów (shop).
 * Model: Xenova/clip-vit-base-patch32 — ten sam co w przeglądarce.
 *
 * Uruchomienie:
 *   node scripts/build-shop-embeddings.mjs
 *
 * Wznawia się automatycznie (plik progress).
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { pipeline } from '@xenova/transformers';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PRODUCTS_PATH = join(ROOT, 'data', 'shop-products.json');
const OUT_PATH = join(ROOT, 'data', 'shop-embeddings.json');
const PUBLIC_OUT = join(ROOT, 'public', 'data', 'shop-embeddings.json');
const PROGRESS_PATH = join(ROOT, 'data', 'shop-embeddings.progress.json');

const MODEL = 'Xenova/clip-vit-base-patch32';
const DIM = 512;

function l2normalize(vec) {
  let s = 0;
  for (const v of vec) s += v * v;
  const n = Math.sqrt(s) || 1;
  return Float32Array.from(vec, (v) => v / n);
}

function quantize(vec) {
  // ~2 bajty na wymiar w JSON (zaokrąglenie)
  return Array.from(vec, (v) => Math.round(v * 1e5) / 1e5);
}

async function loadImage(url) {
  const { RawImage } = await import('@xenova/transformers');
  // RawImage.read obsługuje URL bezpośrednio
  return RawImage.read(url);
}

function loadProgress() {
  if (!existsSync(PROGRESS_PATH)) return {};
  try {
    return JSON.parse(readFileSync(PROGRESS_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function saveProgress(map) {
  writeFileSync(PROGRESS_PATH, JSON.stringify(map));
}

const products = JSON.parse(readFileSync(PRODUCTS_PATH, 'utf8'));
const withImages = products.filter((p) => String(p.imageUrl || '').startsWith('http'));
console.log(`Products with images: ${withImages.length}/${products.length}`);
console.log(`Loading CLIP model: ${MODEL} ...`);

const extractor = await pipeline('image-feature-extraction', MODEL, {
  quantized: true,
});

const progress = loadProgress();
let done = Object.keys(progress).length;
console.log(`Resuming with ${done} existing embeddings`);

const started = Date.now();
for (let i = 0; i < withImages.length; i++) {
  const p = withImages[i];
  if (progress[p.id]?.length === DIM) {
    continue;
  }

  try {
    const image = await loadImage(p.imageUrl);
    const out = await extractor(image, { pooling: 'mean', normalize: true });
    const raw = Array.from(out.data);
    const vec = quantize(l2normalize(raw));
    if (vec.length !== DIM) {
      // niektóre wersje zwracają inny kształt — spłaszcz
      const flat = raw.length === DIM ? raw : raw.slice(0, DIM);
      progress[p.id] = quantize(l2normalize(flat));
    } else {
      progress[p.id] = vec;
    }
    done += 1;
  } catch (err) {
    console.warn(`FAIL ${p.sku}: ${err.message || err}`);
  }

  if (done % 25 === 0 || i === withImages.length - 1) {
    saveProgress(progress);
    const elapsed = ((Date.now() - started) / 1000).toFixed(0);
    console.log(`  ${done} embeddings | ${i + 1}/${withImages.length} | ${elapsed}s`);
  }
}

saveProgress(progress);

const payload = {
  model: MODEL,
  dim: DIM,
  createdAt: new Date().toISOString(),
  count: Object.keys(progress).length,
  vectors: progress,
};

mkdirSync(dirname(OUT_PATH), { recursive: true });
writeFileSync(OUT_PATH, JSON.stringify(payload));
mkdirSync(dirname(PUBLIC_OUT), { recursive: true });
writeFileSync(PUBLIC_OUT, JSON.stringify(payload));

console.log(`\nSaved ${payload.count} embeddings → ${OUT_PATH}`);
console.log(`Also copied to ${PUBLIC_OUT}`);
