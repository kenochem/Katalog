/**
 * Optymalizacja zdjęć produktów pod sklep: format wyłącznie JPG albo PNG (WebP zamieniamy),
 * ograniczony dłuższy bok i limit wagi pliku. Cel: jak najlżejsze zdjęcia na stronie.
 *
 * - bez przezroczystości → JPEG; jakość dobierana tak, żeby plik zmieścił się w limicie
 *   (wyszukiwanie binarne), a gdy nawet minimalna jakość nie wystarcza — zmniejszamy wymiary,
 * - z przezroczystością (wycięte tło) → PNG (zachowuje alfę) albo, na życzenie, JPEG na białym tle,
 * - nigdy nie powiększamy i nie schodzimy poniżej minimum BaseLinkera (500 px krótszego boku).
 */
import { fetchImageBlobForEditing } from './fetchImageBlob';
import { canvasHasAlpha } from './imagePrepare';

export interface OptimizePolicy {
  /** Maksymalny dłuższy bok w px. */
  maxSide: number;
  /** Limit wagi pliku w KB. */
  targetKB: number;
  /** Co zrobić ze zdjęciem z przezroczystością: zostaw PNG albo spłaszcz do JPG na białym tle. */
  alpha: 'png' | 'jpg';
  /** Automatycznie optymalizuj każde nowo wgrywane zdjęcie. */
  autoOnUpload: boolean;
}

export const DEFAULT_POLICY: OptimizePolicy = {
  maxSide: 1200,
  targetKB: 120,
  alpha: 'png',
  autoOnUpload: true,
};

/** Poniżej tego krótszego boku nie schodzimy przy zmniejszaniu (wymóg BaseLinkera). */
const MIN_SHORT_SIDE = 500;
const MIN_QUALITY = 0.5;
const MAX_QUALITY = 0.92;
const KEY = 'katalog-image-policy-v1';

let cached: OptimizePolicy | null = null;

export function getImagePolicy(): OptimizePolicy {
  if (cached) return cached;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<OptimizePolicy>;
      cached = {
        maxSide: clamp(Number(p.maxSide) || DEFAULT_POLICY.maxSide, 600, 3000),
        targetKB: clamp(Number(p.targetKB) || DEFAULT_POLICY.targetKB, 30, 2000),
        alpha: p.alpha === 'jpg' ? 'jpg' : 'png',
        autoOnUpload: p.autoOnUpload !== false,
      };
      return cached;
    }
  } catch {
    /* brak dostępu do localStorage */
  }
  cached = { ...DEFAULT_POLICY };
  return cached;
}

export function setImagePolicy(next: OptimizePolicy): void {
  cached = { ...next };
  try {
    localStorage.setItem(KEY, JSON.stringify(cached));
  } catch {
    /* ignoruj */
  }
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export interface OptimizeResult {
  blob: Blob;
  width: number;
  height: number;
  format: 'jpg' | 'png';
  bytes: number;
  hasAlpha: boolean;
  /** Czy zmieściliśmy się w limicie wagi. */
  reachedTarget: boolean;
  /** Zdjęcie jest za małe (poniżej minimum) — zwrócono oryginał bez zmian. */
  tooSmall: boolean;
}

function toBlob(canvas: HTMLCanvasElement, type: string, q?: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), type, q));
}

