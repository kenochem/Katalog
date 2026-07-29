/**
 * Lokalne OCR → dopasowanie do katalogu.
 * Warstwa 2 po nieudanym EAN: OCR lokalny + bramka marki. Bez CLIP/Gemini.
 */
import { createWorker, type Worker } from 'tesseract.js';
import type { Product } from '../types';
import { createProductSearch, filterProducts } from './search';

export interface OcrPick {
  sku: string;
  confidence: number;
  reason?: string;
}

export interface OcrMatchResult {
  picks: OcrPick[];
  ocrText: string;
  eanFromOcr: string | null;
  brandsFound: string[];
}

const STOP = new Set([
  'the', 'and', 'for', 'with', 'ml', 'ltr', 'lit', 'liter', 'litr', 'litrow',
  'do', 'na', 'od', 'ze', 'za', 'po', 'przy', 'oraz', 'typ', 'type', 'art',
  'szt', 'sztuk', 'pack', 'set', 'new', 'pro', 'max', 'plus', 'extra',
  'produkt', 'preparat', 'srodek', 'srodek', 'chemii', 'chemia',
]);

/** Częste pomyłki OCR na markach z katalogu. */
const OCR_BRAND_FIXES: Array<[RegExp, string]> = [
  [/\bs0nax\b/g, 'sonax'],
  [/\b5onax\b/g, 'sonax'],
  [/\bsonax\b/g, 'sonax'],
  [/\bvikan\b/g, 'vikan'],
  [/\bvlkan\b/g, 'vikan'],
  [/\bkenotek\b/g, 'kenotek'],
  [/\bken0tek\b/g, 'kenotek'],
  [/\btenzi\b/g, 'tenzi'],
  [/\bcartec\b/g, 'cartec'],
  [/\bkwazar\b/g, 'kwazar'],
  [/\bsoft99\b/g, 'soft99'],
  [/\bdraco\b/g, 'draco'],
];

let worker: Worker | null = null;
let workerLoading: Promise<Worker> | null = null;

async function getOcrWorker(): Promise<Worker> {
  if (worker) return worker;
  if (!workerLoading) {
    workerLoading = (async () => {
      // Jawne CDN — Vite/Firebase nie psuje workerów
      const w = await createWorker('eng', 1, {
        logger: () => {},
        workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/worker.min.js',
        corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5/tesseract-core.wasm.js',
        langPath: 'https://tessdata.projectnaptha.com/4.0.0',
      });
      worker = w;
      return w;
    })().catch((err) => {
      workerLoading = null;
      throw err;
    });
  }
  return workerLoading;
}

function normalizeText(s: string): string {
  let t = s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  for (const [re, fix] of OCR_BRAND_FIXES) {
    t = t.replace(re, fix);
  }
  return t;
}

function tokenize(s: string): string[] {
  return normalizeText(s)
    .split(' ')
    .filter((w) => w.length >= 3 && !STOP.has(w) && !/^\d+$/.test(w));
}

export function collectCatalogBrands(products: Product[]): string[] {
  const counts = new Map<string, number>();
  for (const p of products) {
    const m = (p.manufacturer || '').trim();
    if (m.length < 3) continue;
    if (/^(inni|akcesoria|dyfuzor)/i.test(m)) continue;
    const key = normalizeText(m);
    const short = key.split(' ').slice(0, 2).join(' ');
    const brand = short.length >= 3 ? short : key;
    counts.set(brand, (counts.get(brand) || 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, n]) => n >= 2)
    .map(([b]) => b)
    .sort((a, b) => b.length - a.length);
}

export function detectBrandsInText(ocrNorm: string, brands: string[]): string[] {
  const found: string[] = [];
  const compactOcr = ocrNorm.replace(/\s/g, '');
  for (const b of brands) {
    if (b.length < 3) continue;
    if (ocrNorm.includes(b)) {
      found.push(b);
      continue;
    }
    const compact = b.replace(/\s/g, '');
    if (compact.length >= 4 && compactOcr.includes(compact)) {
      found.push(b);
    }
  }
  return [...new Set(found)];
}

function extractEanFromText(text: string): string | null {
  const candidates = text.replace(/\D/g, ' ').match(/\b\d{8,14}\b/g) || [];
  const ranked = [...candidates].sort((a, b) => {
    const score = (x: string) =>
      x.length === 13 ? 3 : x.length === 12 ? 2 : x.length === 8 ? 1 : 0;
    return score(b) - score(a);
  });
  return ranked[0] || null;
}

