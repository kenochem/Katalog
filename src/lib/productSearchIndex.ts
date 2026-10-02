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
  targetCategory: string;
};

export function createProductSearch(products: Product[]) {
  const expanded: FuseProduct[] = products.map((p) => ({
    ...p,
    variantSkus: p.variants?.map((v) => v.sku).join(' ') || '',
    variantNames: p.variants?.map((v) => v.name).join(' ') || '',
    variantEans: p.variants?.map((v) => v.ean || '').join(' ') || '',
    eanNormalized: normalizeEan(p.ean || ''),
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
      { name: 'category', weight: 0.01 },
      { name: 'targetCategory', weight: 0.03 },
    ],
    threshold: 0.38,
    ignoreLocation: true,
    minMatchCharLength: 2,
    distance: 80,
  });
}

export type ProductSearchIndex = {
  list: Product[];
  fuse?: Fuse<FuseProduct>;
  searchBlob: Map<string, string>;
  skuExact: Map<string, Product>;
  /** Prekalkulowane pod szybkie ścieżki w searchIndexedProducts — liczone raz przy
   * budowie indeksu, nie przy każdym wyszukiwaniu (klawiszu). */
  skuLower: Map<string, string>;
  variantSkuLower: Map<string, string[]>;
  eans: Map<string, string[]>;
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
  const skuLower = new Map<string, string>();
  const variantSkuLower = new Map<string, string[]>();
  const eans = new Map<string, string[]>();

  for (const p of list) {
    const skuLow = p.sku.toLowerCase();
    skuLower.set(p.id, skuLow);
    skuExact.set(skuLow, p);

    const variantSkus: string[] = [];
    const productEansList: string[] = [];
    if (p.ean) productEansList.push(normalizeEan(p.ean));
    for (const v of p.variants ?? []) {
      const vLow = v.sku.toLowerCase();
      variantSkus.push(vLow);
      skuExact.set(vLow, p);
      if (v.ean) {
        const normalized = normalizeEan(v.ean);
        if (normalized) productEansList.push(normalized);
      }
    }
    variantSkuLower.set(p.id, variantSkus);
    eans.set(p.id, productEansList);

    // UWAGA: celowo bez p.tags — część produktów ma doczepione administracyjne
    // tagi (np. "Sonax" z rekoncyliacji sprzedaży w Ops) niezwiązane z marką
    // produktu, przez co np. szukanie "sonax" wyciągało ADBL/Cif/Clinex.
    searchBlob.set(
      p.id,
      [p.displayName, p.name, p.manufacturer, p.category, getProductDisplayCategory(p)]
        .filter(Boolean)
        .join(' ')
        .toLowerCase(),
    );
  }

  const index: ProductSearchIndex = {
    list,
    searchBlob,
    skuExact,
    skuLower,
    variantSkuLower,
    eans,
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
    const variantSkus = index.variantSkuLower.get(p.id) ?? [];

    if (eanQuery.length >= 8) {
      const productEansList = index.eans.get(p.id) ?? [];
      if (
        productEansList.some(
          (ean) => ean === eanQuery || ean.endsWith(eanQuery) || eanQuery.endsWith(ean),
        )
      ) {
        eanMatches.push(p);
        continue;
      }
    }

    const skuLow = index.skuLower.get(p.id) ?? p.sku.toLowerCase();
    if (skuLow === lower) {
      exactSku.push(p);
      continue;
    }

    let variantHandled = false;
    for (const vs of variantSkus) {
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

    for (const vs of variantSkus) {
      if (vs.startsWith(lower)) {
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

    for (const vs of variantSkus) {
      if (vs.includes(lower)) {
        containsSku.push(p);
        break;
      }
    }
  }

  // Fuse to ostatnia deska ratunku — tylko gdy zwykłe dopasowanie tekstowe
  // (substring/prefix/contains) nie znalazło NIC, np. literówka. Wcześniej
  // każde krótkie, popularne zapytanie (np. "sz" trafia w >1000 produktów)
  // wpadało w Fuse mimo setek trafień tekstowych — a pełne fuzzy przeszukanie
  // całego katalogu kosztuje nawet 50-200ms na jedno zapytanie. Zwykłe
  // sortowanie tych samych trafień jest wielokrotnie tańsze, więc dopóki
  // cokolwiek pasuje wprost, Fuse w ogóle się nie odpala.
  if (exactSku.length) return exactSku.slice(0, limit);
  if (eanMatches.length) return eanMatches.slice(0, limit);
  if (textMatches.length > 0) {
    return textMatches.sort((a, b) => comparePl(a.displayName, b.displayName)).slice(0, limit);
  }
  if (prefixSku.length > 0) return prefixSku.slice(0, limit);
  if (containsSku.length > 0) return containsSku.slice(0, limit);

  index.fuse ??= createProductSearch(index.list);
  return index.fuse.search(q, { limit }).map((r) => r.item);
}
