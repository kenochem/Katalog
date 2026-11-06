import type { Product } from '../types';
import { buildNameContext, leadingBrand, type BrandRule } from './nameStandard';
import { nameDuplicateKey, standardizeTechnicalName, type TechName } from './technicalNames';

export type NameStatus = 'zmiana' | 'sprawdz' | 'zgodna';

export interface NameRow {
  product: Product;
  current: string;
  result: TechName;
  status: NameStatus;
  dupKey: string;
  /** SKU innych produktów, które po ujednoliceniu mają identyczną nazwę. */
  dupWith: string[];
}

export interface NameStats {
  total: number;
  ok: number;
  /** Pewne zmiany. */
  sure: number;
  check: number;
  dups: number;
}

/** Reguły marek ustawione w widoku „Standard nazw” (wspólne z silnikiem). */
export function loadBrandRules(): Record<string, BrandRule> {
  try {
    return JSON.parse(localStorage.getItem('catalog.nameStandard.brandRules') ?? '{}') as Record<string, BrandRule>;
  } catch {
    return {};
  }
}

/** Wynik standaryzacji zależy tylko od nazwy i marki — po zmianie jednego produktu reszta bierze wynik z pamięci. */
const standardized = new Map<string, TechName | null>();
const STANDARDIZED_MAX = 20000;
function standardizeCached(current: string, brand: string | null): TechName | null {
  const key = `${brand ?? ''}|${current}`;
  const hit = standardized.get(key);
  if (hit !== undefined) return hit;
  const value = standardizeTechnicalName(current, brand);
  if (standardized.size >= STANDARDIZED_MAX) standardized.clear();
  standardized.set(key, value);
  return value;
}

/** Standard nazw rodzin: dla każdego produktu technicznego (nypel, lanca, dysza…) propozycja nazwy i ocena pewności. */
export function buildNameRows(products: Product[], rules: Record<string, BrandRule> = {}): NameRow[] {
  const ctx = buildNameContext(products, rules);
  const out: NameRow[] = [];
  for (const p of products) {
    if (p.isGroup) continue;
    const current = (p.displayName ?? '').trim();
    if (!current) continue;
    const lead = leadingBrand(current, ctx);
    const brand = lead && ctx.required.has(lead.key) ? (ctx.form.get(lead.key) ?? lead.label) : null;
    const result = standardizeCached(current, brand);
    if (!result) continue;
    const status: NameStatus = result.name === current ? 'zgodna' : result.confidence === 'pewna' ? 'zmiana' : 'sprawdz';
    out.push({ product: p, current, result, status, dupKey: nameDuplicateKey(result.name), dupWith: [] });
  }
  const byKey = new Map<string, NameRow[]>();
  for (const r of out) {
    const list = byKey.get(r.dupKey);
    if (list) list.push(r);
    else byKey.set(r.dupKey, [r]);
  }
  for (const list of byKey.values()) if (list.length > 1) for (const r of list) r.dupWith = list.filter((x) => x !== r).map((x) => x.product.sku);
  return out;
}

export function nameStats(rows: NameRow[]): NameStats {
  return {
    total: rows.length,
    ok: rows.filter((r) => r.status === 'zgodna').length,
    sure: rows.filter((r) => r.status === 'zmiana').length,
    check: rows.filter((r) => r.status === 'sprawdz').length,
    dups: rows.filter((r) => r.dupWith.length).length,
  };
}
