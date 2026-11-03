import type { Product } from '../types';

/**
 * Dostawca = od kogo mamy towar (w WAPRO to grupa produktu). Producent = marka na opakowaniu.
 * Często to to samo (np. Royal od Royala), ale nie zawsze — MERSA jest tylko dystrybutorem.
 */
export const NO_SUPPLIER = 'Bez dostawcy';

/** Wartość specyfikacji edycji masowej: dostawca = obecny producent zapisany w produkcie (tylko gdy dostawca jest pusty). */
export const SUPPLIER_FROM_MANUFACTURER = '@producent';

export function effectiveSupplier(p: Pick<Product, 'meta'>): string {
  const meta = (p.meta ?? {}) as Record<string, unknown>;
  const own = typeof meta.supplier === 'string' ? meta.supplier.trim() : '';
  if (own) return own;
  return typeof meta.waproManufacturer === 'string' ? meta.waproManufacturer.trim() : '';
}

export interface SupplierStat {
  name: string;
  count: number;
  /** Produkty tego dostawcy, których producent (marka) jest taki sam. */
  sameAsManufacturer: number;
  /** Produkty tego dostawcy bez producenta. */
  noManufacturer: number;
}

export function supplierStats(products: Product[], manufacturerOf: (p: Product) => string): SupplierStat[] {
  const map = new Map<string, SupplierStat>();
  for (const p of products) {
    if (p.isGroup) continue;
    const name = effectiveSupplier(p);
    if (!name) continue;
    const key = name.toLowerCase();
    const row = map.get(key) ?? { name, count: 0, sameAsManufacturer: 0, noManufacturer: 0 };
    row.count++;
    const mf = manufacturerOf(p);
    if (!mf) row.noManufacturer++;
    else if (mf.toLowerCase() === key) row.sameAsManufacturer++;
    map.set(key, row);
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

/** Marki (producenci) produktów danego dostawcy, od najczęstszej — pokazuje, gdzie dostawca i producent się pokrywają. */
export function supplierBrands(products: Product[], supplier: string, manufacturerOf: (p: Product) => string): { brand: string; count: number }[] {
  const key = supplier.trim().toLowerCase();
  const map = new Map<string, { brand: string; count: number }>();
  for (const p of products) {
    if (p.isGroup || effectiveSupplier(p).toLowerCase() !== key) continue;
    const brand = manufacturerOf(p) || '(bez producenta)';
    const row = map.get(brand.toLowerCase()) ?? { brand, count: 0 };
    row.count++;
    map.set(brand.toLowerCase(), row);
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

export interface SupplierOverview {
  products: number;
  withSupplier: number;
  withoutSupplier: number;
  /** Ile produktów ma dostawcę o tej samej nazwie co producent. */
  sameAsManufacturer: number;
  /** Dostawcy, których produkty mają wiele różnych marek (hurtownie/dystrybutorzy). */
  distributors: number;
}

export function supplierOverview(products: Product[], manufacturerOf: (p: Product) => string): SupplierOverview {
  const stats = supplierStats(products, manufacturerOf);
  const singles = products.filter((p) => !p.isGroup);
  const withSupplier = stats.reduce((s, r) => s + r.count, 0);
  const distributors = stats.filter((r) => r.count >= 5 && r.sameAsManufacturer / r.count < 0.5).length;
  return {
    products: singles.length,
    withSupplier,
    withoutSupplier: singles.length - withSupplier,
    sameAsManufacturer: stats.reduce((s, r) => s + r.sameAsManufacturer, 0),
    distributors,
  };
}
