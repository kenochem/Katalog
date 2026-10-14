import { useEffect, useSyncExternalStore } from 'react';
import type { Product } from '../types';
import { supabase } from './supabase';
import {
  parseTechName,
  rebuildAliases,
  rebuildDisplayName,
  type TechAttrs,
  type TechParse,
  type TechType,
} from './techParser';

/** Zatwierdzone / poprawione opisy techniczne (tabela product_tech) + propozycje z parsera nazw. */

export interface TechRecord {
  sku: string;
  type: TechType;
  subtype: string;
  attrs: TechAttrs;
  displayName: string;
  aliases: string[];
  status: 'approved' | 'rejected';
  updatedBy: string;
  updatedAt: string;
}

export type TechState = 'approved' | 'proposed';

export interface TechEntry {
  product: Product;
  state: TechState;
  type: TechType;
  subtype: string;
  attrs: TechAttrs;
  displayName: string;
  aliases: string[];
  /** Tylko dla propozycji: pewność parsera i powody wątpliwości. */
  confidence: 'ok' | 'review';
  reasons: string[];
}

let records = new Map<string, TechRecord>();
let version = 0;
let started = false;
let inflight: Promise<void> | null = null;
let lastFetch = 0;
let tableMissing = false;
const listeners = new Set<() => void>();
const POLL_MS = 5 * 60_000;

function emit() {
  version++;
  void import('./productSearchIndex').then((m) => m.invalidateProductSearchIndex());
  for (const l of listeners) l();
}

function rowToRecord(r: Record<string, unknown>): TechRecord {
  const attrs = (r.attrs && typeof r.attrs === 'object' ? r.attrs : {}) as TechAttrs;
  if (!Array.isArray(attrs.ends)) attrs.ends = [];
  return {
    sku: String(r.sku).toUpperCase(),
    type: String(r.type) as TechType,
    subtype: String(r.subtype ?? ''),
    attrs,
    displayName: String(r.display_name ?? ''),
    aliases: Array.isArray(r.aliases) ? (r.aliases as string[]) : [],
    status: r.status === 'rejected' ? 'rejected' : 'approved',
    updatedBy: String(r.updated_by ?? ''),
    updatedAt: String(r.updated_at ?? ''),
  };
}

export async function refreshTech(force = false): Promise<void> {
  if (!supabase || tableMissing) return;
  if (inflight) return inflight;
  if (!force && Date.now() - lastFetch < 60_000) return;
  const sb = supabase;
  inflight = (async () => {
    try {
      const next = new Map<string, TechRecord>();
      for (let from = 0; from < 20_000; from += 1000) {
        const { data, error } = await sb.from('product_tech').select('*').range(from, from + 999);
        if (error) {
          if (/product_tech|relation|schema cache/i.test(error.message)) tableMissing = true;
          return;
        }
        for (const r of data ?? []) {
          const rec = rowToRecord(r as Record<string, unknown>);
          next.set(rec.sku, rec);
        }
        if (!data || data.length < 1000) break;
      }
      records = next;
      lastFetch = Date.now();
      emit();
    } catch {
      /* brak sieci / dostępu */
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export function startTech(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  void refreshTech(true);
  window.setInterval(() => void refreshTech(), POLL_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void refreshTech();
  });
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function getVersion(): number {
  return version;
}

export function useTechVersion(): number {
  const v = useSyncExternalStore(subscribe, getVersion, getVersion);
  useEffect(() => {
    startTech();
  }, []);
  return v;
}

export function isTechTableMissing(): boolean {
  return tableMissing;
}

export function getTechRecord(sku: string | undefined | null): TechRecord | undefined {
  return sku ? records.get(sku.toUpperCase()) : undefined;
}

/** Tekst do wyszukiwarki: nazwa katalogowa + aliasy (tylko dla zatwierdzonych). */
export function getTechSearchText(sku: string | undefined | null): string {
  const r = getTechRecord(sku);
  if (!r || r.status !== 'approved') return '';
  return [r.displayName, ...r.aliases].join(' ').toLowerCase();
}

/** Nazwa katalogowa zatwierdzonego opisu (do wyświetlania obok nazwy WAPRO). */
export function getTechDisplayName(sku: string | undefined | null): string | null {
  const r = getTechRecord(sku);
  return r && r.status === 'approved' && r.displayName ? r.displayName : null;
}

// ---------------------------------------------------------------------------------------------
// Zestaw wpisów dla widoku (zatwierdzone + propozycje parsera)
// ---------------------------------------------------------------------------------------------

let entriesCache: { products: Product[]; ver: number; entries: TechEntry[] } | null = null;

export function buildTechEntries(products: Product[]): TechEntry[] {
  if (entriesCache && entriesCache.products === products && entriesCache.ver === version) {
    return entriesCache.entries;
  }
  const entries: TechEntry[] = [];
  for (const product of products) {
    if (product.isGroup) continue; // „GROUP-…” to kontenery wariantów
    const rec = records.get(product.sku.toUpperCase());
    if (rec) {
      if (rec.status === 'rejected') continue;
      entries.push({
        product,
        state: 'approved',
        type: rec.type,
        subtype: rec.subtype,
        attrs: rec.attrs,
        displayName: rec.displayName,
        aliases: rec.aliases,
        confidence: 'ok',
        reasons: [],
      });
      continue;
    }
    const parsed: TechParse | null = parseTechName(product.name);
    if (!parsed) continue;
    entries.push({
      product,
      state: 'proposed',
      type: parsed.type,
      subtype: parsed.subtype,
      attrs: parsed.attrs,
      displayName: parsed.displayName,
      aliases: parsed.aliases,
      confidence: parsed.confidence,
      reasons: parsed.reasons,
    });
  }
  entriesCache = { products, ver: version, entries };
  return entries;
}

// ---------------------------------------------------------------------------------------------
// Zapis
// ---------------------------------------------------------------------------------------------

export interface TechSaveInput {
  sku: string;
  type: TechType;
  subtype: string;
  attrs: TechAttrs;
  /** Puste = złożymy z parametrów. */
  displayName?: string;
  status?: 'approved' | 'rejected';
}

export async function saveTechRecords(inputs: TechSaveInput[], who: string): Promise<void> {
  if (!supabase) throw new Error('Brak konfiguracji Supabase');
  if (inputs.length === 0) return;
  const now = new Date().toISOString();
  const rows = inputs.map((i) => {
    const displayName = i.displayName?.trim() || rebuildDisplayName(i.type, i.subtype, i.attrs);
    return {
      sku: i.sku.toUpperCase(),
      type: i.type,
      subtype: i.subtype,
      attrs: i.attrs,
      display_name: displayName,
      aliases: rebuildAliases(i.type, i.attrs),
      status: i.status ?? 'approved',
      updated_by: who,
      updated_at: now,
    };
  });
  for (let k = 0; k < rows.length; k += 200) {
    const { error } = await supabase.from('product_tech').upsert(rows.slice(k, k + 200), { onConflict: 'sku' });
    if (error) throw new Error(error.message);
  }
  for (const r of rows) {
    records.set(r.sku, rowToRecord(r as unknown as Record<string, unknown>));
  }
  emit();
}

export async function deleteTechRecord(sku: string): Promise<void> {
  if (!supabase) throw new Error('Brak konfiguracji Supabase');
  const { error } = await supabase.from('product_tech').delete().eq('sku', sku.toUpperCase());
  if (error) throw new Error(error.message);
  records.delete(sku.toUpperCase());
  emit();
}
