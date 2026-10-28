import type { Product } from '../types';
import { getProductDisplayCategory } from './catalogCategory';
import { effectiveManufacturer } from './waproManufacturers';

/** Statystyki magazynu, cen i marż — uzupełnienie jakości danych z catalogStats (jedno przejście po produktach). */

export interface BucketStat {
  label: string;
  count: number;
}

export interface ValueRow {
  name: string;
  units: number;
  /** Wartość zapasu po cenie zakupu netto. */
  value: number;
  count: number;
}

export interface TopProductRow {
  product: Product;
  /** Wartość zapasu po cenie zakupu netto. */
  value: number;
}

export interface MarginRow {
  product: Product;
  /** Marża % od ceny sprzedaży netto. */
  marginPct: number;
}

export interface InventoryStats {
  products: number;
  singles: number;
  groups: number;
  groupVariants: number;
  units: number;
  withStock: number;
  zeroStock: number;
  negativeStock: number;
  lowStock: number;
  manualStock: number;
  /** Wartość zapasu po cenie zakupu netto. */
  valuePurchase: number;
  /** Wartość zapasu po cenie sprzedaży netto. */
  valueSale: number;
  /** Bez ceny zakupu / sprzedaży. */
  noPurchasePrice: number;
  noSalePrice: number;
  /** Produkty z obiema cenami i marżą do policzenia. */
  withMargin: number;
  avgMarginPct: number;
  /** Marża ważona wartością zapasu (po cenie zakupu), % od sprzedaży netto. */
  weightedMarginPct: number;
  negativeMargin: number;
  stockBuckets: BucketStat[];
  marginBuckets: BucketStat[];
  priceBuckets: BucketStat[];
  byManufacturer: ValueRow[];
  byCategory: ValueRow[];
  topByValue: TopProductRow[];
  worstMargins: MarginRow[];
  withDescription: number;
  multiImage: number;
}

export const LOW_STOCK_MAX = 5;

const STOCK_EDGES: [string, (n: number) => boolean][] = [
  ['0', (n) => n <= 0],
  ['1–5', (n) => n > 0 && n <= 5],
  ['6–20', (n) => n > 5 && n <= 20],
  ['21–100', (n) => n > 20 && n <= 100],
  ['101–500', (n) => n > 100 && n <= 500],
  ['500+', (n) => n > 500],
];

const MARGIN_EDGES: [string, (m: number) => boolean][] = [
  ['< 0%', (m) => m < 0],
  ['0–10%', (m) => m >= 0 && m < 10],
  ['10–20%', (m) => m >= 10 && m < 20],
  ['20–30%', (m) => m >= 20 && m < 30],
  ['30–50%', (m) => m >= 30 && m < 50],
  ['50%+', (m) => m >= 50],
];

const PRICE_EDGES: [string, (p: number) => boolean][] = [
  ['< 10 zł', (p) => p < 10],
  ['10–25', (p) => p >= 10 && p < 25],
  ['25–50', (p) => p >= 25 && p < 50],
  ['50–100', (p) => p >= 50 && p < 100],
  ['100–250', (p) => p >= 100 && p < 250],
  ['250–500', (p) => p >= 250 && p < 500],
  ['500+', (p) => p >= 500],
];

function bucketize<T>(edges: [string, (v: T) => boolean][], values: T[]): BucketStat[] {
  const out = edges.map(([label]) => ({ label, count: 0 }));
  for (const v of values) {
    const i = edges.findIndex(([, test]) => test(v));
    if (i >= 0) out[i].count++;
  }
  return out;
}

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

