import type { Product } from '../types';
import { normalizeProductMeta } from './productMeta';
import { normalizeSkuToken } from './waproSalesAnalytics';

const STORAGE_KEY = 'ops-sales-excluded-skus';

/** Pozycje opisowe / rozpis składników — nie wchodzą w sumy KPI (heurystyka nazwy). */
const DECORATIVE_NAME_PATTERNS = [
  /\bkwiat/i,
  /\brozpis\b/i,
  /\bskladnik\b/i,
  /\bpozycja pomocnicza\b/i,
  /\btylko informacyjnie\b/i,
  /\b---+/,
  /^[\-\–—•*]+\s/,
  /\(\s*informacyjnie\s*\)/i,
];

function normalizeHaystack(product: Product): string {
  const raw = `${product.displayName || ''} ${product.name || ''} ${product.category || ''}`;
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function loadSalesExcludedSkus(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((s): s is string => typeof s === 'string' && s.trim().length > 0);
  } catch {
    return [];
  }
}

export function saveSalesExcludedSkus(skus: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(skus));
  } catch {
    /* quota */
  }
}

/** Pozycja oznaczona w katalogu / tagu jako wykluczona ze sprzedaży. */
export function isSalesMarkedExcluded(product: Product): boolean {
  const meta = normalizeProductMeta(product.meta);
  if (meta?.salesExcludeFromSum) return true;
  const tags = product.tags ?? [];
  return tags.includes('sales-exclude-sum') || tags.includes('wyklucz-sprzedaz');
}

/** Heurystyka „kwiatków” — linie opisowe na FV (rozpis zestawu itp.). */
export function isSalesDecorativeLine(product: Product): boolean {
  const hay = normalizeHaystack(product);
  return DECORATIVE_NAME_PATTERNS.some((re) => re.test(hay));
}

/** Czy SKU nie wchodzi w sumy KPI / wykresów (może nadal być w tabeli). */
export function isSalesExcludedFromSum(
  product: Product,
  userExcluded?: Set<string>,
): boolean {
  const skuKey = normalizeSkuToken(product.sku || '');
  if (skuKey && userExcluded?.has(skuKey)) return true;
  if (isSalesMarkedExcluded(product)) return true;
  return false;
}

export function buildSalesExcludedSkuSet(extra: string[] = []): Set<string> {
  const set = new Set<string>();
  for (const sku of [...loadSalesExcludedSkus(), ...extra]) {
    const key = normalizeSkuToken(sku);
    if (key) set.add(key);
  }
  return set;
}
