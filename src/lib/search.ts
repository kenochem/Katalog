import { assessProductKnowledge } from './productKnowledge';
import { hasBaselinkerLink } from './baselinkerLink';
import { isCatalogHiddenProduct, isWaproSkeletonProduct } from './productMeta';
import { getProductSearchIndex, searchIndexedProducts } from './productSearchIndex';
import { effectiveManufacturer, NO_MANUFACTURER } from './waproManufacturers';
import { getProductDisplayCategory } from './catalogCategory';
import { getAvailableQty, getReservedQty } from './reservedStock';
import { getLivePromo } from './promotions';
import { hasProductDocs } from './productDocsIndex';
import type { Product } from '../types';

export type CatalogSort =
  | 'name-asc'
  | 'name-desc'
  | 'category'
  | 'sku'
  | 'stock-desc'
  | 'stock-asc';

export type StockFilter = 'all' | 'in-stock' | 'low' | 'out' | 'reserved' | 'promo';
export type ImageFilter = 'all' | 'with' | 'without';
export type KnowledgeFilter = 'all' | 'weak' | 'good';
export type WaproMagFilter = 'all' | 'needs-media';
export type DocsFilter = 'all' | 'with' | 'without';
export type BaselinkerFilter = 'all' | 'linked' | 'not-linked';
export type CatalogVisibilityFilter = 'active' | 'hidden' | 'all';

/** Próg „niski stan” (włącznie), powyżej 0. */
export const LOW_STOCK_MAX = 5;

export const CATALOG_SORT_OPTIONS: { value: CatalogSort; label: string }[] = [
  { value: 'category', label: 'Kategoria + nazwa' },
  { value: 'name-asc', label: 'Nazwa A–Z' },
  { value: 'name-desc', label: 'Nazwa Z–A' },
  { value: 'sku', label: 'SKU' },
  { value: 'stock-desc', label: 'Stan: od największego' },
  { value: 'stock-asc', label: 'Stan: od najmniejszego' },
];

const plCollator = new Intl.Collator('pl', { sensitivity: 'base', numeric: true });
const comparePl = (a: string, b: string): number => plCollator.compare(a, b);

/** Sortowanie z kluczami wyliczonymi raz na produkt (a nie przy każdym porównaniu). */
function sortByKeys<K>(list: Product[], keyOf: (p: Product) => K, cmp: (a: K, b: K) => number, tie: (a: Product, b: Product) => number): Product[] {
  const decorated = list.map((p) => ({ p, k: keyOf(p) }));
  decorated.sort((x, y) => cmp(x.k, y.k) || tie(x.p, y.p));
  return decorated.map((d) => d.p);
}

export function sortProducts(products: Product[], sort: CatalogSort): Product[] {
  const byName = (a: Product, b: Product) => comparePl(a.displayName, b.displayName);
  switch (sort) {
    case 'name-desc':
      return [...products].sort((a, b) => comparePl(b.displayName, a.displayName));
    case 'category':
      return sortByKeys(products, (p) => getProductDisplayCategory(p), comparePl, byName);
    case 'sku':
      return [...products].sort((a, b) => comparePl(a.sku, b.sku));
    case 'stock-desc':
      return sortByKeys(products, (p) => getAvailableQty(p), (a, b) => b - a, byName);
    case 'stock-asc':
      return sortByKeys(products, (p) => getAvailableQty(p), (a, b) => a - b, byName);
    case 'name-asc':
    default:
      return [...products].sort(byName);
  }
}

