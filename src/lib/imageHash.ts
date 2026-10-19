import { fetchImageBlobForEditing } from './fetchImageBlob';

/**
 * Porównywanie zdjęć „na oko” (hash percepcyjny dHash): to samo zdjęcie po obróbce
 * (zmiana rozmiaru, wycięcie tła, margines, inny format) ma inny adres i plik, ale bardzo podobny hash.
 * Służy do walidacji przy zaciąganiu zdjęć z BaseLinkera, żeby nie dodawać kopii tego, co już mamy.
 */

const HASH_W = 9;
const HASH_H = 8;
const NEAR_WHITE = 245;

function luminance(r: number, g: number, b: number, a: number): number {
  // przezroczystość traktujemy jak białe tło
  const alpha = a / 255;
  const rr = r * alpha + 255 * (1 - alpha);
  const gg = g * alpha + 255 * (1 - alpha);
  const bb = b * alpha + 255 * (1 - alpha);
  return 0.299 * rr + 0.587 * gg + 0.114 * bb;
}

/** Hash dHash (64 bity, zapis szesnastkowy) z pikseli RGBA; przycina jasne marginesy (białe tło). */
export function dHashFromRGBA(data: ArrayLike<number>, width: number, height: number): string {
  const gray = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    gray[i] = luminance(data[i * 4], data[i * 4 + 1], data[i * 4 + 2], data[i * 4 + 3]);
  }
  // granice treści (wszystko ciemniejsze od prawie-bieli)
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (gray[y * width + x] < NEAR_WHITE) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) {
    minX = 0;
    minY = 0;
    maxX = width - 1;
    maxY = height - 1;
  }
  const cw = maxX - minX + 1;
  const ch = maxY - minY + 1;

  // uśrednianie do siatki 9x8
  const cells = new Float32Array(HASH_W * HASH_H);
  for (let gy = 0; gy < HASH_H; gy++) {
    for (let gx = 0; gx < HASH_W; gx++) {
      const x0 = minX + Math.floor((gx * cw) / HASH_W);
      const x1 = Math.max(x0 + 1, minX + Math.floor(((gx + 1) * cw) / HASH_W));
      const y0 = minY + Math.floor((gy * ch) / HASH_H);
      const y1 = Math.max(y0 + 1, minY + Math.floor(((gy + 1) * ch) / HASH_H));
      let sum = 0;
      let n = 0;
      for (let y = y0; y < y1 && y < height; y++) {
        for (let x = x0; x < x1 && x < width; x++) {
          sum += gray[y * width + x];
          n++;
        }
      }
      cells[gy * HASH_W + gx] = n ? sum / n : 255;
    }
  }

  let bits = '';
  for (let gy = 0; gy < HASH_H; gy++) {
    for (let gx = 0; gx < HASH_W - 1; gx++) {
      bits += cells[gy * HASH_W + gx] > cells[gy * HASH_W + gx + 1] ? '1' : '0';
    }
  }
  let hex = '';
  for (let i = 0; i < 64; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  return hex;
}

/** Odległość Hamminga między hashami (0 = identyczne, 64 = zupełnie różne). */
export function hashDistance(a: string, b: string): number {
  if (a.length !== b.length) return 64;
  let d = 0;
  for (let i = 0; i < a.length; i++) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (x) {
      d += x & 1;
      x >>= 1;
    }
  }
  return d;
}

/** Próg: do tylu bitów różnicy uznajemy zdjęcia za to samo (po obróbce). */
export const SAME_IMAGE_DISTANCE = 10;

export function isSameImage(a: string, b: string): boolean {
  return hashDistance(a, b) <= SAME_IMAGE_DISTANCE;
}

const hashCache = new Map<string, Promise<string | null>>();

/** Pobiera zdjęcie (z pominięciem CORS) i liczy jego hash; null, gdy nie da się wczytać. */
export function imageHashOf(url: string): Promise<string | null> {
  const key = url.replace(/[?#].*$/, '');
  const hit = hashCache.get(key);
  if (hit) return hit;
  const p = (async () => {
    try {
      const blob = await fetchImageBlobForEditing(url);
      const bmp = await createImageBitmap(blob);
      const scale = Math.min(1, 160 / Math.max(bmp.width, bmp.height));
      const w = Math.max(1, Math.round(bmp.width * scale));
      const h = Math.max(1, Math.round(bmp.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return null;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(bmp, 0, 0, w, h);
      bmp.close?.();
      const { data } = ctx.getImageData(0, 0, w, h);
      return dHashFromRGBA(data, w, h);
    } catch {
      return null;
    }
  })();
  hashCache.set(key, p);
  return p;
}

/**
 * Z listy zdjęć z BL wybiera te, które NIE wyglądają jak żadne zdjęcie z katalogu
 * (zdjęcia, których nie da się wczytać do porównania, zostają — traktujemy je jako nowe).
 * `similar` zawiera pominięte jako „to samo po obróbce”.
 */
export async function filterVisuallyNew(
  candidates: string[],
  catalogUrls: string[],
  concurrency = 4,
): Promise<{ fresh: string[]; similar: string[] }> {
  if (!candidates.length || !catalogUrls.length) return { fresh: candidates, similar: [] };
  const own = (await mapLimit(catalogUrls.slice(0, 8), concurrency, imageHashOf)).filter((h): h is string => !!h);
  if (!own.length) return { fresh: candidates, similar: [] };
  const hashes = await mapLimit(candidates, concurrency, imageHashOf);
  const fresh: string[] = [];
  const similar: string[] = [];
  candidates.forEach((u, i) => {
    const h = hashes[i];
    if (h && own.some((o) => isSameImage(o, h))) similar.push(u);
    else fresh.push(u);
  });
  return { fresh, similar };
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}
