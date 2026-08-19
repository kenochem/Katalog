import { supabase, isSupabaseConfigured } from './supabase';
import { rowToProduct, type ProductRow } from './db';
import type { CatalogType, Product, WaproSalesPeriod } from '../types';
import { marginPercent } from './format';
import { normalizeWaproSalesStats } from './waproSales';

export type SalesPeriodMonths = 1 | 3 | 6 | 12;

export type SalesAnalyticsPreset =
  | 'top-qty'
  | 'bottom-qty'
  | 'top-net'
  | 'bottom-net'
  | 'top-profit'
  | 'top-stock'
  | 'dead-stock'
  | 'recent'
  | 'growth'
  | 'turnover'
  | 'slow-turnover'
  | 'custom';

export interface ProductSalesMetrics {
  product: Product;
  qty: number;
  netValue: number | null;
  avgNetPerUnit: number | null;
  lastSaleDate: string | null;
  syncedAt: string | null;
  hasStats: boolean;
  /** Cena zakupu netto z katalogu (WAPRO). */
  purchaseNet: number | null;
  /** Marża % z cennika: (cena sprzedaży − zakup) / cena sprzedaży. */
  catalogMarginPct: number | null;
  /** Zysk na sprzedaży w okresie: suma netto − (zakup × szt.). */
  grossProfit: number | null;
  /** Marża % ze sprzedaży: zysk / suma netto. */
  realizedMarginPct: number | null;
}

const ANALYTICS_SELECT =
  'id,sku,name,display_name,category,manufacturer,image_url,custom_image_url,stock,catalog,tags,price_purchase_net,price_sale_net,product_meta,wapro_sales_stats,wapro_sales_synced_at';

const ANALYTICS_TTL_MS = 15 * 60_000;
let analyticsMem: { at: number; key: string; data: Product[] } | null = null;

export function invalidateSalesAnalyticsCache(): void {
  analyticsMem = null;
}

/** SKU / nazwy pozycji usługowych — nie towar, nie wchodzą w ranking sprzedaży. */
const EXCLUDED_SKUS = new Set(['KAT00159', 'KAT00178']);

/** Normalizacja do dopasowania (bez ogonków, małe litery). */
function normalizeServiceHaystack(product: Product): string {
  const raw = `${product.displayName || ''} ${product.name || ''} ${product.category || ''} ${product.sku || ''}`;
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ');
}

const EXCLUDED_NAME_PATTERNS = [
  /usluga\s*[-–—]?\s*wysyl/,
  /usluga\s*[-–—]?\s*wyssyl/,
  /\busluga\s+wysyl/,
  /\bwysylka\b/,
  /\bkoszt\s+wysyl/,
  /\bshipping\b/,
];

export function isSalesExcludedService(product: Product): boolean {
  const sku = product.sku?.trim().toUpperCase();
  if (sku && EXCLUDED_SKUS.has(sku)) return true;
  if (sku?.startsWith('KAT001') && /wysyl|wyssyl|usluga/i.test(normalizeServiceHaystack(product))) {
    return true;
  }
  const hay = normalizeServiceHaystack(product);
  return EXCLUDED_NAME_PATTERNS.some((re) => re.test(hay));
}

export function periodFromStats(
  stats: Product['waproSalesStats'],
  months: SalesPeriodMonths,
): Pick<ProductSalesMetrics, 'qty' | 'netValue' | 'avgNetPerUnit' | 'lastSaleDate' | 'hasStats'> {
  if (!stats?.periods?.length) {
    return {
      qty: 0,
      netValue: null,
      avgNetPerUnit: null,
      lastSaleDate: stats?.lastSaleDate ?? null,
      hasStats: false,
    };
  }
  const period = stats.periods.find((p) => p.months === months);
  const qty = period?.qty ?? 0;
  const netValue =
    period?.netValue != null && Number.isFinite(Number(period.netValue))
      ? Number(period.netValue)
      : null;
  const avgNetPerUnit = qty !== 0 && netValue != null ? netValue / qty : null;
  const lastSaleDate = stats?.lastSaleDate ?? null;
  return {
    qty,
    netValue,
    avgNetPerUnit,
    lastSaleDate,
    hasStats: true,
  };
}