export function applyCatalogFilters(
  products: Product[],
  opts: {
    search: string;
    category: string;
    manufacturer?: string;
    sort: CatalogSort;
    stockFilter?: StockFilter;
    imageFilter?: ImageFilter;
    knowledgeFilter?: KnowledgeFilter;
    baselinkerFilter?: BaselinkerFilter;
    waproMagFilter?: WaproMagFilter;
    docsFilter?: DocsFilter;
    visibilityFilter?: CatalogVisibilityFilter;
    /** Produkty będące wariantami grupy, która też jest na liście, pokazuj tylko w grupie. */
    collapseGroupMembers?: boolean;
  },
): Product[] {
  let result = filterProducts(products, opts.search, opts.category);

  const visibilityFilter = opts.visibilityFilter ?? 'active';
  if (visibilityFilter === 'active') {
    result = result.filter((p) => !isCatalogHiddenProduct(p));
  } else if (visibilityFilter === 'hidden') {
    result = result.filter((p) => isCatalogHiddenProduct(p));
  }

  const manufacturer = opts.manufacturer?.trim();
  if (manufacturer && manufacturer !== 'Wszyscy') {
    result = result.filter((p) =>
      manufacturer === NO_MANUFACTURER ? !effectiveManufacturer(p) : effectiveManufacturer(p) === manufacturer,
    );
  }

  // Filtry stanu liczą stan REALNY (dostępny = stan − zarezerwowane), jak „Ilość dost.” w WAPRO.
  if (opts.stockFilter === 'in-stock') {
    result = result.filter((p) => getAvailableQty(p) > 0);
  } else if (opts.stockFilter === 'low') {
    result = result.filter((p) => {
      const s = getAvailableQty(p);
      return s > 0 && s <= LOW_STOCK_MAX;
    });
  } else if (opts.stockFilter === 'out') {
    result = result.filter((p) => getAvailableQty(p) <= 0);
  } else if (opts.stockFilter === 'reserved') {
    result = result.filter((p) => !p.isGroup && getReservedQty(p.sku) > 0);
  } else if (opts.stockFilter === 'promo') {
    result = result.filter((p) => !p.isGroup && getLivePromo(p.sku) != null);
  }

  if (opts.imageFilter === 'with') {
    result = result.filter((p) => !!(p.customImageUrl || p.imageUrl));
  } else if (opts.imageFilter === 'without') {
    result = result.filter((p) => !(p.customImageUrl || p.imageUrl));
  }

  if (opts.knowledgeFilter === 'weak') {
    result = result.filter((p) => productKnowledgeScore(p) < 55);
  } else if (opts.knowledgeFilter === 'good') {
    result = result.filter((p) => productKnowledgeScore(p) >= 65);
  }

  if (opts.baselinkerFilter === 'linked') {
    result = result.filter((p) => hasBaselinkerLink(p));
  } else if (opts.baselinkerFilter === 'not-linked') {
    result = result.filter((p) => !hasBaselinkerLink(p));
  }

  if (opts.waproMagFilter === 'needs-media') {
    result = result.filter((p) => isWaproSkeletonProduct(p));
  }

  if (opts.docsFilter === 'with') {
    result = result.filter((p) => hasProductDocs(p.id));
  } else if (opts.docsFilter === 'without') {
    result = result.filter((p) => !hasProductDocs(p.id));
  }

  if (opts.collapseGroupMembers) result = collapseGroupMembers(products, result, opts.search);

  // Przy aktywnym wyszukiwaniu zachowaj ranking trafień
  if (opts.search.trim().length >= 2) {
    return result;
  }
  return sortProducts(result, opts.sort);
}

/**
 * Warianty grupy są też osobnymi produktami. Gdy grupa jest na liście, jej warianty chowamy (są w środku grupy);
 * wyjątek: wyszukiwanie po SKU/EAN konkretnego wariantu.
 */
export function collapseGroupMembers(all: Product[], result: Product[], search: string): Product[] {
  const memberGroup = new Map<string, string>();
  for (const g of all) {
    if (!g.isGroup) continue;
    for (const v of g.variants ?? []) if (v.sku) memberGroup.set(String(v.sku).toUpperCase(), g.id);
  }
  if (memberGroup.size === 0) return result;
  const groupsInResult = new Set(result.filter((p) => p.isGroup).map((p) => p.id));
  if (groupsInResult.size === 0) return result;
  const q = search.trim().toLowerCase();
  return result.filter((p) => {
    if (p.isGroup) return true;
    const gid = memberGroup.get(String(p.sku).toUpperCase());
    if (!gid || !groupsInResult.has(gid)) return true;
    return q.length >= 2 && (p.sku.toLowerCase().includes(q) || (p.ean ?? '').toLowerCase().includes(q));
  });
}

export { createProductSearch, type FuseProduct } from './productSearchIndex';

const knowledgeScoreCache = new WeakMap<Product, number>();

function productKnowledgeScore(product: Product): number {
  const hit = knowledgeScoreCache.get(product);
  if (hit !== undefined) return hit;
  const score = assessProductKnowledge(product).score;
  knowledgeScoreCache.set(product, score);
  return score;
}

export function filterProducts(
  products: Product[],
  search: string,
  category: string,
): Product[] {
  const q = search.trim();
  const index = getProductSearchIndex(products, category);
  if (q.length < 2) return index.list;
  return searchIndexedProducts(index, q);
}
