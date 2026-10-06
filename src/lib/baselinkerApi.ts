import { supabase } from './supabase';

/** Klient Edge Function `baselinker` (token BaseLinker nigdy nie trafia do przeglądarki). */

export interface BaselinkerProduct {
  found: boolean;
  id?: number;
  sku: string;
  ean?: string;
  name?: string;
  stock?: number;
  stockByWarehouse?: Record<string, number>;
  warehouse?: string;
  priceGross?: number | null;
  priceGroupId?: string | null;
  taxRate?: number | null;
  weight?: number | null;
  images?: string[];
  imageCount?: number;
  descriptionLength?: number;
  isBundle?: boolean;
  skipStockAbove?: number;
}

export type BaselinkerField = 'stock' | 'price';

export interface BaselinkerSettings {
  stockAuto: boolean;
  priceAuto: boolean;
  priceGroupId: string;
  skipManualStock: boolean;
  maxAutoChanges: number;
  excludePrefixes: string[];
  excludeSkus: string[];
  priceTolerance: number;
  skipStockAbove: number;
}

export interface BaselinkerDiffRow {
  sku: string;
  name: string;
  ours: number;
  bl: number | null;
  blId: number;
  manual?: boolean;
}

export interface BaselinkerCompare {
  warehouse: string;
  priceGroupId: string | null;
  totals: {
    ours: number;
    bl: number;
    matched: number;
    excluded: number;
    skippedStock: number;
    skippedPrice: number;
    stockDiffs: number;
    priceDiffs: number;
    missingInBl: number;
    onlyInBl: number;
  };
  stockDiffs: BaselinkerDiffRow[];
  priceDiffs: BaselinkerDiffRow[];
  missingInBl: { sku: string; name: string; ours: number }[];
  onlyInBl: { sku: string; name: string; bl: number; blId: number }[];
}

export interface BaselinkerConfig {
  configured: {
    token: boolean;
    inventoryId: number | null;
    warehouseId: string | null;
    priceGroupId: string | null;
  };
  resolvedWarehouse?: string | null;
  settings: BaselinkerSettings;
  inventories?: unknown;
  warehouses?: unknown;
  priceGroups?: unknown;
}

export interface BaselinkerPushResult {
  fields: BaselinkerField[];
  requested: number;
  results: Record<string, { updated: number; skipped: number; warnings: Record<string, unknown>; error?: string }>;
  noLinkCount: number;
  noLink: string[];
}

export interface BaselinkerLogRow {
  id: string;
  created_at: string;
  trigger: string;
  user_label: string;
  field: string;
  requested: number;
  updated: number;
  skipped: number;
  status: string;
  note: string;
  sample?: { sku: string; blId: string; value: number }[] | null;
}

async function call<T>(body: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new Error('Brak Supabase');
  const { data, error } = await supabase.functions.invoke('baselinker', { body });
  if (error) {
    let detail = error.message || 'Błąd funkcji baselinker';
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === 'function') {
        const payload = (await ctx.json()) as { error?: string };
        if (payload?.error) detail = payload.error;
      }
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  if (data && typeof data === 'object' && 'error' in data && data.error) {
    throw new Error(String((data as { error: string }).error));
  }
  return data as T;
}

const productCache = new Map<string, { at: number; value: BaselinkerProduct }>();
const CACHE_MS = 5 * 60_000;

export async function fetchBaselinkerProduct(
  sku: string,
  force = false,
): Promise<BaselinkerProduct> {
  const key = sku.trim().toUpperCase();
  const hit = productCache.get(key);
  if (!force && hit && Date.now() - hit.at < CACHE_MS) return hit.value;
  const value = await call<BaselinkerProduct>({ action: 'product', sku });
  productCache.set(key, { at: Date.now(), value });
  return value;
}

export function invalidateBaselinkerProduct(sku: string): void {
  productCache.delete(sku.trim().toUpperCase());
}

export const fetchBaselinkerConfig = () => call<BaselinkerConfig>({ action: 'config' });
export const saveBaselinkerSettings = (settings: BaselinkerSettings) =>
  call<{ ok: boolean; settings: BaselinkerSettings }>({ action: 'settings-set', settings });
export const compareBaselinker = () => call<BaselinkerCompare>({ action: 'compare' });
export const pushToBaselinker = (skus: string[], fields: BaselinkerField[]) =>
  call<BaselinkerPushResult>({ action: 'push', skus, fields });
export const fetchBaselinkerHistory = () =>
  call<{ rows: BaselinkerLogRow[] }>({ action: 'history' }).then((r) => r.rows);
