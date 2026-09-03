import type { Product } from '../types';

const STORAGE_KEY = 'katalog-local-products';

export function getLocalProducts(): Product[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Product[]) : [];
  } catch {
    return [];
  }
}

export function saveLocalProduct(product: Product): void {
  const existing = getLocalProducts();
  const idx = existing.findIndex((p) => p.id === product.id);
  if (idx >= 0) {
    existing[idx] = product;
  } else {
    existing.push(product);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
}

export function removeLocalProduct(productId: string): void {
  const next = getLocalProducts().filter((p) => p.id !== productId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

const HIDDEN_IDS_KEY = 'katalog-hidden-product-ids';

export function getHiddenProductIds(): Set<string> {
  try {
    const raw = localStorage.getItem(HIDDEN_IDS_KEY);
    const arr = raw ? (JSON.parse(raw) as string[]) : [];
    return new Set(arr);
  } catch {
    return new Set();
  }
}

export function hideProductId(productId: string): void {
  const set = getHiddenProductIds();
  set.add(productId);
  localStorage.setItem(HIDDEN_IDS_KEY, JSON.stringify([...set]));
}

export function unhideProductId(productId: string): void {
  const set = getHiddenProductIds();
  set.delete(productId);
  localStorage.setItem(HIDDEN_IDS_KEY, JSON.stringify([...set]));
}

export function mergeProducts(base: Product[], local: Product[]): Product[] {
  const map = new Map(base.map((p) => [p.id, p]));
  for (const p of local) {
    const existing = map.get(p.id);
    if (existing) {
      map.set(p.id, {
        ...existing,
        ...p,
        // lokalne null/undefined nie nadpisuje cen z bazy
        pricePurchaseNet: p.pricePurchaseNet ?? existing.pricePurchaseNet,
        priceSaleNet: p.priceSaleNet ?? existing.priceSaleNet,
        priceSaleGross: p.priceSaleGross ?? existing.priceSaleGross,
        variants: p.variants?.length ? p.variants : existing.variants,
        isGroup: p.isGroup ?? existing.isGroup,
        stock: p.stockManual
          ? p.stock
          : existing.stockManual
            ? existing.stock
            : (p.stock ?? existing.stock),
        stockManual: p.stockManual || existing.stockManual,
        catalog: p.catalog || existing.catalog || 'accessories',
        customImageUrl: p.customImageUrl?.trim() || existing.customImageUrl,
        imageUrl: p.imageUrl?.trim() || existing.imageUrl,
        hasImage: Boolean(
          p.customImageUrl?.trim() ||
            p.imageUrl?.trim() ||
            existing.customImageUrl ||
            existing.imageUrl ||
            (p.extraImageUrls?.length ? p.extraImageUrls : existing.extraImageUrls)?.length,
        ),
        extraImageUrls: p.extraImageUrls?.length
          ? p.extraImageUrls
          : existing.extraImageUrls,
      });
    } else {
      map.set(p.id, p);
    }
  }
  return Array.from(map.values());
}