function extractVolumes(text: string): string[] {
  const n = normalizeText(text);
  const out: string[] = [];
  const re = /\b(\d+[.,]?\d*)\s*(ml|l|ltr|lit|litr)\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(n))) {
    const num = m[1].replace(',', '.');
    const unit = m[2].startsWith('m') ? 'ml' : 'l';
    out.push(`${num}${unit}`);
    if (unit === 'l') out.push(`${Math.round(parseFloat(num) * 1000)}ml`);
    if (unit === 'ml' && parseFloat(num) >= 1000) {
      out.push(`${parseFloat(num) / 1000}l`);
    }
  }
  return [...new Set(out)];
}

function productMatchesBrand(p: Product, brand: string): boolean {
  const m = normalizeText(p.manufacturer || '');
  const dn = normalizeText(p.displayName || '');
  const sku = normalizeText(p.sku || '');
  if (m.includes(brand) || brand.includes(m.split(' ')[0] || '___')) return true;
  if (brand.length >= 4 && (dn.startsWith(brand) || dn.includes(` ${brand} `) || dn.includes(brand))) {
    return true;
  }
  if (brand === 'sonax' && sku.startsWith('son')) return true;
  if (brand === 'vikan' && sku.startsWith('vika')) return true;
  if (brand === 'kenotek' && (sku.startsWith('ken') || sku.startsWith('kte'))) return true;
  return false;
}

function scoreWithinBrand(
  p: Product,
  ocrTokens: Set<string>,
  ocrNorm: string,
  volumes: string[],
  brandsFound: string[],
): { score: number; hits: string[] } {
  const nameTokens = tokenize(p.displayName).filter((t) => t.length >= 4);
  const hitSet = new Set<string>();

  for (const t of nameTokens) {
    if (STOP.has(t)) continue;
    if (brandsFound.some((b) => t === b || b.includes(t) || t.includes(b))) continue;

    let matched = false;
    if (ocrTokens.has(t)) matched = true;
    else if (ocrNorm.includes(t)) matched = true;
    else {
      for (const ot of ocrTokens) {
        if (
          ot.length >= 4 &&
          t.length >= 4 &&
          (ot.startsWith(t.slice(0, 4)) || t.startsWith(ot.slice(0, 4)))
        ) {
          matched = true;
          break;
        }
      }
    }
    if (matched) hitSet.add(t);
  }

  const hits = [...hitSet];
  let score = 35 + hits.length * 16;
  for (const h of hits) {
    if (h.length >= 8) score += 6;
    else if (h.length >= 6) score += 3;
  }

  const dn = normalizeText(p.displayName);
  for (const v of volumes) {
    if (
      dn.includes(v) ||
      dn.includes(v.replace('ml', ' ml')) ||
      dn.includes(v.replace(/l$/, ' l'))
    ) {
      score += 10;
      hits.push(v);
      break;
    }
  }

  const codeHits = (p.displayName.match(/\b\d{2,4}[.\s-]?\d{2,4}\b/g) || []).map((c) =>
    c.replace(/\D/g, ''),
  );
  const ocrDigits = ocrNorm.replace(/\s/g, '');
  for (const c of codeHits) {
    if (c.length >= 5 && ocrDigits.includes(c)) {
      score += 22;
      hits.push(c);
      break;
    }
  }

  return { score: Math.min(97, score), hits };
}

export async function prepareOcrImage(blob: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  const maxSide = 900;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) {
    bitmap.close();
    return blob;
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  try {
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      let y = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      y = (y - 128) * 1.4 + 128;
      y = Math.max(0, Math.min(255, y));
      d[i] = d[i + 1] = d[i + 2] = y;
    }
    ctx.putImageData(img, 0, 0);
  } catch {
    /* ignore */
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('OCR preprocess failed'))),
      'image/jpeg',
      0.9,
    );
  });
}

