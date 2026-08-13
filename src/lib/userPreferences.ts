import type { CatalogListFilter } from '../types';
import type { CatalogSort } from './search';
import { supabase, isSupabaseConfigured } from './supabase';

export type GridDensityPref = 'sm' | 'md' | 'lg';

export interface CatalogUserPreferences {
  sort?: CatalogSort;
  gridDensity?: GridDensityPref;
  catalogListFilter?: CatalogListFilter;
}

export interface UserPreferencesPayload {
  catalog?: CatalogUserPreferences;
}

const LOCAL_KEY = 'katalog-user-preferences-cache';

function readLocalCache(): UserPreferencesPayload {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as UserPreferencesPayload;
  } catch {
    return {};
  }
}

function writeLocalCache(payload: UserPreferencesPayload): void {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(payload));
  } catch {
    /* quota */
  }
}

function mergePayload(
  base: UserPreferencesPayload,
  patch: UserPreferencesPayload,
): UserPreferencesPayload {
  return {
    ...base,
    ...patch,
    catalog: { ...base.catalog, ...patch.catalog },
  };
}

export async function fetchCloudUserPreferences(
  userId: string,
): Promise<UserPreferencesPayload | null> {
  if (!isSupabaseConfigured || !supabase) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('user_preferences')
    .eq('id', userId)
    .maybeSingle();
  if (error) {
    console.warn('user_preferences fetch', error);
    return null;
  }
  const raw = data?.user_preferences;
  if (!raw || typeof raw !== 'object') return {};
  return raw as UserPreferencesPayload;
}

export async function hydrateUserPreferences(userId: string): Promise<UserPreferencesPayload> {
  const local = readLocalCache();
  const cloud = (await fetchCloudUserPreferences(userId)) ?? {};
  const merged = mergePayload(local, cloud);
  writeLocalCache(merged);
  return merged;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let pendingUserId: string | null = null;
let pendingPayload: UserPreferencesPayload | null = null;

async function flushUserPreferences(): Promise<void> {
  if (!pendingUserId || !pendingPayload || !supabase) return;
  const userId = pendingUserId;
  const payload = pendingPayload;
  pendingUserId = null;
  pendingPayload = null;
  writeLocalCache(payload);
  const { error } = await supabase
    .from('profiles')
    .update({ user_preferences: payload })
    .eq('id', userId);
  if (error) console.warn('user_preferences save', error);
}

export function scheduleSaveUserPreferences(
  userId: string,
  patch: UserPreferencesPayload,
): void {
  if (!userId || !isSupabaseConfigured) {
    writeLocalCache(mergePayload(readLocalCache(), patch));
    return;
  }
  const merged = mergePayload(readLocalCache(), patch);
  pendingUserId = userId;
  pendingPayload = merged;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    void flushUserPreferences();
  }, 600);
}

export function getCachedCatalogPreferences(): CatalogUserPreferences {
  return readLocalCache().catalog ?? {};
}
