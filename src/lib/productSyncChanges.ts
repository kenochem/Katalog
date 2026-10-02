import { supabase } from './supabase';

export type ProductSyncChangeField =
  | 'stock'
  | 'price_purchase_net'
  | 'price_sale_net'
  | 'price_sale_gross';

export interface ProductSyncChange {
  id: string;
  request_id: string | null;
  product_id: string;
  sku: string;
  display_name: string | null;
  field: ProductSyncChangeField;
  old_value: number | null;
  new_value: number | null;
  changed_at: string;
}

export const PRODUCT_SYNC_CHANGE_FIELD_LABELS: Record<ProductSyncChangeField, string> = {
  stock: 'Stan',
  price_purchase_net: 'Cena zakupu netto',
  price_sale_net: 'Cena sprzedaży netto',
  price_sale_gross: 'Cena sprzedaży brutto',
};

/** Najnowsze zmiany stanów/cen z syncu WAPRO — do zakładki Logi. */
export async function getRecentProductSyncChanges(opts?: {
  limit?: number;
  sku?: string;
  requestId?: string;
}): Promise<ProductSyncChange[]> {
  if (!supabase) return [];
  let query = supabase
    .from('product_sync_changes')
    .select('id,request_id,product_id,sku,display_name,field,old_value,new_value,changed_at')
    .order('changed_at', { ascending: false })
    .limit(opts?.limit ?? 1500);

  if (opts?.sku) {
    query = query.ilike('sku', `%${opts.sku}%`);
  }
  if (opts?.requestId) {
    query = query.eq('request_id', opts.requestId);
  }

  const { data, error } = await query;
  if (error) {
    // Najczęstszy powód: migration-product-sync-changes.sql jeszcze nie uruchomiona.
    console.warn('getRecentProductSyncChanges', error.message);
    return [];
  }
  return (data as ProductSyncChange[]) ?? [];
}

/** Pełna historia zmian cen/stanu dla jednego, konkretnego SKU (dopasowanie
 * dokładne — do wykresu „Zmiany w czasie” per produkt), najstarsze pierwsze. */
export async function getProductSyncChangesForSku(
  sku: string,
  limit = 500,
): Promise<ProductSyncChange[]> {
  if (!supabase || !sku.trim()) return [];
  const { data, error } = await supabase
    .from('product_sync_changes')
    .select('id,request_id,product_id,sku,display_name,field,old_value,new_value,changed_at')
    .eq('sku', sku.trim().toUpperCase())
    .order('changed_at', { ascending: true })
    .limit(limit);
  if (error) {
    console.warn('getProductSyncChangesForSku', error.message);
    return [];
  }
  return (data as ProductSyncChange[]) ?? [];
}

export interface ProductSyncChangeRun {
  /** `changed_at` wspólny dla całego przebiegu — skrypt syncu stempluje nim
   * wszystkie wiersze z jednego uruchomienia, więc to naturalny klucz grupowania. */
  changedAt: string;
  items: ProductSyncChange[];
}

/**
 * Grupuje płaską listę zmian po przebiegu syncu (ten sam `changed_at`), żeby
 * każdy sync został osobną, przewijalną/zwijalną sekcją zamiast jednej płaskiej
 * listy, w której nowszy, duży przebieg wypycha starsze poza limit.
 */
export function groupProductSyncChangesByRun(changes: ProductSyncChange[]): ProductSyncChangeRun[] {
  const byTimestamp = new Map<string, ProductSyncChange[]>();
  for (const change of changes) {
    const bucket = byTimestamp.get(change.changed_at);
    if (bucket) bucket.push(change);
    else byTimestamp.set(change.changed_at, [change]);
  }
  return Array.from(byTimestamp.entries())
    .map(([changedAt, items]) => ({ changedAt, items }))
    .sort((a, b) => b.changedAt.localeCompare(a.changedAt));
}