export async function matchByOcr(
  imageBlob: Blob,
  products: Product[],
  onProgress?: (detail: string) => void,
): Promise<OcrMatchResult> {
  if (!products.length) {
    return { picks: [], ocrText: '', eanFromOcr: null, brandsFound: [] };
  }

  onProgress?.('Ładowanie OCR...');
  const w = await getOcrWorker();
  onProgress?.('Czytam etykietę...');

  let prepared = imageBlob;
  try {
    prepared = await prepareOcrImage(imageBlob);
  } catch {
    /* raw */
  }

  const {
    data: { text },
  } = await w.recognize(prepared);

  const ocrText = (text || '').trim();
  const ocrNorm = normalizeText(ocrText);
  const eanFromOcr = extractEanFromText(ocrText);
  const brands = collectCatalogBrands(products);
  const brandsFound = detectBrandsInText(ocrNorm, brands);

  if (eanFromOcr) {
    const eanHits = filterProducts(products, eanFromOcr, 'Wszystkie');
    if (eanHits.length > 0) {
      return {
        picks: eanHits.slice(0, 3).map((p, i) => ({
          sku: p.sku.toUpperCase(),
          confidence: Math.max(85, 98 - i * 3),
          reason: `EAN ${eanFromOcr}`,
        })),
        ocrText,
        eanFromOcr,
        brandsFound,
      };
    }
  }

  const ocrTokens = new Set(tokenize(ocrText));
  const volumes = extractVolumes(ocrText);
  const query = [brandsFound[0], ...[...ocrTokens].slice(0, 8)].filter(Boolean).join(' ');

  // 1) Z marką — szukamy TYLKO w tej marce
  if (brandsFound.length) {
    const pool = products.filter((p) =>
      brandsFound.some((b) => productMatchesBrand(p, b)),
    );

    const scored: OcrPick[] = [];
    for (const p of pool) {
      const { score, hits } = scoreWithinBrand(
        p,
        ocrTokens,
        ocrNorm,
        volumes,
        brandsFound,
      );
      const productHits = hits.filter(
        (h) => !brandsFound.some((b) => h === b || h.includes(b) || b.includes(h)),
      );
      if (productHits.length >= 1 && score >= 55) {
        scored.push({
          sku: p.sku.toUpperCase(),
          confidence: Math.min(96, score),
          reason: `${brandsFound[0].toUpperCase()} · ${productHits.slice(0, 4).join(', ')}`,
        });
      }
    }

    if (scored.length === 0 && query.length >= 4) {
      const fuse = createProductSearch(pool);
      for (const hit of fuse.search(query, { limit: 5 })) {
        const sim = 1 - Math.min(1, hit.score ?? 0.4);
        const confidence = Math.round(Math.min(88, 50 + sim * 45));
        if (confidence < 55) continue;
        scored.push({
          sku: hit.item.sku.toUpperCase(),
          confidence,
          reason: `marka ${brandsFound[0].toUpperCase()} + tekst`,
        });
      }
    }

    scored.sort((a, b) => b.confidence - a.confidence);
    let picks = scored.slice(0, 3);
    if (picks[0] && (picks[1]?.confidence ?? 0) < picks[0].confidence - 12) {
      picks = [picks[0]];
    }

    // Ostateczny fallback: sama marka znaleziona → top 3 z Fuse po samym brandzie
    if (!picks.length) {
      const fuse = createProductSearch(pool);
      picks = fuse.search(brandsFound[0], { limit: 3 }).map((hit, i) => ({
        sku: hit.item.sku.toUpperCase(),
        confidence: Math.max(50, 72 - i * 6),
        reason: `marka ${brandsFound[0].toUpperCase()} — wybierz właściwy`,
      }));
    }

    return { picks, ocrText, eanFromOcr, brandsFound };
  }

  // 2) Bez marki — tylko jeśli OCR dał sensowny tekst (Fuse globalnie, ostrożnie)
  if (query.replace(/\s/g, '').length >= 6) {
    const fuse = createProductSearch(products);
    const picks = fuse
      .search(query, { limit: 5 })
      .map((hit, i) => {
        const sim = 1 - Math.min(1, hit.score ?? 0.5);
        return {
          sku: hit.item.sku.toUpperCase(),
          confidence: Math.round(Math.min(80, 45 + sim * 40 - i * 3)),
          reason: `tekst: ${query.slice(0, 40)}`,
        };
      })
      .filter((p) => p.confidence >= 62)
      .slice(0, 3);

    return { picks, ocrText, eanFromOcr, brandsFound };
  }

  return { picks: [], ocrText, eanFromOcr, brandsFound };
}

export function filterProductsByBrands(
  products: Product[],
  brands: string[],
): Product[] {
  if (!brands.length) return [];
  return products.filter((p) => brands.some((b) => productMatchesBrand(p, b)));
}
