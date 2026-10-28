import type { Product } from '../types';
import { supabase } from './supabase';
import { logAudit, withAuditBatch, type AuditChange } from './auditLog';
import { invalidateProductsCache } from './products';
import { normalizeProductMeta } from './productMeta';
import type { AttrValue } from './attributes';

export interface AttrProposalItem {
  id: string;
  /** Wartości atrybutów do wpisania (klucz → wartość); istniejące inne wartości zostają. */
  attrs: Record<string, AttrValue>;
}

export interface AttrApplyResult {
  updated: number;
  unchanged: number;
  failed: { sku: string; error: string }[];
  batchId: string;
  patches: { id: string; patch: Partial<Product> }[];
}

const sameValue = (a: unknown, b: unknown) => a === b || String(a) === String(b);

/**
 * Wpisuje atrybuty do produktów jako jedną partię do cofnięcia (Logi → Operacje masowe).
 * Aktualne `product_meta` czyta z bazy, więc nie gubi innych pól.
 */
export async function applyAttrProposals(
  items: AttrProposalItem[],
  label: string,
  onProgress?: (done: number, total: number) => void,
): Promise<AttrApplyResult> {
  const client = supabase;
  if (!client) throw new Error('Brak połączenia z bazą');
  const byId = new Map(items.map((i) => [i.id, i]));
  const ids = [...byId.keys()];
  const failed: AttrApplyResult['failed'] = [];
  const patches: AttrApplyResult['patches'] = [];
  let updated = 0;
  let unchanged = 0;
  let done = 0;

  const batchId = await withAuditBatch(label, async (id) => {
    for (let i = 0; i < ids.length; i += 100) {
      const chunk = ids.slice(i, i + 100);
      const { data, error } = await client.from('products').select('id,sku,display_name,name,product_meta').in('id', chunk);
      if (error) throw new Error(error.message);
      for (const row of data ?? []) {
        const sku = String(row.sku ?? row.id);
        try {
          const item = byId.get(String(row.id));
          const meta = { ...((row.product_meta && typeof row.product_meta === 'object' ? row.product_meta : {}) as Record<string, unknown>) };
          const cur = (meta.attrs && typeof meta.attrs === 'object' && !Array.isArray(meta.attrs) ? meta.attrs : {}) as Record<string, unknown>;
          const next: Record<string, unknown> = { ...cur };
          let changed = false;
          for (const [k, v] of Object.entries(item?.attrs ?? {})) {
            if (!sameValue(cur[k], v)) {
              next[k] = v;
              changed = true;
            }
          }
          if (!changed) {
            unchanged++;
          } else {
            meta.attrs = next;
            const { error: upErr } = await client.from('products').update({ product_meta: meta }).eq('id', row.id);
            if (upErr) throw new Error(upErr.message);
            const logged: Record<string, AuditChange> = { 'meta: attrs': { from: Object.keys(cur).length ? cur : null, to: next } };
            logAudit({
              action: 'product.update',
              entityType: 'product',
              entityId: sku,
              entityLabel: String(row.display_name || row.name || ''),
              summary: `${label}: atrybuty`,
              changes: logged,
            });
            patches.push({ id: String(row.id), patch: { meta: normalizeProductMeta(meta) } });
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
