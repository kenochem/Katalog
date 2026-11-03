import { useEffect, useSyncExternalStore } from 'react';
import { STORAGE_BUCKET, isSupabaseConfigured, supabase } from './supabase';

/**
 * Które produkty mają materiały (karty charakterystyki itd.). Pliki leżą w magazynie w katalogach `docs/<id produktu>/`,
 * więc wystarczy jedno zapytanie o listę katalogów — bez dodatkowej kolumny w bazie.
 */
let ids = new Set<string>();
let version = 0;
let started = false;
const listeners = new Set<() => void>();

function emit() {
  version++;
  for (const l of listeners) l();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const getVersion = () => version;

export function hasProductDocs(productId: string): boolean {
  return ids.has(productId);
}

export async function refreshDocsIndex(): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  const bucket = supabase.storage.from(STORAGE_BUCKET);
  const next = new Set<string>();
  for (let offset = 0; offset < 20000; offset += 1000) {
    const { data, error } = await bucket.list('docs', { limit: 1000, offset });
    if (error || !data) return;
    // katalogi produktów nie mają id pliku; puste katalogi znikają z magazynu razem z ostatnim plikiem
    for (const f of data) if (f.name && !f.name.startsWith('_')) next.add(f.name);
    if (data.length < 1000) break;
  }
  ids = next;
  emit();
}

/** Po dodaniu lub usunięciu materiału lista zmienia się od razu, bez ponownego pobierania. */
export function markProductDocs(productId: string, has: boolean): void {
  if (ids.has(productId) === has) return;
  ids = new Set(ids);
  if (has) ids.add(productId);
  else ids.delete(productId);
  emit();
}

/**
 * Hook: wersja indeksu materiałów — do zależności useMemo filtrów.
 * Indeks pobieramy dopiero wtedy, gdy jest potrzebny (`enabled`), żeby nie spowalniać startu katalogu.
 */
export function useDocsIndexVersion(enabled = true): number {
  const v = useSyncExternalStore(subscribe, getVersion, getVersion);
  useEffect(() => {
    if (!enabled || started) return;
    started = true;
    void refreshDocsIndex();
  }, [enabled]);
  return v;
}
