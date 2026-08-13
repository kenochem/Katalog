import type { WarehouseLocation } from './warehouseLocation';
import { isSupabaseConfigured } from './supabase';
import { updateProduct } from './products';

const KEY = 'katalog-warehouse-locations';

type Store = Record<string, WarehouseLocation>;

function readLegacy(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Store;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeLegacy(store: Store): void {
  localStorage.setItem(KEY, JSON.stringify(store));
}

export function getProductLocation(productId: string): WarehouseLocation | undefined {
  const loc = readLegacy()[productId];
  if (!loc) return undefined;
  return loc;
}

/** Preferuje lokalizację z produktu (Supabase), potem legacy localStorage. */
export function resolveProductLocation(
  productId: string,
  fromProduct?: WarehouseLocation,
): WarehouseLocation | undefined {
  if (fromProduct && Object.values(fromProduct).some(Boolean)) return fromProduct;
  return getProductLocation(productId);
}

export async function setProductLocation(
  productId: string,
  loc: WarehouseLocation | null,
  opts?: { fromProduct?: WarehouseLocation },
): Promise<void> {
  const hasValues = loc && Object.values(loc).some(Boolean);
  const store = readLegacy();
  if (!hasValues) {
    delete store[productId];
  } else {
    store[productId] = loc!;
  }
  writeLegacy(store);

  if (isSupabaseConfigured) {
    try {
      await updateProduct(productId, {
        warehouseLocation: hasValues ? loc! : undefined,
      });
    } catch (err) {
      console.warn('warehouse_location save', err);
      throw err;
    }
  }
  void opts;
}

export function mergeLocationIntoProducts<T extends { id: string; warehouseLocation?: WarehouseLocation }>(
  products: T[],
): (T & { warehouseLocation?: WarehouseLocation })[] {
  const legacy = readLegacy();
  return products.map((p) => ({
    ...p,
    warehouseLocation:
      p.warehouseLocation && Object.values(p.warehouseLocation).some(Boolean)
        ? p.warehouseLocation
        : legacy[p.id],
  }));
}

/** Jednorazowy merge legacy → pole na produkcie (wywołaj po załadowaniu katalogu). */
export async function migrateLegacyLocationsToCloud(
  products: { id: string; warehouseLocation?: WarehouseLocation }[],
): Promise<void> {
  if (!isSupabaseConfigured) return;
  const legacy = readLegacy();
  for (const p of products) {
    const leg = legacy[p.id];
    if (!leg) continue;
    if (p.warehouseLocation && Object.values(p.warehouseLocation).some(Boolean)) continue;
    try {
      await updateProduct(p.id, { warehouseLocation: leg });
    } catch {
      /* kolumna może nie istnieć — migracja SQL */
    }
  }
}
