/**
 * Lens wariant (2): EAN first, potem OCR z bramką marki.
 * Bez Gemini, bez CLIP na telefonie.
 */
import type { Product } from '../types';
import { getProductImage } from './products';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

export interface VisualMatch {
  product: Product;
  score: number;
  reasons: string[];
}

export type RecognizeStatus = 'barcode' | 'ocr' | 'done';

const MAX_RESULTS = 3;

export function isVisionConfigured(): boolean {
  return true;
}

export async function compressImageFile(
  file: Blob,
  maxSide = 1280,
  quality = 0.85,
): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('Nie można odczytać zdjęcia. Spróbuj JPG.');
  }
  try {
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas niedostępny');
    ctx.drawImage(bitmap, 0, 0, w, h);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Kompresja nieudana'))),
        'image/jpeg',
        quality,
      );
    });
  } finally {
    bitmap.close();
  }
}

export async function extractBarcodeFromImage(
  file: Blob,
): Promise<string | null> {
  const id = `lens-scan-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const holder = document.createElement('div');
  holder.id = id;
  holder.style.display = 'none';
  document.body.appendChild(holder);

  const scanner = new Html5Qrcode(id, {
    formatsToSupport: [
      Html5QrcodeSupportedFormats.EAN_13,
      Html5QrcodeSupportedFormats.EAN_8,
      Html5QrcodeSupportedFormats.UPC_A,
      Html5QrcodeSupportedFormats.UPC_E,
      Html5QrcodeSupportedFormats.CODE_128,
    ],
    verbose: false,
  });

  const asFile =
    file instanceof File
      ? file
      : new File([file], 'lens.jpg', { type: file.type || 'image/jpeg' });

  try {
    const decoded = await scanner.scanFile(asFile, false);
    const code = String(decoded || '').trim();
    return code || null;
  } catch {
    return null;
  } finally {
    try {
      scanner.clear();
    } catch {
      /* ignore */
    }
    holder.remove();
  }
}

export function matchByEan(products: Product[], ean: string): VisualMatch[] {
  const q = ean.replace(/\D/g, '');
  if (q.length < 8) return [];

  const matchesEan = (value: string | undefined) => {
    const pe = (value || '').replace(/\D/g, '');
    return !!pe && (pe === q || pe.endsWith(q) || q.endsWith(pe));
  };

  return products
    .filter(
      (p) =>
        matchesEan(p.ean) ||
        (p.variants ?? []).some((v) => matchesEan(v.ean)),
    )
    .map((product) => ({
      product,
      score: 99,
      reasons: ['EAN'],
    }));
}

/** EAN na kilku kadrach — kod bywa na dole etykiety. */
async function extractBarcodeMulti(file: Blob): Promise<string | null> {
  const direct = await extractBarcodeFromImage(file);
  if (direct) return direct;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return null;
  }

  const w = bitmap.width;
  const h = bitmap.height;
  const regions = [
    [0.1, 0.1, 0.8, 0.8],
    [0.05, 0.4, 0.9, 0.55],
    [0.15, 0.5, 0.7, 0.45],
    [0.2, 0.05, 0.6, 0.4],
  ] as const;

  try {
    for (const [fx, fy, fw, fh] of regions) {
      const canvas = document.createElement('canvas');
      const sw = Math.max(1, Math.floor(w * fw));
      const sh = Math.max(1, Math.floor(h * fh));
      const outW = Math.min(1000, sw);
      const scale = outW / sw;
      canvas.width = outW;
      canvas.height = Math.max(1, Math.round(sh * scale));
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) continue;
      ctx.drawImage(
        bitmap,
        Math.floor(w * fx),
        Math.floor(h * fy),
        sw,
        sh,
        0,
        0,
        canvas.width,
        canvas.height,
      );
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', 0.92),
      );
      if (!blob) continue;
      const code = await extractBarcodeFromImage(blob);
      if (code) return code;
    }
  } finally {
    bitmap.close();
  }
  return null;
}

/**
 * Zdjęcie → EAN, potem OCR (tylko w obrębie wykrytej marki).
 */
export async function recognizeProductFromImage(
  file: File,
  products: Product[],
  onStatus?: (status: RecognizeStatus, detail?: string) => void,
): Promise<{
  matches: VisualMatch[];
  barcode: string | null;
  warning?: string;
  method: 'ean' | 'ocr' | 'none';
  ocrText?: string;
  brandsFound?: string[];
}> {
  onStatus?.('barcode', 'Przygotowuję zdjęcie...');
  let work: Blob;
  try {
    work = await compressImageFile(file, 1200, 0.86);
  } catch (err) {
    onStatus?.('done');
    return {
      matches: [],
      barcode: null,
      warning:
        err instanceof Error ? err.message : 'Nie udało się wczytać zdjęcia.',
      method: 'none',
    };
  }

  // 1) EAN
  onStatus?.('barcode', 'Szukam kodu EAN...');
  let barcode: string | null = null;
  try {
    barcode = await extractBarcodeMulti(work);
  } catch (err) {
    console.warn(err);
  }

  if (barcode) {
    const matches = matchByEan(products, barcode).slice(0, MAX_RESULTS);
    if (matches.length) {
      onStatus?.('done');
      return { matches, barcode, method: 'ean' };
    }
  }

  // 2) OCR lokalny (brand-gated) — tylko gdy brak EAN w katalogu
  onStatus?.('ocr', 'Czytam etykietę (OCR lokalnie)...');
  try {
    const { matchByOcr } = await import('./ocrLens');
    const ocrBlob = await compressImageFile(work, 900, 0.88);
    const result = await matchByOcr(ocrBlob, products, (detail) => {
      onStatus?.('ocr', detail);
    });

    if (!barcode && result.eanFromOcr) {
      const eanMatches = matchByEan(products, result.eanFromOcr).slice(
        0,
        MAX_RESULTS,
      );
      if (eanMatches.length) {
        onStatus?.('done');
        return {
          matches: eanMatches,
          barcode: result.eanFromOcr,
          method: 'ean',
          ocrText: result.ocrText,
          brandsFound: result.brandsFound,
        };
      }
    }

    const bySku = new Map(products.map((p) => [p.sku.toUpperCase(), p]));
    const matches: VisualMatch[] = [];
    for (const p of result.picks) {
      const product = bySku.get(p.sku);
      if (!product) continue;
      matches.push({
        product,
        score: p.confidence,
        reasons: p.reason
          ? ['OCR etykiety', p.reason]
          : ['OCR etykiety'],
      });
      if (matches.length >= MAX_RESULTS) break;
    }

    if (matches.length > 0) {
      onStatus?.('done');
      return {
        matches,
        barcode: barcode || result.eanFromOcr,
        method: 'ocr',
        ocrText: result.ocrText,
        brandsFound: result.brandsFound,
        warning:
          matches[0].score < 75
            ? 'Propozycje z etykiety — sprawdź, czy to właściwy produkt.'
            : undefined,
      };
    }

    onStatus?.('done');
    if (barcode) {
      return {
        matches: [],
        barcode,
        ocrText: result.ocrText,
        brandsFound: result.brandsFound,
        warning: `EAN ${barcode} nie ma w katalogu. Zbliż na nazwę marki albo wpisz w wyszukiwarce.`,
        method: 'none',
      };
    }
    if (result.brandsFound.length) {
      return {
        matches: [],
        barcode: null,
        ocrText: result.ocrText,
        brandsFound: result.brandsFound,
        warning: `Wykryto markę ${result.brandsFound.map((b) => b.toUpperCase()).join(', ')}, ale bez pewnego produktu. Zbliż na pełną nazwę albo skanuj EAN.`,
        method: 'none',
      };
    }
    return {
      matches: [],
      barcode: null,
      ocrText: result.ocrText,
      warning:
        'Brak EAN i nie odczytano marki. Najpewniej: kamera na kod EAN albo ostre zbliżenie na napis marki (np. SONAX).',
      method: 'none',
    };
  } catch (err) {
    console.warn(err);
    onStatus?.('done');
    return {
      matches: [],
      barcode,
      warning: barcode
        ? `EAN ${barcode} nie w katalogu. OCR niedostępne — wpisz nazwę ręcznie lub skanuj inny kod.`
        : 'Nie znaleziono EAN. OCR niedostępne — użyj kamery EAN albo wyszukiwarki.',
      method: 'none',
    };
  }
}

export function getProductImageSafe(product: Product): string | null {
  return getProductImage(product);
}
