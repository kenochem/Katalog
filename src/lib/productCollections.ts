import { supabase, isSupabaseConfigured } from './supabase';

const STORAGE_PREFIX = 'katalog-collections';

export type CollectionIntent =
  | 'general'
  | 'shop-tags'
  | 'photos'
  | 'pricing'
  | 'promo';

export const COLLECTION_INTENT_LABELS: Record<CollectionIntent, string> = {
  general: 'Ogólny',
  'shop-tags': 'Tagi / sklep',
  photos: 'Zdjęcia',
  pricing: 'Ceny / oferta',
  promo: 'Promocja',
};

export interface ProductCollection {
  id: string;
  name: string;
  note: string;
  intent: CollectionIntent;
  productIds: string[];
  createdAt: number;
  updatedAt: number;
}

function storageKey(userKey: string): string {
  return `${STORAGE_PREFIX}:${userKey || 'guest'}`;
}

export function isCloudCollectionsAccount(userKey: string): boolean {
  return userKey !== 'guest' && userKey.length > 8;
}

function readLocal(userKey: string): ProductCollection[] {
  try {
    const raw = localStorage.getItem(storageKey(userKey));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (c): c is ProductCollection =>
        c != null &&
        typeof c === 'object' &&
        typeof (c as ProductCollection).id === 'string' &&
        typeof (c as ProductCollection).name === 'string' &&
        Array.isArray((c as ProductCollection).productIds),
    );
  } catch {
    return [];
  }
}

function writeLocal(userKey: string, list: ProductCollection[]): void {
  localStorage.setItem(storageKey(userKey), JSON.stringify(list));
}

function rowToCollection(row: Record<string, unknown>): ProductCollection {
  return {
    id: String(row.id),
    name: String(row.name),
    note: String(row.note ?? ''),
    intent: (row.intent as CollectionIntent) || 'general',
    productIds: Array.isArray(row.product_ids)
      ? (row.product_ids as string[]).filter(Boolean)
      : [],
    createdAt: Number(row.created_at) || Date.now(),
    updatedAt: Number(row.updated_at) || Date.now(),
  };
}

function collectionToRow(userId: string, col: ProductCollection) {
  return {
    id: col.id,
    user_id: userId,
    name: col.name,
    note: col.note || '',
    intent: col.intent,
    product_ids: col.productIds,
    created_at: col.createdAt,
    updated_at: col.updatedAt,
  };
}

async function fetchCloudCollections(userId: string): Promise<ProductCollection[]> {
  if (!isSupabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from('product_collections')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => rowToCollection(row as Record<string, unknown>));
}

async function upsertCloudCollection(userId: string, col: ProductCollection): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  const { error } = await supabase
    .from('product_collections')
    .upsert(collectionToRow(userId, col), { onConflict: 'id' });
  if (error) throw error;
}

async function deleteCloudCollection(userId: string, id: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  const { error } = await supabase
    .from('product_collections')
    .delete()
    .eq('user_id', userId)
    .eq('id', id);
  if (error) throw error;
}

