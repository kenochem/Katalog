import { supabase } from './supabase';
import { AUDIT_CLIP, BATCH_KEYS, fetchAuditLog, withAuditBatch, type AuditChange, type AuditEntry } from './auditLog';
import { invalidateProductsCache, updateProduct } from './products';
import type { Product } from '../types';

/**
 * Historia zmian produktu i cofanie. Dane pochodzą z dziennika aktywności (wartość przed i po),
 * więc cofnięcie = zapis dawnej wartości z powrotem (to też trafia do dziennika jako nowa zmiana).
 */

/** Etykieta pola w dzienniku → sposób zapisu. */
type ColumnTarget = { kind: 'column'; key: keyof Product; type: 'string' | 'number' | 'boolean' | 'array' };
type MetaTarget = { kind: 'meta'; key: string };

const COLUMN_BY_LABEL: Record<string, ColumnTarget> = {
  'Nazwa wyświetlana': { kind: 'column', key: 'displayName', type: 'string' },
  Nazwa: { kind: 'column', key: 'name', type: 'string' },
  Opis: { kind: 'column', key: 'description', type: 'string' },
  EAN: { kind: 'column', key: 'ean', type: 'string' },
  Kategoria: { kind: 'column', key: 'category', type: 'string' },
  Producent: { kind: 'column', key: 'manufacturer', type: 'string' },
  Stan: { kind: 'column', key: 'stock', type: 'number' },
  'Stan ręczny': { kind: 'column', key: 'stockManual', type: 'boolean' },
  'Cena zakupu netto': { kind: 'column', key: 'pricePurchaseNet', type: 'number' },
  'Cena sprzedaży netto': { kind: 'column', key: 'priceSaleNet', type: 'number' },
  'Cena sprzedaży brutto': { kind: 'column', key: 'priceSaleGross', type: 'number' },
  'Zdjęcie główne': { kind: 'column', key: 'customImageUrl', type: 'string' },
  'Zdjęcie (URL)': { kind: 'column', key: 'imageUrl', type: 'string' },
  'Dodatkowe zdjęcia': { kind: 'column', key: 'extraImageUrls', type: 'array' },
  Tagi: { kind: 'column', key: 'tags', type: 'array' },
};

export function isBatchKey(label: string): boolean {
  return BATCH_KEYS.includes(label);
}

function targetOf(label: string): ColumnTarget | MetaTarget | null {
  if (COLUMN_BY_LABEL[label]) return COLUMN_BY_LABEL[label];
  if (label.startsWith('meta: ')) return { kind: 'meta', key: label.slice(6) };
  return null;
}

function typeOk(type: ColumnTarget['type'], v: unknown): boolean {
  if (v == null) return true;
  if (type === 'string') return typeof v === 'string';
  if (type === 'number') return typeof v === 'number';
  if (type === 'boolean') return typeof v === 'boolean';
  return Array.isArray(v);
}

export interface RevertCheck {
  ok: boolean;
  reason?: string;
}

/** Czy zmianę da się cofnąć (znamy pole, wartość „przed” jest kompletna i właściwego typu). */
export function canRevert(label: string, change: AuditChange): RevertCheck {
  if (isBatchKey(label)) return { ok: false, reason: 'znacznik operacji' };
  const t = targetOf(label);
  if (!t) return { ok: false, reason: 'tego pola nie da się cofnąć automatycznie' };
  const from = change.from;
  if (t.kind === 'column') {
    if (typeof from === 'string' && from.length >= AUDIT_CLIP && from.endsWith('…')) return { ok: false, reason: 'wartość zapisana w skróconej postaci' };
    if (!typeOk(t.type, from)) return { ok: false, reason: 'wartość zapisana w skróconej postaci' };
  }
  return { ok: true };
}

/** Pola zmiany bez znaczników operacji masowej. */
export function visibleChanges(changes?: Record<string, AuditChange>): [string, AuditChange][] {
  return Object.entries(changes ?? {}).filter(([k]) => !isBatchKey(k));
}

export function batchOf(entry: Pick<AuditEntry, 'changes'>): { id: string; label: string; undoes?: string } | null {
  const c = entry.changes;
  const id = c?._batch?.to;
  if (typeof id !== 'string') return null;
  const label = typeof c?._batchLabel?.to === 'string' ? (c._batchLabel.to as string) : 'Operacja masowa';
  const undoes = typeof c?._batchUndoes?.to === 'string' ? (c._batchUndoes.to as string) : undefined;
  return { id, label, undoes };
}

