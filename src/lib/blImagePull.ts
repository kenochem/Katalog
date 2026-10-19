import type { Product } from '../types';

/**
 * Zaciąganie zdjęć z BaseLinkera do katalogu: dokładamy zdjęcia, których brakuje, i zastępujemy
 * martwe linki (np. po zmianie formatu / adresu na serwerze zdjęć). Niczego nie usuwamy bez powodu:
 * znikają tylko adresy, które się nie ładują.
 */

/** Klucz do porównywania adresów: bez protokołu, parametrów (?v=…), fragmentu i wielkości liter. */
export function imageKey(url: string): string {
  return String(url || '')
    .trim()
    .replace(/^url:/i, '')
    .replace(/^https?:\/\//i, '')
    .replace(/[?#].*$/, '')
    .toLowerCase();
}

/** Nazwa pliku bez rozszerzenia i parametrów — to samo zdjęcie na różnych serwerach / w różnych formatach (png→jpg). */
export function fileKey(url: string): string {
  const path = imageKey(url);
  const name = path.split('/').pop() ?? path;
  return name.replace(/\.[a-z0-9]{2,5}$/i, '');
}

export interface PullPlan {
  imageUrl: string;
  customImageUrl: string;
  extraImageUrls: string[];
  /** Adresy z BL dodane do katalogu. */
  added: string[];
  /** Martwe adresy usunięte z produktu. */
  removed: string[];
  changed: boolean;
}

type ImageFields = Pick<Product, 'customImageUrl' | 'imageUrl' | 'extraImageUrls'>;

export function planImagePull(product: ImageFields, blUrls: string[], broken: string[] = []): PullPlan {
  const brokenKeys = new Set(broken.map(imageKey));
  const isBroken = (u?: string) => !!u && brokenKeys.has(imageKey(u));
  const removed: string[] = [];
  const keepOrDrop = (u?: string): string => {
    const v = (u ?? '').trim();
    if (!v) return '';
    if (isBroken(v)) {
      removed.push(v);
      return '';
    }
    return v;
  };

  let custom = keepOrDrop(product.customImageUrl);
  let image = keepOrDrop(product.imageUrl);
  const extras = (product.extraImageUrls ?? []).map(keepOrDrop).filter(Boolean);

  const have = new Set([custom, image, ...extras].filter(Boolean).map(fileKey));
  const toAdd: string[] = [];
  for (const u of blUrls) {
    const v = (u ?? '').trim();
    if (!/^https?:\/\//i.test(v)) continue;
    const k = fileKey(v);
    if (have.has(k)) continue;
    have.add(k);
    toAdd.push(v);
  }

  const added = [...toAdd];
  // produkt bez działającego zdjęcia głównego: pierwsze zdjęcie z BL zostaje głównym
  if (!custom && !image && toAdd.length) image = toAdd.shift() as string;
  const nextExtras = [...extras, ...toAdd];
  if (!custom && !image && nextExtras.length && removed.length > 0) {
    // brak głównego, ale są dodatkowe — pierwsza dodatkowa awansuje na główną
    image = nextExtras.shift() as string;
  }

  const sameList =
    nextExtras.length === (product.extraImageUrls ?? []).length &&
    nextExtras.every((u, i) => u === (product.extraImageUrls ?? [])[i]);
  const changed =
    added.length > 0 ||
    removed.length > 0 ||
    custom !== (product.customImageUrl ?? '') ||
    image !== (product.imageUrl ?? '') ||
    !sameList;

  return { imageUrl: image, customImageUrl: custom, extraImageUrls: nextExtras, added, removed, changed };
}

/** Sprawdza w przeglądarce, czy obraz się ładuje (z jedną ponowną próbą, żeby nie uznać chwilowej awarii za martwy link). */
export function probeImage(url: string, timeoutMs = 8000): Promise<boolean> {
  const once = () =>
    new Promise<boolean>((resolve) => {
      const img = new Image();
      const timer = window.setTimeout(() => {
        img.src = '';
        resolve(false);
      }, timeoutMs);
      img.onload = () => {
        window.clearTimeout(timer);
        resolve(img.naturalWidth > 0);
      };
      img.onerror = () => {
        window.clearTimeout(timer);
        resolve(false);
      };
      img.referrerPolicy = 'no-referrer';
      img.src = url + (url.includes('?') ? '&' : '?') + 'probe=' + Date.now();
    });
  return once().then((ok) => (ok ? true : once()));
}

/** Zwraca adresy, które się nie ładują. */
export async function findBrokenImages(urls: string[], concurrency = 5): Promise<string[]> {
  const list = [...new Set(urls.filter((u) => /^https?:\/\//i.test(u)))];
  const broken: string[] = [];
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, list.length) }, async () => {
      while (next < list.length) {
        const u = list[next++];
        if (!(await probeImage(u))) broken.push(u);
      }
    }),
  );
  return broken;
}
