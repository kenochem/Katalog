import { assessProductKnowledge } from './productKnowledge';
import { hasBaselinkerLink } from './baselinkerLink';
import { isCatalogHiddenProduct, isWaproSkeletonProduct } from './productMeta';
import { getProductSearchIndex, searchIndexedProducts } from './productSearchIndex';
import { effectiveManufacturer } from './waproManufacturers';
import { getProductDisplayCategory } from './catalogCategory';
import type { Product } from '../types';

export type CatalogSort =
  | 'name-asc'
  | 'name-desc'
  | 'category'
  | 'sku'
  | 'stock-desc'
  | 'stock-asc';

export type StockFilter = 'all' | 'in-stock' | 'low' | 'out';
export type ImageFilter = 'all' | 'with' | 'without';
export type KnowledgeFilter = 'all' | 'weak' | 'good';
export type WaproMagFilter = 'all' | 'needs-media';
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

function comparePl(a: string, b: string): number {
  return a.localeCompare(b, 'pl', { sensitivity: 'base', numeric: true });
}

export function sortProducts(products: Product[], sort: CatalogSort): Product[] {
  const list = [...products];
  switch (sort) {
    case 'name-desc':
      return list.sort((a, b) => comparePl(b.displayName, a.displayName));
    case 'category':
      return list.sort((a, b) => {
        const c = comparePl(getProductDisplayCategory(a), getProductDisplayCategory(b));
        return c !== 0 ? c : comparePl(a.displayName, b.displayName);
      });
    case 'sku':
      return list.sort((a, b) => comparePl(a.sku, b.sku));
    case 'stock-desc':
      return list.sort((a, b) => {
        const d = (b.stock ?? 0) - (a.stock ?? 0);
        return d !== 0 ? d : comparePl(a.displayName, b.displayName);
      });
    case 'stock-asc':
      return list.sort((a, b) => {
        const d = (a.stock ?? 0) - (b.stock ?? 0);
        return d !== 0 ? d : comparePl(a.displayName, b.displayName);
      });
    case 'name-asc':
    default:
      return list.sort((a, b) => comparePl(a.displayName, b.displayName));
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
    visibilityFilter?: CatalogVisibilityFilter;
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
    result = result.filter((p) => effectiveManufacturer(p) === manufacturer);
  }

  if (opts.stockFilter === 'in-stock') {
    result = result.filter((p) => (p.stock ?? 0) > 0);
  } else if (opts.stockFilter === 'low') {
    result = result.filter((p) => {
      const s = p.stock ?? 0;
      return s > 0 && s <= LOW_STOCK_MAX;
    });
  } else if (opts.stockFilter === 'out') {
    result = result.filter((p) => (p.stock ?? 0) <= 0);
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

  // Przy aktywnym wyszukiwaniu zachowaj ranking trafień
  if (opts.search.trim().length >= 2) {
    return result;
  }
  return sortProducts(result, opts.sort);
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
