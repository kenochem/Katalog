/**
 * Przygotowanie zdjecia produktu pod BaseLinker / marketplace: minimalny rozmiar
 * (domyslnie 500x500 px). Zdjecia mniejsze sa powiekszane (z zachowaniem proporcji),
 * opcjonalnie dopelniane do kwadratu. Przezroczystosc (wyciete tlo) zostaje zachowana.
 */
import { fetchImageBlobForEditing } from './fetchImageBlob';

export const BASELINKER_MIN_SIDE = 500;

export type PrepareMode = 'scale' | 'square';

export interface PrepareResult {
  blob: Blob;
  width: number;
  height: number;
  /** false = zdjecie juz spelnialo wymagania i nie wymagalo zmian rozmiaru. */
  resized: boolean;
  hasAlpha: boolean;
}

/** Maksymalna dluzsza krawedz po powiekszeniu — zabezpieczenie przed absurdalnie wielkim plikiem. */
const MAX_SIDE = 3000;

async function decode(source: string | Blob): Promise<ImageBitmap> {
  const blob = await fetchImageBlobForEditing(source);
  return createImageBitmap(blob);
}

export async function readImageSize(
  source: string | Blob,
): Promise<{ width: number; height: number }> {
  const bmp = await decode(source);
  try {
    return { width: bmp.width, height: bmp.height };
  } finally {
    bmp.close();
  }
}

function canvasHasAlpha(canvas: HTMLCanvasElement): boolean {
  try {
    const side = 160;
    const scale = Math.min(1, side / Math.max(canvas.width, canvas.height));
    const w = Math.max(1, Math.round(canvas.width * scale));
    const h = Math.max(1, Math.round(canvas.height * scale));
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (!ctx) return false;
    ctx.drawImage(canvas, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h).data;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 250) return true;
    }
    return false;
  } catch {
    return false;
  }
}

/** Powiekszanie/pomniejszanie etapami (max x2 na krok) — jakosc lepsza niz jeden duzy skok. */
function resizeStepwise(
  src: CanvasImageSource,
  srcW: number,
  srcH: number,
  targetW: number,
  targetH: number,
): HTMLCanvasElement {
  let cur: CanvasImageSource = src;
  let cw = srcW;
  let ch = srcH;
  let canvas = document.createElement('canvas');
  while (cw !== targetW || ch !== targetH) {
    const nw = targetW > cw ? Math.min(targetW, cw * 2) : Math.max(targetW, Math.ceil(cw / 2));
    const nh = targetH > ch ? Math.min(targetH, ch * 2) : Math.max(targetH, Math.ceil(ch / 2));
    const next = document.createElement('canvas');
    next.width = nw;
    next.height = nh;
    const ctx = next.getContext('2d');
    if (!ctx) throw new Error('Brak obslugi canvas w tej przegladarce');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(cur, 0, 0, nw, nh);
    cur = next;
    canvas = next;
    cw = nw;
    ch = nh;
  }
  if (cur === src) {
    canvas.width = srcW;
    canvas.height = srcH;
    canvas.getContext('2d')?.drawImage(src, 0, 0);
  }
  return canvas;
}

function toBlob(canvas: HTMLCanvasElement, type: string, q?: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), type, q));
}

export async function prepareImage(
  source: string | Blob,
  mode: PrepareMode,
  minSide = BASELINKER_MIN_SIDE,
): Promise<PrepareResult> {
  const bmp = await decode(source);
  try {
    const sw = bmp.width;
    const sh = bmp.height;

    // krok 1: czy trzeba powiekszac
    let tw = sw;
    let th = sh;
    const shortSide = Math.min(sw, sh);
    if (shortSide < minSide) {
      let factor = minSide / shortSide;
      const longAfter = Math.max(sw, sh) * factor;
      if (longAfter > MAX_SIDE) factor = MAX_SIDE / Math.max(sw, sh);
      tw = Math.max(1, Math.round(sw * factor));
      th = Math.max(1, Math.round(sh * factor));
    }
    // dla trybu kwadratowego wystarczy, ze DLUZSZY bok ma >= minSide (resztę dopelnia tlo)
    if (mode === 'square') {
      const longSide = Math.max(sw, sh);
      if (longSide >= minSide) {
        tw = sw;
        th = sh;
      } else {
        const f = minSide / longSide;
        tw = Math.max(1, Math.round(sw * f));
        th = Math.max(1, Math.round(sh * f));
      }
    }

    const resizedChanged = tw !== sw || th !== sh;
    let canvas: HTMLCanvasElement =
      resizedChanged || mode === 'square'
        ? resizeStepwise(bmp, sw, sh, tw, th)
        : (() => {
            const c = document.createElement('canvas');
            c.width = sw;
            c.height = sh;
            c.getContext('2d')?.drawImage(bmp, 0, 0);
            return c;
          })();

    const hasAlpha = canvasHasAlpha(canvas);

    let squared = false;
    if (mode === 'square' && canvas.width !== canvas.height) {
      const side = Math.max(canvas.width, canvas.height, minSide);
      const sq = document.createElement('canvas');
      sq.width = side;
      sq.height = side;
      const ctx = sq.getContext('2d', { alpha: hasAlpha });
      if (!ctx) throw new Error('Brak obslugi canvas w tej przegladarce');
      if (!hasAlpha) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, side, side);
      }
      ctx.drawImage(
        canvas,
        Math.round((side - canvas.width) / 2),
        Math.round((side - canvas.height) / 2),
      );
      canvas = sq;
      squared = true;
    } else if (mode === 'square' && canvas.width < minSide) {
      // idealny kwadrat mniejszy niz minimum - juz powiekszony wyzej
      squared = true;
    }

    let blob: Blob | null = null;
    if (hasAlpha) {
      blob = await toBlob(canvas, 'image/webp', 0.95);
      if (!blob || blob.type !== 'image/webp') blob = await toBlob(canvas, 'image/png');
    } else {
      // JPEG nie ma alfa: biale tlo zamiast czerni
      const flat = document.createElement('canvas');
      flat.width = canvas.width;
      flat.height = canvas.height;
      const fctx = flat.getContext('2d', { alpha: false });
      if (!fctx) throw new Error('Brak obslugi canvas w tej przegladarce');
      fctx.fillStyle = '#ffffff';
      fctx.fillRect(0, 0, flat.width, flat.height);
      fctx.drawImage(canvas, 0, 0);
      blob = await toBlob(flat, 'image/jpeg', 0.92);
    }
    if (!blob || blob.size === 0) throw new Error('Nie udalo sie zakodowac obrazu');

    return {
      blob,
      width: canvas.width,
      height: canvas.height,
      resized: resizedChanged || squared,
      hasAlpha,
    };
  } finally {
    bmp.close();
  }
}

export function meetsMinSize(width: number, height: number, minSide = BASELINKER_MIN_SIDE): boolean {
  return width >= minSide && height >= minSide;
}
