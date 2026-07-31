/**
 * Lens: tylko rozpoznawanie wizualne (CLIP) vs zdjęcia katalogu.
 * Czytnik EAN w katalogu jest osobny — tu nie szukamy kodów.
 */
import type { Product } from '../types';
import { getProductImage } from './products';

export interface VisualMatch {
  product: Product;
  score: number;
  reasons: string[];
}

export type RecognizeStatus = 'clip' | 'done';
export type RecognizeMethod = 'clip' | 'none';

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

/**
 * Zdjęcie przodu produktu → CLIP vs katalog → top 3.
 */
export async function recognizeProductFromImage(
  file: File,
  products: Product[],
  onStatus?: (status: RecognizeStatus, detail?: string) => void,
): Promise<{
  matches: VisualMatch[];
  warning?: string;
  method: RecognizeMethod;
}> {
  onStatus?.('clip', 'Przygotowuję zdjęcie…');

  let work: Blob;
  try {
    work = await compressImageFile(file, 1024, 0.9);
  } catch (err) {
    onStatus?.('done');
    return {
      matches: [],
      warning:
        err instanceof Error ? err.message : 'Nie udało się wczytać zdjęcia.',
      method: 'none',
    };
  }

  onStatus?.('clip', 'Porównuję ze zdjęciami katalogu…');

  try {
    const { matchByClip } = await import('./clipLens');
    const picks = await matchByClip(work, products, (detail) => {
      onStatus?.('clip', detail);
    }, MAX_RESULTS);

    onStatus?.('done');

    if (!picks.length) {
      return {
        matches: [],
        method: 'none',
        warning:
          'Brak podobnego produktu. Zrób zdjęcie jak w katalogu: przód butelki / opakowania, ostre, w kadrze.',
      };
    }

    const matches: VisualMatch[] = [];
    for (const p of picks) {
      const product =
        products.find((x) => x.id === p.id) ||
        products.find((x) => x.sku.toUpperCase() === p.sku.toUpperCase());
      if (!product) continue;
      matches.push({
        product,
        score: p.score,
        reasons: [p.reason || 'Podobieństwo zdjęcia'],
      });
    }

    if (!matches.length) {
      return {
        matches: [],
        method: 'none',
        warning:
          'Brak podobnego produktu. Zrób zdjęcie jak w katalogu: przód butelki / opakowania, ostre, w kadrze.',
      };
    }

    return {
      matches,
      method: 'clip',
      warning:
        matches[0]!.score < 55
          ? 'Słabe podobieństwo — sprawdź, czy to właściwy produkt. Lepiej: przód jak na zdjęciu katalogowym.'
          : undefined,
    };
  } catch (err) {
    console.error(err);
    onStatus?.('done');
    return {
      matches: [],
      method: 'none',
      warning:
        err instanceof Error && err.message.length < 140
          ? err.message
          : 'Nie udało się porównać zdjęcia. Sprawdź sieć (pierwsze uruchomienie ładuje model) i spróbuj ponownie.',
    };
  }
}

export function getProductImageSafe(product: Product): string | null {
  return getProductImage(product);
}
