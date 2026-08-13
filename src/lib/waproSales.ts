import { supabase } from './supabase';
import type { WaproSalesPeriod, WaproSalesResult } from '../types';

export type { WaproSalesPeriod, WaproSalesResult };

const PERIOD_LABELS: Record<number, string> = {
  1: '1 miesiąc',
  3: '3 miesiące',
  6: '6 miesięcy',
  12: '12 miesięcy',
};

export function waproSalesPeriodLabel(months: number): string {
  return PERIOD_LABELS[months] ?? `${months} m-cy`;
}

export function normalizeWaproSalesStats(raw: unknown): WaproSalesResult | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const periodsRaw = o.periods;
  if (!Array.isArray(periodsRaw) || periodsRaw.length === 0) return null;
  const periods: WaproSalesPeriod[] = [];
  for (const p of periodsRaw) {
    if (!p || typeof p !== 'object') continue;
    const row = p as Record<string, unknown>;
    const months = Number(row.months);
    if (![1, 3, 6, 12].includes(months)) continue;
    periods.push({
      months: months as 1 | 3 | 6 | 12,
      qty: Number(row.qty ?? 0),
      netValue:
        row.netValue != null && Number.isFinite(Number(row.netValue))
          ? Number(row.netValue)
          : null,
    });
  }
  if (!periods.length) return null;
  const monthlyRaw = o.monthly;
  let monthly: WaproSalesResult['monthly'];
  if (Array.isArray(monthlyRaw) && monthlyRaw.length > 0) {
    monthly = [];
    for (const m of monthlyRaw) {
      if (!m || typeof m !== 'object') continue;
      const row = m as Record<string, unknown>;
      const month = String(row.month ?? '').trim();
      if (!/^\d{4}-\d{2}$/.test(month)) continue;
      monthly.push({
        month,
        qty: Number(row.qty ?? 0),
        netValue:
          row.netValue != null && Number.isFinite(Number(row.netValue))
            ? Number(row.netValue)
            : null,
      });
    }
    if (!monthly.length) monthly = undefined;
  }
  let prev12m: WaproSalesResult['prev12m'];
  if (o.prev12m && typeof o.prev12m === 'object') {
    const p = o.prev12m as Record<string, unknown>;
    prev12m = {
      qty: Number(p.qty ?? 0),
      netValue:
        p.netValue != null && Number.isFinite(Number(p.netValue))
          ? Number(p.netValue)
          : null,
    };
  }
  return {
    sku: String(o.sku ?? ''),
    skus: Array.isArray(o.skus) ? o.skus.map(String) : undefined,
    fetchedAt: String(o.fetchedAt ?? o.fetched_at ?? ''),
    periods,
    monthly,
    prev12m,
    lastSaleDate: o.lastSaleDate != null ? String(o.lastSaleDate) : null,
    source: o.source != null ? String(o.source) : 'wapro-mag',
    schemaVersion: o.schemaVersion != null ? Number(o.schemaVersion) : undefined,
  };
}

/** Pobiera cache sprzedaży zapisany na produkcie (sync zbiorczy). */
export async function fetchProductWaproSalesStats(productId: string): Promise<{
  stats: WaproSalesResult | null;
  syncedAt: string | null;
}> {
  if (!supabase) return { stats: null, syncedAt: null };
  const { data, error } = await supabase
    .from('products')
    .select('wapro_sales_stats, wapro_sales_synced_at')
    .eq('id', productId)
    .maybeSingle();
  if (error || !data) return { stats: null, syncedAt: null };
  return {
    stats: normalizeWaproSalesStats(data.wapro_sales_stats),
    syncedAt: data.wapro_sales_synced_at ?? null,
  };
}
