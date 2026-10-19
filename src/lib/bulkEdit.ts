import type { Product } from '../types';
import { supabase } from './supabase';
import { logAudit, withAuditBatch, type AuditChange } from './auditLog';
import { invalidateProductsCache } from './products';

/**
 * Edycja masowa produktów: producent, kategoria, VAT, jednostka, tagi i ceny
 * (ustaw wartość / zmień o % / zmień o kwotę, z zaokrągleniem). Każda zmiana trafia do dziennika
 * z wartością przed i po, więc całą partię można cofnąć (Logi → Operacje masowe).
 */
export type PriceField = 'priceSaleGross' | 'priceSaleNet' | 'pricePurchaseNet';
export type PriceMode = 'set' | 'percent' | 'amount';
export type PriceRound = 'none' | '0.01' | '0.10' | '1' | '.99' | '.90';

export const PRICE_FIELD_LABEL: Record<PriceField, string> = {
  priceSaleGross: 'Cena sprzedaży brutto',
  priceSaleNet: 'Cena sprzedaży netto',
  pricePurchaseNet: 'Cena zakupu netto',
};

export interface BulkEditSpec {
  manufacturer?: string;
  category?: string;
  vatRate?: number;
  unit?: string;
  tagsAdd?: string[];
  tagsRemove?: string[];
  price?: {
    field: PriceField;
    mode: PriceMode;
    value: number;
    round: PriceRound;
    /** Przelicz drugą cenę sprzedaży (netto ↔ brutto) wg VAT produktu. */
    recompute: boolean;
  };
}

/** Pola produktu potrzebne do wyliczenia zmian. */
export interface BulkSource {
  manufacturer: string;
  category: string;
  tags: string[];
  priceSaleGross: number | null;
  priceSaleNet: number | null;
  pricePurchaseNet: number | null;
  meta: Record<string, unknown>;
}

/** Zmiana jednego pola — etykieta jak w dzienniku (do cofania), wartość przed i po. */
export interface FieldChange {
  label: string;
  column?: string;
  metaKey?: string;
  from: unknown;
  to: unknown;
}

export function roundPrice(value: number, round: PriceRound): number {
  let v = value;
  if (round === '0.01') v = Math.round(v * 100) / 100;
  else if (round === '0.10') v = Math.round(v * 10) / 10;
  else if (round === '1') v = Math.round(v);
  else if (round === '.99') v = Math.max(0.99, Math.floor(v) + 0.99);
  else if (round === '.90') v = Math.max(0.9, Math.floor(v) + 0.9);
  return Math.round(v * 100) / 100;
}

export function applyPrice(current: number | null, mode: PriceMode, value: number, round: PriceRound): number | null {
  if (mode === 'set') return roundPrice(value, round);
  if (current == null) return null;
  const next = mode === 'percent' ? current * (1 + value / 100) : current + value;
  if (next < 0) return null;
  return roundPrice(next, round === 'none' ? '0.01' : round);
}

const sameValue = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** Wylicza zmiany pól dla jednego produktu (bez zapisu). */
export function computeChanges(src: BulkSource, spec: BulkEditSpec): FieldChange[] {
  const out: FieldChange[] = [];
  const push = (c: FieldChange) => {
    if (!sameValue(c.from, c.to)) out.push(c);
  };
  const vat = typeof spec.vatRate === 'number' ? spec.vatRate : typeof src.meta.vatRate === 'number' ? (src.meta.vatRate as number) : 23;

  if (spec.manufacturer !== undefined) {
    push({ label: 'Producent', column: 'manufacturer', from: src.manufacturer, to: spec.manufacturer });
  }
  if (spec.category !== undefined) {
    push({ label: 'Kategoria', column: 'category', from: src.category, to: spec.category });
  }
  if (spec.vatRate !== undefined) {
    push({ label: 'meta: vatRate', metaKey: 'vatRate', from: src.meta.vatRate ?? null, to: spec.vatRate });
  }
  if (spec.unit !== undefined) {
    push({ label: 'meta: unit', metaKey: 'unit', from: src.meta.unit ?? null, to: spec.unit || null });
  }
  if (spec.tagsAdd?.length || spec.tagsRemove?.length) {
    const remove = new Set((spec.tagsRemove ?? []).map((t) => t.toLowerCase()));
    const next = [...src.tags.filter((t) => !remove.has(t.toLowerCase()))];
    for (const t of spec.tagsAdd ?? []) if (!next.some((x) => x.toLowerCase() === t.toLowerCase())) next.push(t);
    push({ label: 'Tagi', column: 'tags', from: src.tags, to: next });
  }
  if (spec.price) {
    const { field, mode, value, round, recompute } = spec.price;
    const current = src[field];
    const next = applyPrice(current, mode, value, round);
    if (next != null) {
      push({ label: PRICE_FIELD_LABEL[field], column: PRICE_COLUMN[field], from: current, to: next });
      if (recompute && field !== 'pricePurchaseNet') {
        const otherField: PriceField = field === 'priceSaleGross' ? 'priceSaleNet' : 'priceSaleGross';
        const other = field === 'priceSaleGross' ? Math.round((next / (1 + vat / 100)) * 100) / 100 : Math.round(next * (1 + vat / 100) * 100) / 100;
        push({ label: PRICE_FIELD_LABEL[otherField], column: PRICE_COLUMN[otherField], from: src[otherField], to: other });
      }
    }
  }
  return out;
}

