import Fuse from 'fuse.js';
import type { Product } from '../types';
import { getProductDisplayCategory } from './catalogCategory';

function normalizeEan(value: string): string {
  return value.replace(/\D/g, '');
}

function comparePl(a: string, b: string): number {
  return a.localeCompare(b, 'pl', { sensitivity: 'base', numeric: true });
}

export type FuseProduct = Product & {
  variantSkus: string;
  variantNames: string;
  variantEans: string;
  eanNormalized: string;
  tagsText: string;
  targetCategory: string;
};

export function createProductSearch(products: Product[]) {
  const expanded: FuseProduct[] = products.map((p) => ({
    ...p,
    variantSkus: p.variants?.map((v) => v.sku).join(' ') || '',
    variantNames: p.variants?.map((v) => v.name).join(' ') || '',
    variantEans: p.variants?.map((v) => v.ean || '').join(' ') || '',
    eanNormalized: normalizeEan(p.ean || ''),
    tagsText: (p.tags || []).join(' '),
    targetCategory: getProductDisplayCategory(p),
  }));

  return new Fuse(expanded, {
    keys: [
      { name: 'sku', weight: 0.3 },
      { name: 'ean', weight: 0.2 },
      { name: 'eanNormalized', weight: 0.2 },
      { name: 'variantEans', weight: 0.15 },
      { name: 'variantSkus', weight: 0.15 },
      { name: 'displayName', weight: 0.22 },
      { name: 'name', weight: 0.08 },
      { name: 'manufacturer', weight: 0.12 },
      { name: 'variantNames', weight: 0.05 },
      { name: 'tagsText', weight: 0.02 },
      { name: 'category', weight: 0.01 },
      { name: 'targetCategory', weight: 0.03 },
    ],
    threshold: 0.38,
    ignoreLocation: true,
    minMatchCharLength: 2,
    distance: 80,
  });
}

function productEans(product: Product): string[] {
  const eans: string[] = [];
  if (product.ean) eans.push(normalizeEan(product.ean));
  for (const v of product.variants ?? []) {
    if (v.ean) eans.push(normalizeEan(v.ean));
  }
  return eans.filter(Boolean);
}

export type ProductSearchIndex = {
  list: Product[];
  fuse: Fuse<FuseProduct>;
  searchBlob: Map<string, string>;
  skuExact: Map<string, Product>;
};

const indexCache = new Map<string, ProductSearchIndex>();

function listSignature(products: Product[], category: string): string {
  if (products.length === 0) return `0:${category}`;
  return `${products.length}:${category}:${products[0].id}:${products[products.length - 1].id}`;
}

function scopeList(products: Product[], category: string): Product[] {
  if (!category || category === 'Wszystkie') return products;
  return products.filter((p) => getProductDisplayCategory(p) === category);
}

export function getProductSearchIndex(
  products: Product[],
  category = 'Wszystkie',
): ProductSearchIndex {
  const sig = listSignature(products, category);
  const hit = indexCache.get(sig);
  if (hit) return hit;

  const list = scopeList(products, category);
  const searchBlob = new Map<string, string>();
  const skuExact = new Map<string, Product>();

  for (const p of list) {
    skuExact.set(p.sku.toLowerCase(), p);
    for (const v of p.variants ?? []) {
      skuExact.set(v.sku.toLowerCase(), p);
    }
    searchBlob.set(
      p.id,
      [p.displayName, p.name, p.manufacturer, p.category, getProductDisplayCategory(p), ...(p.tags ?? [])]
        .filter(Boolean)
        .join(' ')
        .toLowerCase(),
    );
  }

  const index: ProductSearchIndex = {
    list,
    fuse: createProductSearch(list),
    searchBlob,
    skuExact,
  };

  indexCache.set(sig, index);
  if (indexCache.size > 12) {
    const first = indexCache.keys().next().value;
    if (first) indexCache.delete(first);
  }
  return index;
}

/** Czyści cache indeksu (np. po przeładowaniu katalogu). */
export function invalidateProductSearchIndex(): void {
  indexCache.clear();
}

const MAX_SUBSTRING_HITS = 48;
const MAX_PREFIX_SKU = 24;
const MAX_CONTAINS_SKU = 32;
const FUSE_LIMIT = 100;

/**
 * Jedna pętla po liście — szybkie ścieżki (SKU/EAN/tekst), Fuse tylko gdy trzeba.
 */
export function searchIndexedProducts(
  index: ProductSearchIndex,
  query: string,
  opts?: { limit?: number },
): Product[] {
  const q = query.trim();
  if (q.length < 2) return index.list;

  const lower = q.toLowerCase();
  const eanQuery = normalizeEan(q);
  const limit = opts?.limit ?? FUSE_LIMIT;

  const exact = index.skuExact.get(lower);
  if (exact) return [exact];

  const exactSku: Product[] = [];
  const eanMatches: Product[] = [];
  const textMatches: Product[] = [];
  const prefixSku: Product[] = [];
  const containsSku: Product[] = [];

  for (const p of index.list) {
    if (eanQuery.length >= 8) {
      const eans = productEans(p);
      if (
        eans.some(
          (ean) => ean === eanQuery || ean.endsWith(eanQuery) || eanQuery.endsWith(ean),
        )
      ) {
        eanMatches.push(p);
        continue;
      }
    }

    const skuLow = p.sku.toLowerCase();
    if (skuLow === lower) {
      exactSku.push(p);
      continue;
    }

    let variantHandled = false;
    for (const v of p.variants ?? []) {
      const vs = v.sku.toLowerCase();
      if (vs === lower) {
        exactSku.push(p);
        variantHandled = true;
        break;
      }
    }
    if (variantHandled) continue;

    const blob = index.searchBlob.get(p.id);
    if (blob?.includes(lower)) {
      textMatches.push(p);
      continue;
    }

    if (skuLow.startsWith(lower)) {
      prefixSku.push(p);
      continue;
    }

    for (const v of p.variants ?? []) {
      if (v.sku.toLowerCase().startsWith(lower)) {
        prefixSku.push(p);
        variantHandled = true;
        break;
      }
    }
    if (variantHandled) continue;

    if (skuLow.includes(lower)) {
      containsSku.push(p);
      continue;
    }

    for (const v of p.variants ?? []) {
      if (v.sku.toLowerCase().includes(lower)) {
        containsSku.push(p);
        break;
      }
    }
  }

  if (exactSku.length) return exactSku.slice(0, limit);
  if (eanMatches.length) return eanMatches.slice(0, limit);
  if (textMatches.length > 0 && textMatches.length <= MAX_SUBSTRING_HITS) {
    return textMatches.sort((a, b) => comparePl(a.displayName, b.displayName)).slice(0, limit);
  }
  if (prefixSku.length > 0 && prefixSku.length <= MAX_PREFIX_SKU) {
    return prefixSku.slice(0, limit);
  }
  if (containsSku.length > 0 && containsSku.length <= MAX_CONTAINS_SKU) {
    return containsSku.slice(0, limit);
  }

  return index.fuse.search(q, { limit }).map((r) => r.item);
}