function readPurchaseNet(product: Product): number | null {
  const n = product.pricePurchaseNet;
  return n != null && Number.isFinite(n) ? n : null;
}

export function buildProductSalesMetrics(
  product: Product,
  months: SalesPeriodMonths,
): ProductSalesMetrics {
  const stats = product.waproSalesStats;
  const period = periodFromStats(stats, months);
  const purchaseNet = readPurchaseNet(product);
  const catalogMarginPct = marginPercent(purchaseNet, product.priceSaleNet);
  let grossProfit: number | null = null;
  let realizedMarginPct: number | null = null;
  if (purchaseNet != null && period.netValue != null && period.qty !== 0) {
    grossProfit = period.netValue - purchaseNet * period.qty;
    if (period.netValue !== 0) {
      realizedMarginPct = (grossProfit / period.netValue) * 100;
    }
  }
  return {
    product,
    ...period,
    syncedAt: product.waproSalesSyncedAt ?? stats?.fetchedAt ?? null,
    purchaseNet,
    catalogMarginPct,
    grossProfit,
    realizedMarginPct,
  };
}

/** Ten sam SKU w dwóch katalogach — zostaw wiersz z większą sprzedażą w okresie. */
export function dedupeProductsBySku(
  products: Product[],
  months: SalesPeriodMonths,
): Product[] {
  const bySku = new Map<string, Product>();
  for (const product of products) {
    const sku = product.sku?.trim().toUpperCase();
    if (!sku) continue;
    const existing = bySku.get(sku);
    if (!existing) {
      bySku.set(sku, product);
      continue;
    }
    const a = buildProductSalesMetrics(existing, months);
    const b = buildProductSalesMetrics(product, months);
    const aScore = (a.netValue ?? 0) * 1000 + a.qty;
    const bScore = (b.netValue ?? 0) * 1000 + b.qty;
    if (bScore > aScore) bySku.set(sku, product);
    else if (bScore === aScore && product.catalog === 'accessories') bySku.set(sku, product);
  }
  return [...bySku.values()];
}