const PRICE_COLUMN: Record<PriceField, string> = {
  priceSaleGross: 'price_sale_gross',
  priceSaleNet: 'price_sale_net',
  pricePurchaseNet: 'price_purchase_net',
};

const COLUMN_FOR_LABEL: Record<string, string> = {
  manufacturer: 'manufacturer',
  category: 'category',
  tags: 'tags',
  price_sale_gross: 'price_sale_gross',
  price_sale_net: 'price_sale_net',
  price_purchase_net: 'price_purchase_net',
};

/** Źródło do podglądu z produktu z listy (dane lekkie). */
export function sourceFromProduct(p: Product): BulkSource {
  return {
    manufacturer: p.manufacturer ?? '',
    category: p.category ?? '',
    tags: p.tags ?? [],
    priceSaleGross: p.priceSaleGross ?? null,
    priceSaleNet: p.priceSaleNet ?? null,
    pricePurchaseNet: p.pricePurchaseNet ?? null,
    meta: (p.meta ?? {}) as Record<string, unknown>,
  };
}

export interface BulkRunResult {
  updated: number;
  unchanged: number;
  failed: { sku: string; error: string }[];
  batchId: string;
  /** Zmiany do odświeżenia w pamięci aplikacji. */
  patches: { id: string; patch: Partial<Product> }[];
}

function productPatchFrom(changes: FieldChange[], meta: Record<string, unknown>, touchedMeta: boolean): Partial<Product> {
  const patch: Partial<Product> & Record<string, unknown> = {};
  for (const c of changes) {
    if (c.column === 'manufacturer') patch.manufacturer = String(c.to ?? '');
    else if (c.column === 'category') patch.category = String(c.to ?? '');
    else if (c.column === 'tags') patch.tags = c.to as string[];
    else if (c.column === 'price_sale_gross') patch.priceSaleGross = c.to as number;
    else if (c.column === 'price_sale_net') patch.priceSaleNet = c.to as number;
    else if (c.column === 'price_purchase_net') patch.pricePurchaseNet = c.to as number;
  }
  if (touchedMeta) patch.meta = meta as Product['meta'];
  return patch;
}

/** Wykonuje edycję masową na produktach (po id); aktualne dane czyta z bazy. */
export async function runBulkEdit(
  ids: string[],
  spec: BulkEditSpec,
  label: string,
  onProgress?: (done: number, total: number) => void,
): Promise<BulkRunResult> {
  const client = supabase;
  if (!client) throw new Error('Brak połączenia z bazą');
  const failed: BulkRunResult['failed'] = [];
  const patches: BulkRunResult['patches'] = [];
  let updated = 0;
  let unchanged = 0;
  let done = 0;

  const batchId = await withAuditBatch(label, async (id) => {
    for (let i = 0; i < ids.length; i += 100) {
      const chunk = ids.slice(i, i + 100);
      const { data, error } = await client
        .from('products')
        .select('id,sku,display_name,name,manufacturer,category,tags,price_sale_gross,price_sale_net,price_purchase_net,product_meta')
        .in('id', chunk);
      if (error) throw new Error(error.message);
      for (const row of data ?? []) {
        const sku = String(row.sku ?? row.id);
        try {
          const meta = { ...((row.product_meta && typeof row.product_meta === 'object' ? row.product_meta : {}) as Record<string, unknown>) };
          const src: BulkSource = {
            manufacturer: String(row.manufacturer ?? ''),
            category: String(row.category ?? ''),
            tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
            priceSaleGross: row.price_sale_gross != null ? Number(row.price_sale_gross) : null,
            priceSaleNet: row.price_sale_net != null ? Number(row.price_sale_net) : null,
            pricePurchaseNet: row.price_purchase_net != null ? Number(row.price_purchase_net) : null,
            meta,
          };
          const changes = computeChanges(src, spec);
          if (!changes.length) {
            unchanged++;
          } else {
            const update: Record<string, unknown> = {};
            let touchedMeta = false;
            for (const c of changes) {
              if (c.column) update[COLUMN_FOR_LABEL[c.column] ?? c.column] = c.to;
              if (c.metaKey) {
                touchedMeta = true;
                if (c.to == null) delete meta[c.metaKey];
                else meta[c.metaKey] = c.to;
              }
            }
            if (touchedMeta) update.product_meta = meta;
            const { error: upErr } = await client.from('products').update(update).eq('id', row.id);
            if (upErr) throw new Error(upErr.message);
            const logged: Record<string, AuditChange> = {};
            for (const c of changes) logged[c.label] = { from: c.from, to: c.to };
            logAudit({
              action: 'product.update',
              entityType: 'product',
              entityId: sku,
              entityLabel: String(row.display_name || row.name || ''),
              summary: `${label}: ${changes.map((c) => c.label.replace(/^meta: /, '')).join(', ')}`,
              changes: logged,
            });
            patches.push({ id: String(row.id), patch: productPatchFrom(changes, meta, touchedMeta) });
            updated++;
          }
        } catch (err) {
          failed.push({ sku, error: err instanceof Error ? err.message : 'błąd' });
        }
        onProgress?.(++done, ids.length);
      }
    }
    return id;
  });
  invalidateProductsCache();
  return { updated, unchanged, failed, batchId, patches };
}
