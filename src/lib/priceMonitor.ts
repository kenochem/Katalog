import type { Product } from '../types';
import { supabase } from './supabase';
import type { ProductSyncChange } from './productSyncChanges';

/**
 * Monitor cen i marży: agreguje log zmian z syncu WAPRO (`product_sync_changes`) do jednej linii na produkt
 * i wylicza alerty (sprzedaż poniżej zakupu, niska marża, zakup w górę przy stałej sprzedaży, skoki cen).
 */
export type PriceField = 'price_purchase_net' | 'price_sale_net' | 'price_sale_gross';

export type PriceAlertKind = 'belowCost' | 'lowMargin' | 'buyUpSaleFlat' | 'jump';

export const PRICE_ALERT_LABEL: Record<PriceAlertKind, string> = {
  belowCost: 'Sprzedaż poniżej zakupu',
  lowMargin: 'Niska marża',
  buyUpSaleFlat: 'Zakup w górę, sprzedaż bez zmian',
  jump: 'Duży skok ceny',
};

export interface PriceMonitorSettings {
  /** Minimalna akceptowalna marża (% od ceny sprzedaży netto). */
  marginMin: number;
  /** Zmiana ceny (%) uznawana za skok / możliwy błąd. */
  jumpPct: number;
}

export const DEFAULT_MONITOR_SETTINGS: PriceMonitorSettings = { marginMin: 15, jumpPct: 30 };

export interface FieldMove {
  from: number;
  to: number;
  /** Zmiana procentowa (null, gdy cena początkowa 0). */
  pct: number | null;
}

export interface PriceMoveRow {
  sku: string;
  name: string;
  manufacturer: string;
  product?: Product;
  buy?: FieldMove;
  saleNet?: FieldMove;
  saleGross?: FieldMove;
  /** Czas ostatniej zmiany ceny w okresie. */
  lastAt: string;
  changeCount: number;
  /** Największa bezwzględna zmiana % spośród pól. */
  maxPct: number;
  /** Kierunek dominującej zmiany. */
  direction: 'up' | 'down';
  marginNow?: number;
  marginBefore?: number;
  alerts: PriceAlertKind[];
}

export function marginPct(saleNet: number | undefined | null, buyNet: number | undefined | null): number | undefined {
  if (saleNet == null || buyNet == null || !(saleNet > 0) || !(buyNet > 0)) return undefined;
  return ((saleNet - buyNet) / saleNet) * 100;
}

function movePct(from: number, to: number): number | null {
  return from > 0 ? ((to - from) / from) * 100 : null;
}

function isPriceField(f: string): f is PriceField {
  return f === 'price_purchase_net' || f === 'price_sale_net' || f === 'price_sale_gross';
}

function moveFor(list: ProductSyncChange[], field: PriceField): FieldMove | undefined {
  const items = list.filter((c) => c.field === field && c.new_value != null);
  if (items.length === 0) return undefined;
  const first = items[0];
  const last = items[items.length - 1];
  const from = first.old_value ?? first.new_value ?? 0;
  const to = last.new_value ?? 0;
  if (from === to) return undefined;
  return { from, to, pct: movePct(from, to) };
}

/** Jedna linia na SKU z wszystkich zmian cen w okresie (kolejność zmian: najstarsze pierwsze). */
export function buildPriceMoves(
  changes: ProductSyncChange[],
  products: Product[],
  settings: PriceMonitorSettings = DEFAULT_MONITOR_SETTINGS,
): PriceMoveRow[] {
  const bySku = new Map<string, ProductSyncChange[]>();
  for (const c of [...changes].sort((a, b) => a.changed_at.localeCompare(b.changed_at))) {
    if (!isPriceField(c.field)) continue;
    const arr = bySku.get(c.sku) ?? [];
    arr.push(c);
    bySku.set(c.sku, arr);
  }
  const productBySku = new Map<string, Product>();
  for (const p of products) if (!p.isGroup) productBySku.set(p.sku.toUpperCase(), p);

  const rows: PriceMoveRow[] = [];
  for (const [sku, list] of bySku) {
    const buy = moveFor(list, 'price_purchase_net');
    const saleNet = moveFor(list, 'price_sale_net');
    const saleGross = moveFor(list, 'price_sale_gross');
    if (!buy && !saleNet && !saleGross) continue;
    const product = productBySku.get(sku.toUpperCase());

    const saleNow = product?.priceSaleNet ?? saleNet?.to;
    const buyNow = product?.pricePurchaseNet ?? buy?.to;
    const marginNow = marginPct(saleNow, buyNow);
    const marginBefore = marginPct(saleNet?.from ?? saleNow, buy?.from ?? buyNow);

    const moves = [buy, saleNet, saleGross].filter((m): m is FieldMove => !!m);
    const maxPct = moves.reduce((m, x) => Math.max(m, Math.abs(x.pct ?? 0)), 0);
    const dominant = moves.reduce((best, x) => (Math.abs(x.pct ?? 0) >= Math.abs(best.pct ?? 0) ? x : best), moves[0]);
    const direction: 'up' | 'down' = dominant.to >= dominant.from ? 'up' : 'down';

    const alerts: PriceAlertKind[] = [];
    if (saleNow != null && buyNow != null && saleNow > 0 && buyNow > 0 && saleNow < buyNow) alerts.push('belowCost');
    else if (marginNow != null && marginNow < settings.marginMin) alerts.push('lowMargin');
    if (buy && buy.to > buy.from && !saleNet) alerts.push('buyUpSaleFlat');
    if (maxPct >= settings.jumpPct) alerts.push('jump');

    rows.push({
      sku,
      name: product?.displayName || list.find((c) => c.display_name)?.display_name || sku,
      manufacturer: product?.manufacturer ?? '',
      product,
      buy,
      saleNet,
      saleGross,
      lastAt: list[list.length - 1].changed_at,
      changeCount: list.length,
      maxPct,
      direction,
      marginNow,
      marginBefore,
      alerts,
    });
  }
  return rows.sort((a, b) => b.maxPct - a.maxPct);
}

