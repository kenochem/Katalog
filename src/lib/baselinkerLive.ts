import { useSyncExternalStore } from 'react';
import { supabase } from './supabase';

/**
 * „Żywe” powiązania SKU → produkt w BaseLinkerze (tabela baselinker_links, odświeżana przez funkcję
 * `baselinker`: po imporcie, przy otwarciu karty produktu, po porównaniu i cyklicznie przez agenta WAPRO).
 * Zasilają niebieski znacznik „B” zamiast statycznego, dawno wygenerowanego indeksu z CSV.
 */

const LS_KEY = 'katalog-bl-links-v1';
const POLL_MS = 5 * 60_000;
const MIN_GAP_MS = 60_000;

let links = new Map<string, number>(); // znormalizowany SKU -> id w BL
let ready = false;
let version = 0;
let started = false;
let lastFetch = 0;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

export function normalizeBlSku(raw: string | undefined | null): string {
  const compact = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const m = compact.match(/^([A-Z]+)0*([0-9]+)$/);
  return m ? `${m[1]}${Number(m[2])}` : compact;
}

function emit() {
  version++;
  for (const l of listeners) l();
}

function saveCache() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ at: Date.now(), entries: [...links.entries()] }));
  } catch {
    /* brak localStorage */
  }
}

function loadCache() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as { entries?: [string, number][] };
    if (Array.isArray(parsed.entries) && parsed.entries.length) {
      links = new Map(parsed.entries);
      ready = true;
    }
  } catch {
    /* ignore */
  }
}

/** Dopóki tabela powiązań nie została zasilona pełnym odświeżeniem (kilka wpisów), używamy starego indeksu z CSV. */
const MIN_LIVE_LINKS = 100;

export function liveLinksReady(): boolean {
  return ready && links.size >= MIN_LIVE_LINKS;
}

export function getLiveLinkId(sku: string | undefined | null): number | undefined {
  return links.get(normalizeBlSku(sku));
}

export function markBaselinkerLinked(sku: string, id = 0): void {
  links.set(normalizeBlSku(sku), id);
  ready = true;
  saveCache();
  emit();
}

export function markBaselinkerUnlinked(sku: string): void {
  if (links.delete(normalizeBlSku(sku))) {
    saveCache();
    emit();
  }
}

export async function refreshLiveLinks(force = false): Promise<void> {
  if (!supabase) return;
  if (inflight) return inflight;
  if (!force && Date.now() - lastFetch < MIN_GAP_MS) return;
  const sb = supabase;
  inflight = (async () => {
    try {
      const next = new Map<string, number>();
      for (let from = 0; ; from += 1000) {
        const { data, error } = await sb
          .from('baselinker_links')
          .select('sku,bl_product_id')
          .order('sku')
          .range(from, from + 999);
        if (error) return; // brak tabeli / brak dostępu (gość) — zostaje poprzedni stan
        for (const r of data ?? []) next.set(normalizeBlSku(String(r.sku)), Number(r.bl_product_id));
        if (!data || data.length < 1000) break;
      }
      lastFetch = Date.now();
      if (next.size === 0 && links.size === 0) return;
      links = next;
      ready = true;
      saveCache();
      emit();
    } catch {
      /* ignore */
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export function startLiveLinks(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  loadCache();
  void refreshLiveLinks(true);
  window.setInterval(() => void refreshLiveLinks(), POLL_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void refreshLiveLinks();
  });
}

export function subscribeLiveLinks(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getLiveLinksVersion(): number {
  return version;
}

/** Hook: odświeża komponent, gdy zmieni się lista powiązań z BaseLinkerem. */
export function useBaselinkerLinksVersion(): number {
  return useSyncExternalStore(subscribeLiveLinks, getLiveLinksVersion, getLiveLinksVersion);
}
