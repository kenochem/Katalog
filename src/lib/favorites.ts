import { supabase } from './supabase';

const FAVORITES_KEY = 'katalog-favorites';

function readLocalIds(): string[] {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function writeLocalIds(ids: string[]) {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(ids));
}

function clearLocalIds() {
  try {
    localStorage.removeItem(FAVORITES_KEY);
  } catch {
    /* ignore */
  }
}

/** Ulubione lokalne (gość / przed migracją). */
export function getLocalFavoriteIds(): string[] {
  return readLocalIds();
}

/** @deprecated użyj getLocalFavoriteIds / loadFavoritesForUser */
export function getFavoriteIds(): string[] {
  return readLocalIds();
}

export function isFavorite(productId: string): boolean {
  return readLocalIds().includes(productId);
}

export function toggleLocalFavorite(productId: string): boolean {
  const ids = readLocalIds();
  const idx = ids.indexOf(productId);
  if (idx >= 0) {
    ids.splice(idx, 1);
    writeLocalIds(ids);
    return false;
  }
  ids.unshift(productId);
  writeLocalIds(ids);
  return true;
}

/** @deprecated użyj toggleLocalFavorite / toggleCloudFavorite */
export function toggleFavorite(productId: string): boolean {
  return toggleLocalFavorite(productId);
}

export function setLocalFavorite(productId: string, on: boolean): void {
  const ids = new Set(readLocalIds());
  if (on) ids.add(productId);
  else ids.delete(productId);
  writeLocalIds([...ids]);
}

export async function fetchCloudFavoriteIds(userId: string): Promise<string[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('user_favorites')
    .select('product_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? [])
    .map((r) => r.product_id as string)
    .filter(Boolean);
}

async function upsertCloudFavorites(userId: string, productIds: string[]): Promise<void> {
  if (!supabase || productIds.length === 0) return;
  const rows = productIds.map((product_id) => ({ user_id: userId, product_id }));
  const { error } = await supabase.from('user_favorites').upsert(rows, {
    onConflict: 'user_id,product_id',
    ignoreDuplicates: true,
  });
  if (error) throw error;
}

/**
 * Po zalogowaniu: chmura + jednorazowy merge z localStorage, potem czyści lokalne.
 */
export async function loadAndMergeFavorites(userId: string): Promise<string[]> {
  const cloud = await fetchCloudFavoriteIds(userId);
  const local = readLocalIds();
  if (local.length === 0) return cloud;

  const missing = local.filter((id) => !cloud.includes(id));
  if (missing.length > 0) {
    try {
      await upsertCloudFavorites(userId, missing);
    } catch (err) {
      console.warn('favorites merge upsert', err);
      // nie czyść lokalnych przy błędzie — użytkownik nic nie traci
      return [...new Set([...missing, ...cloud])];
    }
  }
  clearLocalIds();
  return [...new Set([...missing, ...cloud])];
}

/** Dodaj / usuń w chmurze. Zwraca docelowy stan (czy jest ulubione). */
export async function setCloudFavorite(
  userId: string,
  productId: string,
  on: boolean,
): Promise<void> {
  if (!supabase) throw new Error('Brak Supabase');
  if (on) {
    const { error } = await supabase.from('user_favorites').upsert(
      { user_id: userId, product_id: productId },
      { onConflict: 'user_id,product_id', ignoreDuplicates: true },
    );
    if (error) throw error;
    return;
  }
  const { error } = await supabase
    .from('user_favorites')
    .delete()
    .eq('user_id', userId)
    .eq('product_id', productId);
  if (error) throw error;
}
