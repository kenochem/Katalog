import { supabase, isSupabaseConfigured } from './supabase';

const FAVORITES_KEY = 'katalog-favorites';
const CLOUD_SYNC_DELAY_MS = 450;

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

function unionIds(...lists: string[][]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const list of lists) {
    for (const id of list) {
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

/** Ulubione lokalne (gość / offline). */
export function getLocalFavoriteIds(): string[] {
  return readLocalIds();
}

/** @deprecated */
export function getFavoriteIds(): string[] {
  return readLocalIds();
}

/** Tylko cache lokalny — w UI używaj favoriteIds z App. */
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

export function setLocalFavorite(productId: string, on: boolean): void {
  const ids = new Set(readLocalIds());
  if (on) ids.add(productId);
  else ids.delete(productId);
  writeLocalIds([...ids]);
}

/** Cache lokalny (także po zalogowaniu — odświeżenie strony). */
export function replaceLocalFavoriteIds(ids: string[]): void {
  writeLocalIds(unionIds(ids));
}

function formatFavoriteError(error: { code?: string; message?: string }): string {
  const msg = (error.message || '').toLowerCase();
  if (error.code === '42501' || msg.includes('permission denied') || msg.includes('row-level security')) {
    return 'Brak uprawnień do ulubionych w Supabase — uruchom migration-user-sync-all.sql (GRANT + RLS).';
  }
  if (error.code === 'PGRST301' || msg.includes('jwt')) {
    return 'Sesja wygasła — wyloguj się i zaloguj ponownie.';
  }
  if (favoriteTableMissing(error)) {
    return 'Brak tabeli user_favorites — uruchom supabase/migration-user-sync-all.sql w SQL Editor.';
  }
  return error.message || 'Błąd zapisu ulubionych';
}

function favoriteTableMissing(error: { code?: string; message?: string }): boolean {
  const msg = (error.message || '').toLowerCase();
  return (
    error.code === 'PGRST205' ||
    error.code === '42P01' ||
    msg.includes('user_favorites') ||
    msg.includes('does not exist')
  );
}

/** Wczytaj ulubione zalogowanego użytkownika (RLS = tylko własne). */
export async function fetchCloudFavoriteIds(_userId: string): Promise<string[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('user_favorites')
    .select('product_id')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(formatFavoriteError(error));
  }

  return (data ?? [])
    .map((r) => r.product_id as string)
    .filter(Boolean);
}

async function insertCloudFavorites(userId: string, productIds: string[]): Promise<void> {
  if (!supabase || productIds.length === 0) return;
  const unique = [...new Set(productIds.filter(Boolean))];
  const rows = unique.map((product_id) => ({ user_id: userId, product_id }));
  const { error } = await supabase.from('user_favorites').upsert(rows, {
    onConflict: 'user_id,product_id',
    ignoreDuplicates: true,
  });
  if (error) {
    throw new Error(formatFavoriteError(error));
  }
}

async function deleteCloudFavorites(userId: string, productIds: string[]): Promise<void> {
  if (!supabase || productIds.length === 0) return;
  const unique = [...new Set(productIds.filter(Boolean))];
  const { error } = await supabase
    .from('user_favorites')
    .delete()
    .eq('user_id', userId)
    .in('product_id', unique);
  if (error) {
    throw new Error(formatFavoriteError(error));
  }
}

/** Ustawia chmurę = dokładnie targetIds (insert brakujących, usuń nadmiar). */
export async function syncCloudFavoritesToMatch(
  userId: string,
  targetIds: string[],
): Promise<void> {
  if (!supabase) throw new Error('Brak Supabase');
  const target = unionIds(targetIds);
  const cloud = await fetchCloudFavoriteIds(userId).catch(() => [] as string[]);
  const missing = target.filter((id) => !cloud.includes(id));
  const extra = cloud.filter((id) => !target.includes(id));
  if (missing.length > 0) await insertCloudFavorites(userId, missing);
  if (extra.length > 0) await deleteCloudFavorites(userId, extra);
}

/** @deprecated — użyj scheduleCloudFavoritesSync */
export async function syncMissingCloudFavorites(
  userId: string,
  productIds: string[],
): Promise<void> {
  await insertCloudFavorites(userId, productIds);
}

let cloudSyncTimer: ReturnType<typeof setTimeout> | null = null;
let cloudSyncUserId: string | null = null;
let cloudSyncTargetIds: string[] = [];
let cloudSyncRunning = false;
let cloudSyncQueued = false;
type CloudSyncErrorHandler = (message: string) => void;
let cloudSyncOnError: CloudSyncErrorHandler | null = null;

async function runCloudSyncLoop(): Promise<void> {
  if (cloudSyncRunning) {
    cloudSyncQueued = true;
    return;
  }
  cloudSyncRunning = true;
  try {
    do {
      cloudSyncQueued = false;
      const userId = cloudSyncUserId;
      if (!userId) break;
      const target = unionIds(cloudSyncTargetIds, readLocalIds());
      try {
        await syncCloudFavoritesToMatch(userId, target);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Nie udało się zsynchronizować ulubionych';
        cloudSyncOnError?.(msg);
        break;
      }
    } while (cloudSyncQueued);
  } finally {
    cloudSyncRunning = false;
  }
}

/** Opóźniony zapis całej listy (kilka gwiazdek naraz → jeden sync). */
export function scheduleCloudFavoritesSync(
  userId: string,
  targetIds: string[],
  onError?: CloudSyncErrorHandler,
): void {
  if (!supabase) return;
  cloudSyncUserId = userId;
  cloudSyncTargetIds = unionIds(targetIds, readLocalIds());
  if (onError) cloudSyncOnError = onError;
  if (cloudSyncTimer) clearTimeout(cloudSyncTimer);
  cloudSyncTimer = setTimeout(() => {
    cloudSyncTimer = null;
    void runCloudSyncLoop();
  }, CLOUD_SYNC_DELAY_MS);
}

/** Natychmiastowy flush (np. przed zamknięciem karty). */
export function flushCloudFavoritesSync(): void {
  if (cloudSyncTimer) {
    clearTimeout(cloudSyncTimer);
    cloudSyncTimer = null;
  }
  void runCloudSyncLoop();
}

/**
 * Po zalogowaniu / odświeżeniu: zawsze local ∪ cloud, potem uzupełnij chmurę.
 */
export async function loadAndMergeFavorites(userId: string): Promise<string[]> {
  const localFirst = readLocalIds();
  let cloud: string[] = [];
  try {
    cloud = await fetchCloudFavoriteIds(userId);
  } catch (err) {
    console.warn('favorites cloud load', err);
    if (localFirst.length > 0) return localFirst;
    throw err;
  }

  const merged = unionIds(localFirst, cloud);
  replaceLocalFavoriteIds(merged);

  const missing = merged.filter((id) => !cloud.includes(id));
  if (missing.length > 0) {
    try {
      await insertCloudFavorites(userId, missing);
    } catch (err) {
      console.warn('favorites merge insert', err);
    }
  }

  return merged;
}

/** Pojedynczy toggle — preferuj scheduleCloudFavoritesSync z pełną listą. */
export async function setCloudFavorite(
  userId: string,
  productId: string,
  on: boolean,
): Promise<void> {
  const target = unionIds(readLocalIds());
  if (on && !target.includes(productId)) target.unshift(productId);
  if (!on) {
    const i = target.indexOf(productId);
    if (i >= 0) target.splice(i, 1);
  }
  await syncCloudFavoritesToMatch(userId, target);
}

export function isSupabaseFavoritesReady(): boolean {
  return isSupabaseConfigured && !!supabase;
}
