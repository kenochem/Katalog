import { useSyncExternalStore } from 'react';
import type { Product } from '../types';
import { supabase } from './supabase';
import { logAudit } from './auditLog';
import { getProductDisplayCategory } from './catalogCategory';
import { getShopCategoryTree, type ShopCategoryNode } from './shopCategoryTree';
import { syncAttributeColumns } from './csvExport';

/**
 * Atrybuty strukturalne (parametry produktu): definicje w tabeli catalog_attributes,
 * wartości w product_meta.attrs { klucz: wartość }. Atrybut obowiązuje w wybranych kategoriach
 * (i ich podkategoriach) albo we wszystkich, gdy lista kategorii jest pusta.
 */
export type AttrType = 'text' | 'number' | 'select' | 'bool';
export type AttrValue = string | number | boolean;

export const ATTR_TYPE_LABEL: Record<AttrType, string> = {
  text: 'Tekst',
  number: 'Liczba',
  select: 'Lista wartości',
  bool: 'Tak / Nie',
};

export interface AttributeDef {
  key: string;
  label: string;
  type: AttrType;
  unit: string;
  options: string[];
  categories: string[];
  required: boolean;
  sort: number;
}

let defs: AttributeDef[] = [];
let loaded = false;
let inflight: Promise<void> | null = null;
let version = 0;
const listeners = new Set<() => void>();

function emit() {
  version++;
  syncAttributeColumns(defs);
  listeners.forEach((fn) => fn());
}

export function getAttributes(): AttributeDef[] {
  return defs;
}

export function useAttributesVersion(): number {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => version,
    () => 0,
  );
}

function missingTable(message: string): Error {
  return new Error(
    /does not exist|catalog_attributes|schema cache/i.test(message)
      ? 'Brak tabeli atrybutów w bazie — uruchom migrację migration-catalog-attributes.sql'
      : message,
  );
}

export function slugKey(label: string): string {
  return label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40);
}

export function loadAttributes(force = false): Promise<void> {
  const client = supabase;
  if (!client) return Promise.resolve();
  if (loaded && !force) return Promise.resolve();
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const { data, error } = await client.from('catalog_attributes').select('*').order('sort').order('label');
      if (error) throw error;
      defs = (data ?? []).map((r) => ({
        key: String(r.key),
        label: String(r.label ?? r.key),
        type: (['text', 'number', 'select', 'bool'].includes(String(r.type)) ? String(r.type) : 'text') as AttrType,
        unit: String(r.unit ?? ''),
        options: Array.isArray(r.options) ? (r.options as unknown[]).map(String) : [],
        categories: Array.isArray(r.categories) ? (r.categories as unknown[]).map(String) : [],
        required: r.required === true,
        sort: Number(r.sort ?? 0),
      }));
      loaded = true;
      emit();
    } catch (err) {
      console.warn('catalog_attributes', err);
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export async function saveAttribute(def: AttributeDef): Promise<void> {
  const client = supabase;
  if (!client) throw new Error('Brak połączenia z bazą');
  const key = def.key || slugKey(def.label);
  if (!key) throw new Error('Podaj nazwę atrybutu');
  const { error } = await client.from('catalog_attributes').upsert(
    {
      key,
      label: def.label.trim(),
      type: def.type,
      unit: def.unit.trim() || null,
      options: def.type === 'select' ? def.options.map((o) => o.trim()).filter(Boolean) : [],
      categories: def.categories,
      required: def.required,
      sort: def.sort,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'key' },
  );
  if (error) throw missingTable(error.message);
  await loadAttributes(true);
  logAudit({ action: 'attribute.save', entityType: 'attribute', entityId: key, summary: `Atrybut „${def.label}” zapisany` });
}

export async function deleteAttribute(key: string): Promise<void> {
  const client = supabase;
  if (!client) throw new Error('Brak połączenia z bazą');
  const { error } = await client.from('catalog_attributes').delete().eq('key', key);
  if (error) throw missingTable(error.message);
  await loadAttributes(true);
  logAudit({ action: 'attribute.delete', entityType: 'attribute', entityId: key, summary: `Atrybut „${key}” usunięty z definicji (wartości w produktach zostają)` });
}

// ---------------------------------------------------------------------------------------------
// Zakres kategorii i wartości
// ---------------------------------------------------------------------------------------------

const norm = (s: string) => s.trim().toLowerCase();

/** Nazwy kategorii obejmowane zakresem (kategoria + wszystkie jej podkategorie). */
export function categoryScope(names: string[]): Set<string> {
  const out = new Set<string>();
  const wanted = new Set(names.map(norm));
  const addAll = (n: ShopCategoryNode) => {
    out.add(norm(n.name));
    n.children.forEach(addAll);
  };
  const walk = (nodes: ShopCategoryNode[]) => {
    for (const n of nodes) {
      if (wanted.has(norm(n.name))) addAll(n);
      else walk(n.children);
    }
  };
  walk(getShopCategoryTree().roots);
  for (const n of names) out.add(norm(n));
  return out;
}

/** Atrybuty obowiązujące dla produktu (wg jego kategorii). */
export function attributesFor(product: Product, all: AttributeDef[] = defs): AttributeDef[] {
  const cat = norm(getProductDisplayCategory(product));
  return all.filter((a) => a.categories.length === 0 || categoryScope(a.categories).has(cat));
}

export function attrValuesOf(product: Pick<Product, 'meta'>): Record<string, AttrValue> {
  const raw = (product.meta as { attrs?: unknown } | undefined)?.attrs;
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, AttrValue>) : {};
}

export function hasAttrValue(v: AttrValue | undefined | null): boolean {
  return v !== undefined && v !== null && v !== '';
}

export function formatAttrValue(def: AttributeDef, v: AttrValue | undefined): string {
  if (!hasAttrValue(v)) return '—';
  if (def.type === 'bool') return v === true || v === 'true' ? 'Tak' : 'Nie';
  return `${v}${def.unit ? ` ${def.unit}` : ''}`;
}

/** Sprawdza wartość wg typu; zwraca komunikat błędu albo null. */
export function validateAttrValue(def: AttributeDef, v: AttrValue | undefined): string | null {
  if (!hasAttrValue(v)) return def.required ? 'wymagane' : null;
  if (def.type === 'number') {
    const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
    return Number.isFinite(n) ? null : 'to nie jest liczba';
  }
  if (def.type === 'select' && def.options.length && !def.options.includes(String(v))) return 'wartość spoza listy';
  return null;
}

export function coerceAttrValue(def: AttributeDef, raw: string): AttrValue | undefined {
  const s = raw.trim();
  if (!s) return undefined;
  if (def.type === 'number') {
    const n = Number(s.replace(',', '.'));
    return Number.isFinite(n) ? n : undefined;
  }
  if (def.type === 'bool') return s === 'true' || s.toLowerCase() === 'tak';
  return s;
}

export interface AttrCoverage {
  def: AttributeDef;
  inScope: number;
  filled: number;
  pct: number;
}

/** Ile produktów (w zakresie atrybutu) ma uzupełniony atrybut. */
export function attributeCoverage(products: Product[], all: AttributeDef[] = defs): AttrCoverage[] {
  return all.map((def) => {
    const scope = def.categories.length ? categoryScope(def.categories) : null;
    let inScope = 0;
    let filled = 0;
    for (const p of products) {
      if (scope && !scope.has(norm(getProductDisplayCategory(p)))) continue;
      inScope++;
      if (hasAttrValue(attrValuesOf(p)[def.key])) filled++;
    }
    return { def, inScope, filled, pct: inScope ? Math.round((filled / inScope) * 100) : 0 };
  });
}
