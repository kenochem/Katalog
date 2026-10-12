import { useEffect, useSyncExternalStore } from 'react';
import { supabase } from './supabase';

/**
 * Zarezerwowane sztuki (R) produktów — odczyt z WAPRO robi agent na serwerze (co ~5 min) i zapisuje
 * w products.stock_reserved. Pobieramy je OSOBNYM, lekkim zapytaniem (tylko produkty z rezerwacją, ok. 100 wierszy),
 * żeby brak kolumny (migracja jeszcze nie wykonana) nie psuł głównej listy produktów.
 */

const POLL_MS = 5 * 60_000;
const MIN_GAP_MS = 60_000;

let reserved = new Map<string, number>(); // SKU (wielkie litery) -> sztuki
let version = 0;
let started = false;
let lastFetch = 0;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit() {
  version++;
  for (const l of listeners) l();
}

export function getReservedQty(sku: string | undefined | null): number {
  if (!sku) return 0;
  return reserved.get(String(sku).trim().toUpperCase()) ?? 0;
}

export async function refreshReserved(force = false): Promise<void> {
  if (!supabase) return;
  if (inflight) return inflight;
  if (!force && Date.now() - lastFetch < MIN_GAP_MS) return;
  const sb = supabase;
  inflight = (async () => {
    try {
      const next = new Map<string, number>();
      for (let from = 0; from < 20000; from += 1000) {
        const { data, error } = await sb
          .from('products')
          .select('sku,stock_reserved')
          .gt('stock_reserved', 0)
          .order('sku')
          .range(from, from + 999);
        if (error) return; // brak kolumny / brak dostępu (gość) — zostaje poprzedni stan
        for (const r of data ?? []) {
          const n = Number((r as { stock_reserved: unknown }).stock_reserved);
          if (Number.isFinite(n) && n > 0) next.set(String((r as { sku: string }).sku).toUpperCase(), n);
        }
        if (!data || data.length < 1000) break;
      }
      lastFetch = Date.now();
      reserved = next;
      emit();
    } catch {
      /* ignore */
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export function startReservedSync(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  void refreshReserved(true);
  window.setInterval(() => void refreshReserved(), POLL_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void refreshReserved();
  });
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function getVersion(): number {
  return version;
}

/** Hook: odświeża komponent, gdy zmienią się rezerwacje. Zwraca zarezerwowane sztuki dla SKU. */
export function useReservedQty(sku: string | undefined | null): number {
  useSyncExternalStore(subscribe, getVersion, getVersion);
  useEffect(() => {
    startReservedSync();
  }, []);
  return getReservedQty(sku);
}