export function computeInventoryStats(products: Product[]): InventoryStats {
  const stocks: number[] = [];
  const margins: number[] = [];
  const prices: number[] = [];
  const mf = new Map<string, ValueRow>();
  const cat = new Map<string, ValueRow>();
  const top: TopProductRow[] = [];
  const marginRows: MarginRow[] = [];

  let singles = 0;
  let groups = 0;
  let groupVariants = 0;
  let units = 0;
  let withStock = 0;
  let zeroStock = 0;
  let negativeStock = 0;
  let lowStock = 0;
  let manualStock = 0;
  let valuePurchase = 0;
  let valueSale = 0;
  let noPurchase = 0;
  let noSale = 0;
  let marginSum = 0;
  let weightedNum = 0;
  let weightedDen = 0;
  let negativeMargin = 0;
  let withDescription = 0;
  let multiImage = 0;

  const bump = (map: Map<string, ValueRow>, name: string, u: number, v: number) => {
    const r = map.get(name) ?? { name, units: 0, value: 0, count: 0 };
    r.count++;
    r.units += u;
    r.value += v;
    map.set(name, r);
  };

  for (const p of products) {
    if (p.isGroup) {
      groups++;
      groupVariants += p.variants?.length ?? 0;
      continue;
    }
    singles++;
    const stock = finite(p.stock) ? p.stock : 0;
    const buy = finite(p.pricePurchaseNet) && p.pricePurchaseNet > 0 ? p.pricePurchaseNet : null;
    const sellNet = finite(p.priceSaleNet) && p.priceSaleNet > 0 ? p.priceSaleNet : null;
    const sellGross = finite(p.priceSaleGross) && p.priceSaleGross > 0 ? p.priceSaleGross : null;

    stocks.push(stock);
    if (stock > 0) {
      withStock++;
      units += stock;
      if (stock <= LOW_STOCK_MAX) lowStock++;
    } else if (stock < 0) negativeStock++;
    else zeroStock++;
    if (p.stockManual) manualStock++;

    if (!buy) noPurchase++;
    if (!sellNet && !sellGross) noSale++;
    if (sellGross) prices.push(sellGross);

    const value = stock > 0 && buy ? stock * buy : 0;
    if (value > 0) {
      valuePurchase += value;
      top.push({ product: p, value });
    }
    if (stock > 0 && sellNet) valueSale += stock * sellNet;

    if (buy && sellNet) {
      const m = ((sellNet - buy) / sellNet) * 100;
      margins.push(m);
      marginSum += m;
      marginRows.push({ product: p, marginPct: m });
      if (m < 0) negativeMargin++;
      if (stock > 0) {
        weightedNum += stock * (sellNet - buy);
        weightedDen += stock * sellNet;
      }
    }

    if (p.description && p.description.trim().length >= 30) withDescription++;
    if ((p.extraImageUrls?.length ?? 0) > 0) multiImage++;

    const manufacturer = effectiveManufacturer(p) || 'Bez producenta';
    const category = getProductDisplayCategory(p) || 'Bez kategorii';
    bump(mf, manufacturer, stock > 0 ? stock : 0, value);
    bump(cat, category, stock > 0 ? stock : 0, value);
  }

  const byValue = (a: ValueRow, b: ValueRow) => b.value - a.value || b.count - a.count;
  top.sort((a, b) => b.value - a.value);
  marginRows.sort((a, b) => a.marginPct - b.marginPct);

  return {
    products: singles + groups,
    singles,
    groups,
    groupVariants,
    units,
    withStock,
    zeroStock,
    negativeStock,
    lowStock,
    manualStock,
    valuePurchase,
    valueSale,
    noPurchasePrice: noPurchase,
    noSalePrice: noSale,
    withMargin: margins.length,
    avgMarginPct: margins.length ? marginSum / margins.length : 0,
    weightedMarginPct: weightedDen ? (weightedNum / weightedDen) * 100 : 0,
    negativeMargin,
    stockBuckets: bucketize(STOCK_EDGES, stocks),
    marginBuckets: bucketize(MARGIN_EDGES, margins),
    priceBuckets: bucketize(PRICE_EDGES, prices),
    byManufacturer: [...mf.values()].sort(byValue),
    byCategory: [...cat.values()].sort(byValue),
    topByValue: top.slice(0, 12),
    worstMargins: marginRows.slice(0, 12),
    withDescription,
    multiImage,
  };
}

/** Kwota w złotych: pełna ("12 345 zł") lub skrócona ("1,2 mln zł"). */
export function formatMoney(n: number, compact = false): string {
  if (compact && Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toLocaleString('pl-PL', { maximumFractionDigits: 2 })} mln zł`;
  if (compact && Math.abs(n) >= 10_000) return `${Math.round(n / 1000).toLocaleString('pl-PL')} tys. zł`;
  return `${Math.round(n).toLocaleString('pl-PL')} zł`;
}
