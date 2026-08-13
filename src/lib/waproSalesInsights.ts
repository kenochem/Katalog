import type { Product, WaproSalesMonthBucket } from '../types';
import type { ProductSalesMetrics } from './waproSalesAnalytics';
import { compareSalesMetrics } from './waproSalesAnalytics';

export type AbcClass = 'A' | 'B' | 'C';
export type XyzClass = 'X' | 'Y' | 'Z' | '—';

export interface EnrichedSalesMetrics extends ProductSalesMetrics {
  monthly: WaproSalesMonthBucket[];
  hasMonthly: boolean;
  qtyPrev12m: number;
  netPrev12m: number | null;
  qtyChangePct: number | null;
  netChangePct: number | null;
  turnoverDays: number | null;
  annualizedQty: number;
  abcClass: AbcClass;
  xyzClass: XyzClass;
  demandCv: number | null;
}

export interface DimensionAggregate {
  key: string;
  label: string;
  productCount: number;
  qty: number;
  netValue: number;
  profit: number;
}

export function readMonthlyFromProduct(product: Product): WaproSalesMonthBucket[] {
  const raw = product.waproSalesStats?.monthly;
  if (!Array.isArray(raw) || raw.length === 0) return [];
  return raw
    .map((m) => ({
      month: String(m.month ?? ''),
      qty: Number(m.qty ?? 0),
      netValue:
        m.netValue != null && Number.isFinite(Number(m.netValue)) ? Number(m.netValue) : null,
    }))
    .filter((m) => /^\d{4}-\d{2}$/.test(m.month));
}

export function readPrev12m(product: Product): { qty: number; netValue: number | null } {
  const p = product.waproSalesStats?.prev12m;
  if (!p) return { qty: 0, netValue: null };
  return {
    qty: Number(p.qty ?? 0),
    netValue:
      p.netValue != null && Number.isFinite(Number(p.netValue)) ? Number(p.netValue) : null,
  };
}

export function calcTurnoverDays(
  stock: number,
  qtyInPeriod: number,
  periodMonths = 12,
): number | null {
  if (!Number.isFinite(stock) || stock <= 0) return null;
  if (!Number.isFinite(qtyInPeriod) || qtyInPeriod <= 0) return null;
  const months = Math.max(1, periodMonths);
  const annualized = qtyInPeriod * (12 / months);
  if (annualized <= 0) return null;
  return stock / (annualized / 365);
}