export async function fetchProductsForSalesAnalytics(
  catalog?: CatalogType,
  months: SalesPeriodMonths = 12,
  opts?: { force?: boolean },
): Promise<Product[]> {
  if (!isSupabaseConfigured || !supabase) return [];

  const cacheKey = `${catalog || 'all'}:${months}`;
  if (
    !opts?.force &&
    analyticsMem &&
    analyticsMem.key === cacheKey &&
    Date.now() - analyticsMem.at < ANALYTICS_TTL_MS
  ) {
    return analyticsMem.data;
  }

  const all: ProductRow[] = [];
  const pageSize = 1000;
  let from = 0;

  while (true) {
    let pageQuery = supabase.from('products').select(ANALYTICS_SELECT).order('sku');
    if (catalog) pageQuery = pageQuery.eq('catalog', catalog);
    const { data, error } = await pageQuery.range(from, from + pageSize - 1);
    if (error || !data?.length) break;
    all.push(...(data as ProductRow[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }

  const mapped = all.map((row) => {
    const product = rowToProduct(row);
    const stats = normalizeWaproSalesStats(row.wapro_sales_stats);
    if (stats) product.waproSalesStats = stats;
    return product;
  });

  const result = dedupeProductsBySku(mapped, months);
  analyticsMem = { at: Date.now(), key: cacheKey, data: result };
  return result;
}

export function aggregateSalesSummary(
  rows: ProductSalesMetrics[],
  opts?: { exclude?: (row: ProductSalesMetrics) => boolean },
): {
  productCount: number;
  withSales: number;
  withoutSales: number;
  totalQty: number;
  totalNet: number;
  totalProfit: number;
  lastSyncedAt: string | null;
} {
  let productCount = 0;
  let withSales = 0;
  let totalQty = 0;
  let totalNet = 0;
  let totalProfit = 0;
  let lastSyncedAt: string | null = null;

  for (const row of rows) {
    if (opts?.exclude?.(row)) continue;
    productCount++;
    if (row.qty > 0) withSales++;
    totalQty += row.qty;
    if (row.netValue != null) totalNet += row.netValue;
    if (row.grossProfit != null) totalProfit += row.grossProfit;
    if (row.syncedAt) {
      if (!lastSyncedAt || row.syncedAt > lastSyncedAt) lastSyncedAt = row.syncedAt;
    }
  }

  return {
    productCount,
    withSales,
    withoutSales: productCount - withSales,
    totalQty,
    totalNet,
    totalProfit,
    lastSyncedAt,
  };
}

export function emptyPeriods(): WaproSalesPeriod[] {
  return [
    { months: 1, qty: 0, netValue: null },
    { months: 3, qty: 0, netValue: null },
    { months: 6, qty: 0, netValue: null },
    { months: 12, qty: 0, netValue: null },
  ];
}

export function compareSalesMetrics(
  a: ProductSalesMetrics,
  b: ProductSalesMetrics,
  key: keyof ProductSalesMetrics | 'stock' | 'name' | 'sku',
  desc: boolean,
): number {
  const pick = (row: ProductSalesMetrics): number | string => {
    switch (key) {
      case 'qty':
        return row.qty;
      case 'netValue':
        return row.netValue ?? -Infinity;
      case 'avgNetPerUnit':
        return row.avgNetPerUnit ?? -Infinity;
      case 'grossProfit':
        return row.grossProfit ?? -Infinity;
      case 'realizedMarginPct':
        return row.realizedMarginPct ?? -Infinity;
      case 'catalogMarginPct':
        return row.catalogMarginPct ?? -Infinity;
      case 'purchaseNet':
        return row.purchaseNet ?? -Infinity;
      case 'stock':
        return row.product.stock ?? 0;
      case 'lastSaleDate':
        return row.lastSaleDate ?? '';
      case 'name':
        return row.product.displayName || row.product.name;
      case 'sku':
        return row.product.sku;
      default:
        return 0;
    }
  };

  const av = pick(a);
  const bv = pick(b);
  if (typeof av === 'string' && typeof bv === 'string') {
    const cmp = av.localeCompare(bv, 'pl');
    return desc ? -cmp : cmp;
  }
  const na = av as number;
  const nb = bv as number;
  if (na === nb) return 0;
  return desc ? (nb > na ? 1 : -1) : na > nb ? 1 : -1;
}

/** Tokeny z pola wyszukiwania (przecinek, średnik, spacja, nowa linia). */
export function parseSkuSearchTokens(input: string): string[] {
  return input
    .split(/[,;\n|]+/)
    .flatMap((part) => part.trim().split(/\s+/))
    .map((s) => s.trim())
    .filter(Boolean);
}

export function normalizeSkuToken(sku: string): string {
  return sku.trim().toUpperCase();
}

export function productMatchesSearchToken(product: Product, token: string): boolean {
  const t = token.trim().toLowerCase();
  if (!t) return true;
  const hay = `${product.sku} ${product.name} ${product.displayName} ${product.ean}`.toLowerCase();
  return hay.includes(t) || normalizeSkuToken(product.sku) === normalizeSkuToken(token);
}

/** Rozwiąż tokeny na listę SKU (dokładne SKU lub jedno dopasowanie po nazwie). */
export function resolveSkusFromTokens(
  tokens: string[],
  products: ProductSalesMetrics[],
): { skus: string[]; ambiguous: string[]; unmatched: string[] } {
  const skus: string[] = [];
  const ambiguous: string[] = [];
  const unmatched: string[] = [];
  const seen = new Set<string>();

  for (const token of tokens) {
    const upper = normalizeSkuToken(token);
    const exact = products.find((r) => normalizeSkuToken(r.product.sku) === upper);
    if (exact) {
      if (!seen.has(upper)) {
        seen.add(upper);
        skus.push(exact.product.sku);
      }
      continue;
    }
    const matches = products.filter((r) => productMatchesSearchToken(r.product, token));
    if (matches.length === 1) {
      const skuKey = normalizeSkuToken(matches[0].product.sku);
      if (!seen.has(skuKey)) {
        seen.add(skuKey);
        skus.push(matches[0].product.sku);
      }
    } else if (matches.length > 1) {
      ambiguous.push(token);
    } else {
      unmatched.push(token);
    }
  }
  return { skus, ambiguous, unmatched };
}

export const CATALOG_PRODUCT_URL = 'https://kenochem-katalog.web.app/';
