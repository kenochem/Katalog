import { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from './supabase';

const STORAGE_KEY = 'kenochem-crm-mail-enabled-v1';
const CLOUD_ROW_ID = 'default';
export const CRM_MAIL_FEATURE_CHANGED = 'crm-mail-feature-changed';

function loadFromLocal(): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function cacheLocally(value: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, value ? '1' : '0');
  } catch {
    /* ignore */
  }
}

let enabled = loadFromLocal();

function notifyChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(CRM_MAIL_FEATURE_CHANGED));
  }
}

function applyEnabled(next: boolean): void {
  enabled = next;
  cacheLocally(next);
  notifyChanged();
}

/** Aktualny stan flagi (nie-reaktywny — do użycia poza komponentami React). */
export function isCrmMailEnabled(): boolean {
  return enabled;
}

/** Wczytaj flagę z Supabase (raz, np. po zalogowaniu) — lokalny cache jako fallback offline. */
export async function hydrateCrmMailFeatureFromCloud(): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  const { data, error } = await supabase
    .from('app_settings')
    .select('data')
    .eq('id', CLOUD_ROW_ID)
    .maybeSingle();
  if (error) {
    console.warn('app_settings fetch', error);
    return;
  }
  const raw = data?.data as { crmMailEnabled?: boolean } | null | undefined;
  if (raw && typeof raw.crmMailEnabled === 'boolean') {
    applyEnabled(raw.crmMailEnabled);
  }
}

/** Admin: włącz/wyłącz skrzynkę pocztową dla wszystkich. Scal z resztą app_settings,
 * żeby nie nadpisać innych flag zapisanych w tym samym wierszu. */
export async function setCrmMailEnabled(value: boolean, adminUserId?: string): Promise<void> {
  applyEnabled(value);
  if (!isSupabaseConfigured || !supabase) return;
  const { data: existing } = await supabase
    .from('app_settings')
    .select('data')
    .eq('id', CLOUD_ROW_ID)
    .maybeSingle();
  const merged = { ...(existing?.data as Record<string, unknown> | null), crmMailEnabled: value };
  const { error } = await supabase.from('app_settings').upsert(
    {
      id: CLOUD_ROW_ID,
      data: merged,
      updated_by: adminUserId ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  );
  if (error) console.warn('app_settings save', error);
}

/** Reaktywny hook — komponent re-renderuje się, gdy admin przełączy flagę (nawet bez odświeżania). */
export function useCrmMailEnabled(): boolean {
  const [value, setValue] = useState(enabled);
  useEffect(() => {
    const onChange = () => setValue(isCrmMailEnabled());
    window.addEventListener(CRM_MAIL_FEATURE_CHANGED, onChange);
    return () => window.removeEventListener(CRM_MAIL_FEATURE_CHANGED, onChange);
  }, []);
  return value;
}