function mergeCollectionLists(
  local: ProductCollection[],
  cloud: ProductCollection[],
): ProductCollection[] {
  const byId = new Map<string, ProductCollection>();
  for (const c of cloud) byId.set(c.id, c);
  for (const c of local) {
    const prev = byId.get(c.id);
    if (!prev || c.updatedAt > prev.updatedAt) {
      byId.set(c.id, c);
    } else if (prev) {
      const ids = [...new Set([...prev.productIds, ...c.productIds])];
      byId.set(c.id, { ...prev, productIds: ids, updatedAt: Math.max(prev.updatedAt, c.updatedAt) });
    }
  }
  return [...byId.values()].sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Synchroniczny odczyt cache (localStorage) — po `hydrateCollections`. */
export function loadCollections(userKey: string): ProductCollection[] {
  return readLocal(userKey).sort((a, b) => b.updatedAt - a.updatedAt);
}

/**
 * Wczytaj foldery: chmura + merge z localStorage (gość = tylko local).
 * Zapisuje wynik do localStorage jako cache.
 */
export async function hydrateCollections(userKey: string): Promise<ProductCollection[]> {
  if (!userKey) return [];
  if (!isCloudCollectionsAccount(userKey)) {
    return loadCollections(userKey);
  }

  const localFirst = readLocal(userKey);

  try {
    const cloud = await fetchCloudCollections(userKey);
    const merged = mergeCollectionLists(localFirst, cloud);
    writeLocal(userKey, merged);

    for (const col of merged) {
      const inCloud = cloud.find((c) => c.id === col.id);
      if (!inCloud || col.updatedAt > inCloud.updatedAt) {
        try {
          await upsertCloudCollection(userKey, col);
        } catch (err) {
          console.warn('hydrateCollections upsert', col.id, err);
        }
      }
    }

    return loadCollections(userKey);
  } catch (err) {
    console.warn('hydrateCollections', err);
    return loadCollections(userKey);
  }
}

export function saveCollections(userKey: string, list: ProductCollection[]): void {
  writeLocal(userKey, list);
}

async function persistCollection(userKey: string, col: ProductCollection): Promise<void> {
  const list = readLocal(userKey);
  const idx = list.findIndex((c) => c.id === col.id);
  if (idx >= 0) list[idx] = col;
  else list.unshift(col);
  writeLocal(userKey, list);
  if (isCloudCollectionsAccount(userKey)) {
    await upsertCloudCollection(userKey, col);
  }
}

export async function createCollection(
  userKey: string,
  input: { name: string; note?: string; intent?: CollectionIntent },
): Promise<ProductCollection> {
  const now = Date.now();
  const col: ProductCollection = {
    id: `col-${now}-${Math.random().toString(36).slice(2, 8)}`,
    name: input.name.trim(),
    note: input.note?.trim() || '',
    intent: input.intent || 'general',
    productIds: [],
    createdAt: now,
    updatedAt: now,
  };
  await persistCollection(userKey, col);
  return col;
}

export async function updateCollection(
  userKey: string,
  id: string,
  patch: Partial<Pick<ProductCollection, 'name' | 'note' | 'intent'>>,
): Promise<ProductCollection | null> {
  const list = readLocal(userKey);
  const idx = list.findIndex((c) => c.id === id);
  if (idx < 0) return null;
  const next = {
    ...list[idx]!,
    ...patch,
    updatedAt: Date.now(),
  };
  await persistCollection(userKey, next);
  return next;
}

export async function deleteCollection(userKey: string, id: string): Promise<void> {
  writeLocal(
    userKey,
    readLocal(userKey).filter((c) => c.id !== id),
  );
  if (isCloudCollectionsAccount(userKey)) {
    await deleteCloudCollection(userKey, id);
  }
}

export async function addProductToCollection(
  userKey: string,
  collectionId: string,
  productId: string,
): Promise<boolean> {
  const list = readLocal(userKey);
  const idx = list.findIndex((c) => c.id === collectionId);
  if (idx < 0) return false;
  const col = { ...list[idx]! };
  if (col.productIds.includes(productId)) return true;
  col.productIds = [productId, ...col.productIds];
  col.updatedAt = Date.now();
  await persistCollection(userKey, col);
  return true;
}

export async function removeProductFromCollection(
  userKey: string,
  collectionId: string,
  productId: string,
): Promise<void> {
  const list = readLocal(userKey);
  const idx = list.findIndex((c) => c.id === collectionId);
  if (idx < 0) return;
  const col = { ...list[idx]! };
  col.productIds = col.productIds.filter((id) => id !== productId);
  col.updatedAt = Date.now();
  await persistCollection(userKey, col);
}

/** @deprecated użyj hydrateCollections */
export async function tryLoadCollectionsFromCloud(
  userId: string,
): Promise<ProductCollection[] | null> {
  try {
    return await fetchCloudCollections(userId);
  } catch {
    return null;
  }
}
