import { STORAGE_BUCKET, isSupabaseConfigured, supabase } from './supabase';

/**
 * Pamięć silnika: dziennik decyzji użytkownika (zatwierdzone, zmienione, pominięte propozycje).
 * Zapisuje się we wspólnym magazynie plików, więc działa dla wszystkich użytkowników i nie wymaga zmian w bazie.
 * Silnik uczy się z niej dwóch rzeczy: co zostało potwierdzone (traktowane jak ręczne przypisanie)
 * i czego nie proponować ponownie (odrzucone kategorie dla danego produktu).
 */
export interface MemoryEntry {
  sku: string;
  action: 'accept' | 'change' | 'dismiss';
  /** Co zaproponował silnik. */
  proposed: string;
  /** Co wybrał użytkownik (przy „pomiń” puste). */
  chosen: string;
  /** Kategoria przed decyzją. */
  from: string;
  at: string;
  by?: string;
}

const PATH = 'engine/decisions.json';
const MAX_ENTRIES = 20000;

export async function loadMemory(): Promise<MemoryEntry[]> {
  if (!isSupabaseConfigured || !supabase) return [];
  try {
    const url = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(PATH).data.publicUrl;
    const res = await fetch(`${url}?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return [];
    const parsed = JSON.parse(await res.text());
    return Array.isArray(parsed) ? (parsed as MemoryEntry[]) : [];
  } catch {
    return [];
  }
}

/** Dopisuje decyzje do dziennika (odczyt i zapis na świeżo, żeby nie gubić wpisów innych osób). */
export async function appendMemory(entries: MemoryEntry[]): Promise<MemoryEntry[]> {
  if (!entries.length || !isSupabaseConfigured || !supabase) return entries;
  const current = await loadMemory();
  const next = [...current, ...entries].slice(-MAX_ENTRIES);
  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(PATH, new Blob([JSON.stringify(next)], { type: 'application/json' }), { upsert: true, contentType: 'application/json', cacheControl: '0' });
  if (error) throw new Error(error.message);
  return next;
}

export interface DerivedMemory {
  /** SKU → kategoria potwierdzona przez użytkownika (ostatnia decyzja wygrywa). */
  learned: Record<string, string>;
  /** SKU → kategorie, których użytkownik nie chce dla tego produktu. */
  rejected: Record<string, string[]>;
  stats: { total: number; accepted: number; changed: number; dismissed: number; acceptRate: number | null };
}

export function deriveMemory(entries: MemoryEntry[]): DerivedMemory {
  const learned: Record<string, string> = {};
  const rejected: Record<string, Set<string>> = {};
  const reject = (sku: string, leaf: string) => {
    if (leaf) (rejected[sku] ??= new Set()).add(leaf);
  };
  let accepted = 0;
  let changed = 0;
  let dismissed = 0;
  for (const e of entries) {
    const sku = e.sku.toUpperCase();
    if (e.action === 'dismiss') {
      dismissed++;
      reject(sku, e.proposed);
      continue;
    }
    if (e.action === 'accept') accepted++;
    else {
      changed++;
      if (e.proposed && e.proposed !== e.chosen) reject(sku, e.proposed);
    }
    if (e.chosen) {
      learned[sku] = e.chosen;
      rejected[sku]?.delete(e.chosen);
    }
  }
  const total = accepted + changed + dismissed;
  return {
    learned,
    rejected: Object.fromEntries(Object.entries(rejected).map(([k, v]) => [k, [...v]])),
    stats: { total, accepted, changed, dismissed, acceptRate: total ? Math.round((100 * accepted) / total) : null },
  };
}