export async function fetchProductHistory(sku: string, limit = 120): Promise<AuditEntry[]> {
  const rows = await fetchAuditLog({ entityType: 'product', entityId: sku, limit });
  return rows.filter((r) => r.action.startsWith('product.') && visibleChanges(r.changes).length > 0);
}

/** Znajduje produkt po SKU (jedyny); przy dwóch o tym samym SKU w różnych katalogach zwraca błąd. */
async function findProduct(sku: string): Promise<{ id: string; meta: Record<string, unknown> }> {
  if (!supabase) throw new Error('Brak połączenia z bazą');
  const { data, error } = await supabase.from('products').select('id,product_meta').eq('sku', sku).limit(3);
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error(`Nie znaleziono produktu ${sku}`);
  if (data.length > 1) throw new Error(`SKU ${sku} występuje w kilku katalogach — cofnij zmianę ręcznie w karcie produktu`);
  const meta = data[0].product_meta && typeof data[0].product_meta === 'object' ? (data[0].product_meta as Record<string, unknown>) : {};
  return { id: String(data[0].id), meta: { ...meta } };
}

export interface RevertItem {
  label: string;
  /** Wartość do przywrócenia (stara wartość z dziennika). */
  value: unknown;
}

/** Przywraca wskazane pola produktu (jeden zapis). Zwraca liczbę przywróconych pól. */
export async function revertProductFields(sku: string, items: RevertItem[]): Promise<number> {
  const { id, meta } = await findProduct(sku);
  const updates: Record<string, unknown> = {};
  let metaTouched = false;
  let n = 0;
  for (const it of items) {
    const t = targetOf(it.label);
    if (!t) continue;
    if (t.kind === 'column') {
      const v = it.value;
      updates[t.key as string] = v == null ? (t.type === 'number' ? undefined : t.type === 'array' ? [] : t.type === 'boolean' ? false : '') : v;
      if (updates[t.key as string] === undefined) delete updates[t.key as string];
    } else {
      metaTouched = true;
      if (it.value == null) delete meta[t.key];
      else meta[t.key] = it.value;
    }
    n++;
  }
  if (metaTouched) updates.meta = meta;
  if (!n) return 0;
  await updateProduct(id, updates as Partial<Product>);
  return n;
}

export interface BatchGroup {
  id: string;
  label: string;
  at: string;
  userLabel: string;
  entries: AuditEntry[];
  /** Id partii, którą ta partia cofnęła (jeśli to cofnięcie). */
  undoes?: string;
}

/** Grupuje wpisy dziennika w partie operacji masowych (najnowsze pierwsze). */
export function groupBatches(entries: AuditEntry[]): BatchGroup[] {
  const map = new Map<string, BatchGroup>();
  for (const e of entries) {
    const b = batchOf(e);
    if (!b) continue;
    const g = map.get(b.id) ?? { id: b.id, label: b.label, at: e.createdAt, userLabel: e.userLabel, entries: [], undoes: b.undoes };
    g.entries.push(e);
    if (e.createdAt > g.at) g.at = e.createdAt;
    map.set(b.id, g);
  }
  return [...map.values()].sort((a, b) => b.at.localeCompare(a.at));
}

/** Cofa całą partię: dla każdego produktu przywraca stare wartości zmienionych pól. */
export async function undoBatch(
  batch: BatchGroup,
  onProgress?: (done: number, total: number) => void,
): Promise<{ restored: number; skipped: number; errors: string[] }> {
  // dla każdego SKU bierzemy najstarszy wpis partii (wartość „przed” z początku operacji)
  const bySku = new Map<string, RevertItem[]>();
  const sorted = [...batch.entries].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  let skipped = 0;
  for (const e of sorted) {
    const items = bySku.get(e.entityId) ?? [];
    for (const [label, ch] of visibleChanges(e.changes)) {
      if (items.some((i) => i.label === label)) continue; // starsza wartość już zapisana
      if (!canRevert(label, ch).ok) {
        skipped++;
        continue;
      }
      items.push({ label, value: ch.from });
    }
    bySku.set(e.entityId, items);
  }
  const errors: string[] = [];
  let restored = 0;
  let done = 0;
  await withAuditBatch(
    `Cofnięcie: ${batch.label}`,
    async () => {
      for (const [sku, items] of bySku) {
        try {
          restored += await revertProductFields(sku, items);
        } catch (err) {
          errors.push(`${sku}: ${err instanceof Error ? err.message : 'błąd'}`);
        }
        onProgress?.(++done, bySku.size);
      }
    },
    batch.id,
  );
  invalidateProductsCache();
  return { restored, skipped, errors };
}