export interface MarginPoint {
  changed_at: string;
  label: string;
  marginPct: number;
  marginPln: number;
}

/** Marża w czasie dla jednego SKU: po każdej zmianie ceny zakupu lub sprzedaży netto (stan poprzedni z `old_value`). */
export function buildMarginSeries(changes: ProductSyncChange[], labelOf: (iso: string) => string): MarginPoint[] {
  const sorted = [...changes]
    .filter((c) => (c.field === 'price_purchase_net' || c.field === 'price_sale_net') && c.new_value != null)
    .sort((a, b) => a.changed_at.localeCompare(b.changed_at));
  let buy: number | undefined;
  let sale: number | undefined;
  // wartość sprzed pierwszej zmiany każdego pola — żeby marża była znana od początku
  for (const c of sorted) {
    if (c.field === 'price_purchase_net' && buy === undefined && c.old_value != null) buy = c.old_value;
    if (c.field === 'price_sale_net' && sale === undefined && c.old_value != null) sale = c.old_value;
  }
  const out: MarginPoint[] = [];
  for (const c of sorted) {
    if (c.field === 'price_purchase_net') buy = c.new_value as number;
    else sale = c.new_value as number;
    const m = marginPct(sale, buy);
    if (m === undefined || sale === undefined || buy === undefined) continue;
    out.push({ changed_at: c.changed_at, label: labelOf(c.changed_at), marginPct: Math.round(m * 10) / 10, marginPln: Math.round((sale - buy) * 100) / 100 });
  }
  return out;
}

/** Zmiany cen z ostatnich `days` dni (stronicowane, bo PostgREST zwraca max 1000 wierszy). */
export async function fetchPriceChangesSince(days: number): Promise<ProductSyncChange[]> {
  if (!supabase) return [];
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const out: ProductSyncChange[] = [];
  for (let from = 0; from < 20000; from += 1000) {
    const { data, error } = await supabase
      .from('product_sync_changes')
      .select('id,request_id,product_id,sku,display_name,field,old_value,new_value,changed_at')
      .neq('field', 'stock')
      .gte('changed_at', since)
      .order('changed_at', { ascending: true })
      .range(from, from + 999);
    if (error) {
      console.warn('fetchPriceChangesSince', error.message);
      break;
    }
    const rows = (data as ProductSyncChange[]) ?? [];
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}

const SETTINGS_KEY = 'catalog.priceMonitor.settings';

export function loadMonitorSettings(): PriceMonitorSettings {
  try {
    const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
    if (raw && typeof raw.marginMin === 'number' && typeof raw.jumpPct === 'number') return raw;
  } catch {
    /* brak dostępu do localStorage */
  }
  return DEFAULT_MONITOR_SETTINGS;
}

export function saveMonitorSettings(s: PriceMonitorSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* ignoruj */
  }
}

export function priceMovesToCsv(rows: PriceMoveRow[]): string {
  const esc = (v: string | number | undefined) => {
    const s = v === undefined ? '' : String(v);
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const num = (v: number | undefined) => (v === undefined ? '' : v.toFixed(2).replace('.', ','));
  const head = ['SKU', 'Nazwa', 'Producent', 'Zakup było', 'Zakup jest', 'Zakup %', 'Sprzedaż netto było', 'Sprzedaż netto jest', 'Sprzedaż netto %', 'Marża przed %', 'Marża teraz %', 'Ostatnia zmiana', 'Alerty'];
  const lines = [head.join(';')];
  for (const r of rows) {
    lines.push(
      [
        r.sku,
        r.name,
        r.manufacturer,
        num(r.buy?.from),
        num(r.buy?.to),
        num(r.buy?.pct ?? undefined),
        num(r.saleNet?.from),
        num(r.saleNet?.to),
        num(r.saleNet?.pct ?? undefined),
        num(r.marginBefore),
        num(r.marginNow),
        r.lastAt.slice(0, 16).replace('T', ' '),
        r.alerts.map((a) => PRICE_ALERT_LABEL[a]).join(', '),
      ]
        .map(esc)
        .join(';'),
    );
  }
  return lines.join('\r\n');
}
