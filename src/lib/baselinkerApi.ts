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
}

export interface BaselinkerDiffRow {
  sku: string;
  name: string;
  ours: number;
  bl: number;
  blId: number;
}

export interface BaselinkerCompare {
  warehouse: string;
  totals: {
    ours: number;
    bl: number;
    matched: number;
    diffs: number;
    missingInBl: number;
    onlyInBl: number;
  };
  diffs: BaselinkerDiffRow[];
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
  autoStock: boolean;
  inventories?: unknown;
  warehouses?: unknown;
  priceGroups?: unknown;
}

export interface BaselinkerPushResult {
  updated: number;
  requested: number;
  noLinkCount: number;
  noLink: string[];
  warnings: Record<string, unknown>;
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
export const compareBaselinkerStock = () => call<BaselinkerCompare>({ action: 'compare' });
export const pushBaselinkerStock = (skus: string[]) =>
  call<BaselinkerPushResult>({ action: 'push', skus });
export const setBaselinkerAutoStock = (enabled: boolean) =>
  call<{ ok: boolean; autoStock: boolean }>({ action: 'set-auto', enabled });
