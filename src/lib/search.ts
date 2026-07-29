import Fuse from 'fuse.js';
import type { Product } from '../types';

export type CatalogSort =
  | 'name-asc'
  | 'name-desc'
  | 'category'
  | 'sku'
  | 'stock-desc'
  | 'stock-asc';

export type StockFilter = 'all' | 'in-stock' | 'out';
export type ImageFilter = 'all' | 'with' | 'without';

export const CATALOG_SORT_OPTIONS: { value: CatalogSort; label: string }[] = [
  { value: 'category', label: 'Kategoria + nazwa' },
  { value: 'name-asc', label: 'Nazwa A–Z' },
  { value: 'name-desc', label: 'Nazwa Z–A' },
  { value: 'sku', label: 'SKU' },
  { value: 'stock-desc', label: 'Stan: od największego' },
  { value: 'stock-asc', label: 'Stan: od najmniejszego' },
];

function normalizeEan(value: string): string {
  return value.replace(/\D/g, '');
}

function productEans(product: Product): string[] {
  const eans: string[] = [];
  if (product.ean) eans.push(normalizeEan(product.ean));
  for (const v of product.variants ?? []) {
    if (v.ean) eans.push(normalizeEan(v.ean));
  }
  return eans.filter(Boolean);
}

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
        const c = comparePl(a.category || '', b.category || '');
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
    sort: CatalogSort;
    stockFilter?: StockFilter;
    imageFilter?: ImageFilter;
  },
): Product[] {
  let result = filterProducts(products, opts.search, opts.category);

  if (opts.stockFilter === 'in-stock') {
    result = result.filter((p) => (p.stock ?? 0) > 0);
  } else if (opts.stockFilter === 'out') {
    result = result.filter((p) => (p.stock ?? 0) <= 0);
  }

  if (opts.imageFilter === 'with') {
    result = result.filter((p) => !!(p.customImageUrl || p.imageUrl));
  } else if (opts.imageFilter === 'without') {
    result = result.filter((p) => !(p.customImageUrl || p.imageUrl));
  }

  // Przy aktywnym wyszukiwaniu zachowaj ranking trafień
  if (opts.search.trim().length >= 2) {
    return result;
  }
  return sortProducts(result, opts.sort);
}

export function createProductSearch(products: Product[]) {
  const expanded = products.map((p) => ({
    ...p,
    variantSkus: p.variants?.map((v) => v.sku).join(' ') || '',
    variantNames: p.variants?.map((v) => v.name).join(' ') || '',
    variantEans: p.variants?.map((v) => v.ean || '').join(' ') || '',
    eanNormalized: normalizeEan(p.ean || ''),
  }));

  return new Fuse(expanded, {
    keys: [
      { name: 'sku', weight: 0.3 },
      { name: 'ean', weight: 0.2 },
      { name: 'eanNormalized', weight: 0.2 },
      { name: 'variantEans', weight: 0.15 },
      { name: 'variantSkus', weight: 0.15 },
      { name: 'displayName', weight: 0.1 },
      { name: 'variantNames', weight: 0.05 },
      { name: 'name', weight: 0.03 },
      { name: 'manufacturer', weight: 0.01 },
      { name: 'category', weight: 0.01 },
    ],
    threshold: 0.35,
    ignoreLocation: true,
    minMatchCharLength: 2,
  });
}

export function filterProducts(
  products: Product[],
  search: string,
  category: string,
): Product[] {
  let result = products;

  if (category && category !== 'Wszystkie') {
    result = result.filter((p) => p.category === category);
  }

  const q = search.trim();
  if (q.length < 2) return result;

  const lower = q.toLowerCase();
  const eanQuery = normalizeEan(q);

  if (eanQuery.length >= 8) {
    const eanMatches = result.filter((p) =>
      productEans(p).some(
        (ean) => ean === eanQuery || ean.endsWith(eanQuery) || eanQuery.endsWith(ean),
      ),
    );
    if (eanMatches.length > 0) return eanMatches;
  }

  const exactSku = result.filter(
    (p) =>
      p.sku.toLowerCase() === lower ||
      p.variants?.some((v) => v.sku.toLowerCase() === lower),
  );
  if (exactSku.length > 0) return exactSku;

  const prefixSku = result.filter(
    (p) =>
      p.sku.toLowerCase().startsWith(lower) ||
      p.variants?.some((v) => v.sku.toLowerCase().startsWith(lower)),
  );
  if (prefixSku.length > 0 && prefixSku.length <= 20) return prefixSku;

  const containsSku = result.filter(
    (p) =>
      p.sku.toLowerCase().includes(lower) ||
      p.variants?.some((v) => v.sku.toLowerCase().includes(lower)),
  );
  if (containsSku.length > 0 && containsSku.length <= 30) return containsSku;

  const fuse = createProductSearch(result);
  return fuse.search(q).map((r) => r.item);
}