async function encodeJpegWithin(
  canvas: HTMLCanvasElement,
  targetBytes: number,
): Promise<{ blob: Blob; ok: boolean }> {
  // spłaszczenie na białe tło (JPEG nie ma alfa)
  const flat = document.createElement('canvas');
  flat.width = canvas.width;
  flat.height = canvas.height;
  const ctx = flat.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Brak obsługi canvas w tej przeglądarce');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, flat.width, flat.height);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(canvas, 0, 0);

  const best = await toBlob(flat, 'image/jpeg', MAX_QUALITY);
  if (!best) throw new Error('Nie udało się zakodować JPEG');
  if (best.size <= targetBytes) return { blob: best, ok: true };

  const worst = await toBlob(flat, 'image/jpeg', MIN_QUALITY);
  if (!worst) throw new Error('Nie udało się zakodować JPEG');
  if (worst.size > targetBytes) return { blob: worst, ok: false };

  let lo = MIN_QUALITY; // mieści się
  let hi = MAX_QUALITY; // nie mieści się
  let bestFit = worst;
  for (let i = 0; i < 6; i++) {
    const mid = (lo + hi) / 2;
    const b = await toBlob(flat, 'image/jpeg', mid);
    if (!b) break;
    if (b.size <= targetBytes) {
      bestFit = b;
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return { blob: bestFit, ok: true };
}

/**
 * Optymalizuje zdjęcie według polityki. `source` — URL lub Blob. Gdy zdjęcie jest mniejsze niż
 * minimum, zwraca oryginał (`tooSmall`) — takie poprawia narzędzie „Za małe”.
 */
export async function optimizeImage(
  source: string | Blob,
  policy: OptimizePolicy = getImagePolicy(),
): Promise<OptimizeResult> {
  const original = await fetchImageBlobForEditing(source);
  const targetBytes = policy.targetKB * 1024;

  // dekodowanie od razu w docelowym rozmiarze (oszczędza pamięć przy dużych zdjęciach)
  const probe = await createImageBitmap(original);
  const sw = probe.width;
  const sh = probe.height;
  probe.close();

  if (Math.min(sw, sh) < MIN_SHORT_SIDE) {
    return {
      blob: original,
      width: sw,
      height: sh,
      format: original.type === 'image/png' ? 'png' : 'jpg',
      bytes: original.size,
      hasAlpha: false,
      reachedTarget: original.size <= targetBytes,
      tooSmall: true,
    };
  }

  let scale = Math.min(1, policy.maxSide / Math.max(sw, sh));
  let tw = Math.max(1, Math.round(sw * scale));
  let th = Math.max(1, Math.round(sh * scale));

  let result: OptimizeResult | null = null;
  for (let attempt = 0; attempt < 8; attempt++) {
    const bmp = await createImageBitmap(original, { resizeWidth: tw, resizeHeight: th, resizeQuality: 'high' });
    try {
      const canvas = document.createElement('canvas');
      canvas.width = bmp.width;
      canvas.height = bmp.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Brak obsługi canvas w tej przeglądarce');
      ctx.drawImage(bmp, 0, 0);
      const hasAlpha = /image\/(png|webp|gif|avif)/i.test(original.type) && canvasHasAlpha(canvas);

      let blob: Blob;
      let ok: boolean;
      let format: 'jpg' | 'png';
      if (hasAlpha && policy.alpha === 'png') {
        const png = await toBlob(canvas, 'image/png');
        if (!png) throw new Error('Nie udało się zakodować PNG');
        blob = png;
        ok = png.size <= targetBytes;
        format = 'png';
      } else {
        const enc = await encodeJpegWithin(canvas, targetBytes);
        blob = enc.blob;
        ok = enc.ok;
        format = 'jpg';
      }
      result = {
        blob,
        width: canvas.width,
        height: canvas.height,
        format,
        bytes: blob.size,
        hasAlpha,
        reachedTarget: ok,
        tooSmall: false,
      };
      if (ok) break;
    } finally {
      bmp.close();
    }
    // nadal za ciężkie → zmniejszamy wymiary (ale nie poniżej minimum)
    const nextScale = scale * 0.88;
    const nw = Math.round(sw * nextScale);
    const nh = Math.round(sh * nextScale);
    if (Math.min(nw, nh) < MIN_SHORT_SIDE) break;
    scale = nextScale;
    tw = nw;
    th = nh;
  }
  if (!result) throw new Error('Nie udało się zoptymalizować zdjęcia');
  return result;
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}