export function calcChangePct(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export function calcDemandCv(monthly: WaproSalesMonthBucket[]): number | null {
  const vals = monthly.map((m) => m.qty).filter((q) => Number.isFinite(q));
  if (vals.length < 3) return null;
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  if (mean <= 0) return null;
  const variance = vals.reduce((acc, v) => acc + (v - mean) ** 2, 0) / vals.length;
  return Math.sqrt(variance) / mean;
}

export function classifyXyz(cv: number | null): XyzClass {
  if (cv == null || !Number.isFinite(cv)) return '—';
  if (cv < 0.5) return 'X';
  if (cv < 1) return 'Y';
  return 'Z';
}

/** ABC po udziale w obrocie netto (lub sztukach gdy brak cen). */
export function assignAbcClasses(rows: EnrichedSalesMetrics[]): Map<string, AbcClass> {
  const map = new Map<string, AbcClass>();
  if (!rows.length) return map;

  const scored = rows.map((row) => ({
    sku: row.product.sku,
    score: row.netValue != null && row.netValue > 0 ? row.netValue : Math.max(0, row.qty),
  }));
  scored.sort((a, b) => b.score - a.score);
  const total = scored.reduce((s, r) => s + r.score, 0);
  if (total <= 0) {
    for (const r of scored) map.set(r.sku, 'C');
    return map;
  }

  let cumulative = 0;
  for (const row of scored) {
    cumulative += row.score;
    const share = cumulative / total;
    const cls: AbcClass = share <= 0.8 ? 'A' : share <= 0.95 ? 'B' : 'C';
    map.set(row.sku, cls);
  }
  return map;
}

export function enrichSalesMetrics(
  row: ProductSalesMetrics,
  abcMap: Map<string, AbcClass>,
): EnrichedSalesMetrics {
  const monthly = readMonthlyFromProduct(row.product);
  const prev = readPrev12m(row.product);
  const stock = row.product.stock ?? 0;
  const annualizedQty = row.qty;
  const turnoverDays = calcTurnoverDays(stock, annualizedQty);
  const qtyChangePct = calcChangePct(row.qty, prev.qty);
  const netChangePct =
    row.netValue != null && prev.netValue != null
      ? calcChangePct(row.netValue, prev.netValue)
      : null;
  const demandCv = calcDemandCv(monthly);

  return {
    ...row,
    monthly,
    hasMonthly: monthly.length > 0,
    qtyPrev12m: prev.qty,
    netPrev12m: prev.netValue,
    qtyChangePct,
    netChangePct,
    turnoverDays,
    annualizedQty,
    abcClass: abcMap.get(row.product.sku) ?? 'C',
    xyzClass: classifyXyz(demandCv),
    demandCv,
  };
}

export function enrichSalesRows(
  rows: ProductSalesMetrics[],
  periodMonths = 12,
): EnrichedSalesMetrics[] {
  const base = rows.map((row) => {
    const monthly = readMonthlyFromProduct(row.product);
    const prev = readPrev12m(row.product);
    const stock = row.product.stock ?? 0;
    const demandCv = calcDemandCv(monthly);
    const qtyChangePct =
      periodMonths === 12 ? calcChangePct(row.qty, prev.qty) : null;
    const netChangePct =
      periodMonths === 12 && row.netValue != null && prev.netValue != null
        ? calcChangePct(row.netValue, prev.netValue)
        : null;
    return {
      ...row,
      monthly,
      hasMonthly: monthly.length > 0,
      qtyPrev12m: prev.qty,
      netPrev12m: prev.netValue,
      qtyChangePct,
      netChangePct,
      turnoverDays: calcTurnoverDays(stock, row.qty, periodMonths),
      annualizedQty: row.qty * (12 / Math.max(1, periodMonths)),
      abcClass: 'C' as AbcClass,
      xyzClass: classifyXyz(demandCv),
      demandCv,
    };
  });
  const abcMap = assignAbcClasses(base);
  return base.map((row) => ({ ...row, abcClass: abcMap.get(row.product.sku) ?? 'C' }));
}

export function compareEnrichedMetrics(
  a: EnrichedSalesMetrics,
  b: EnrichedSalesMetrics,
  key:
    | keyof EnrichedSalesMetrics
    | 'stock'
    | 'name'
    | 'sku'
    | 'qty'
    | 'netValue'
    | 'grossProfit'
    | 'realizedMarginPct'
    | 'purchaseNet'
    | 'lastSaleDate'
    | 'turnoverDays'
    | 'qtyChangePct'
    | 'netChangePct',
  desc: boolean,
): number {
  if (
    key === 'qty' ||
    key === 'netValue' ||
    key === 'grossProfit' ||
    key === 'realizedMarginPct' ||
    key === 'purchaseNet' ||
    key === 'lastSaleDate' ||
    key === 'stock' ||
    key === 'name' ||
    key === 'sku'
  ) {
    return compareSalesMetrics(a, b, key, desc);
  }
  const pick = (row: EnrichedSalesMetrics): number | string => {
    switch (key) {
      case 'turnoverDays':
        return row.turnoverDays ?? Infinity;
      case 'qtyChangePct':
        return row.qtyChangePct ?? -Infinity;
      case 'netChangePct':
        return row.netChangePct ?? -Infinity;
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

export function aggregateMonthlyTrend(
  rows: EnrichedSalesMetrics[],
  metric: 'qty' | 'netValue',
): Array<{ month: string; label: string; value: number }> {
  const byMonth = new Map<string, number>();
  for (const row of rows) {
    for (const m of row.monthly) {
      const add = metric === 'qty' ? m.qty : m.netValue ?? 0;
      byMonth.set(m.month, (byMonth.get(m.month) ?? 0) + add);
    }
  }
  return [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, value]) => ({
      month,
      label: formatMonthLabel(month),
      value,
    }));
}

export function aggregateByDimension(
  rows: EnrichedSalesMetrics[],
  dimension: 'category' | 'manufacturer',
): DimensionAggregate[] {
  const map = new Map<string, DimensionAggregate>();
  for (const row of rows) {
    const raw =
      dimension === 'category' ? row.product.category : row.product.manufacturer;
    const key = (raw || '—').trim() || '—';
    const cur = map.get(key) ?? {
      key,
      label: key,
      productCount: 0,
      qty: 0,
      netValue: 0,
      profit: 0,
    };
    cur.productCount += 1;
    cur.qty += row.qty;
    cur.netValue += row.netValue ?? 0;
    cur.profit += row.grossProfit ?? 0;
    map.set(key, cur);
  }
  return [...map.values()].sort((a, b) => b.netValue - a.netValue || b.qty - a.qty);
}

export function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split('-');
  if (!y || !m) return ym;
  const names = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];
  const mi = Number(m) - 1;
  return `${names[mi] ?? m} ${y.slice(2)}`;
}

export function formatChangePct(pct: number | null): string {
  if (pct == null || !Number.isFinite(pct)) return '—';
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(0)}%`;
}

export function formatTurnoverDays(days: number | null): string {
  if (days == null || !Number.isFinite(days)) return '—';
  if (days > 9999) return '∞';
  if (days >= 365) return `${Math.round(days / 365)} lat`;
  if (days >= 60) return `${Math.round(days / 30)} m-cy`;
  return `${Math.round(days)} dni`;
}

export function monthlyExportHeaders(months: string[]): string[] {
  return months.flatMap((m) => [`Szt. ${m}`, `Netto ${m}`]);
}

export function monthlyExportRow(row: EnrichedSalesMetrics, months: string[]): (string | number)[] {
  const byMonth = new Map(row.monthly.map((m) => [m.month, m]));
  return months.flatMap((month) => {
    const m = byMonth.get(month);
    return [m?.qty ?? 0, m?.netValue ?? ''];
  });
}

export function collectMonthKeys(rows: EnrichedSalesMetrics[]): string[] {
  const set = new Set<string>();
  for (const row of rows) {
    for (const m of row.monthly) set.add(m.month);
  }
  return [...set].sort();
}
