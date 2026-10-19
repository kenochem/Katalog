import { supabase, isSupabaseConfigured } from './supabase';
import { logAudit } from './auditLog';
import { invalidateProductsCache } from './products';

/**
 * Wyjątki w „Uzupełnianiu danych”: produkt, któremu nie trzeba czegoś uzupełniać
 * (np. nie trafi do BaseLinkera, nie ma EAN, zdjęcie niepotrzebne), znika z listy braków.
 * Zapis w product_meta produktu (wspólny dla wszystkich).
 */
export type ExceptionKind = 'photo' | 'category' | 'mfr' | 'ean' | 'price' | 'low' | 'type' | 'bl' | 'validation' | 'attrs';

export const EXCEPTION_KIND_LABEL: Record<ExceptionKind | 'all', string> = {
  photo: 'Zdjęcie',
  category: 'Kategoria',
  mfr: 'Producent',
  ean: 'EAN',
  price: 'Cena sprzedaży',
  low: 'Kompletność opisów',
  type: 'Typ produktu',
  bl: 'BaseLinker',
  validation: 'Walidacje jakości',
  attrs: 'Atrybuty',
  all: 'Wszystko',
};

export interface ExceptionPreset {
  id: string;
  label: string;
  hint: string;
  kinds: (ExceptionKind | 'all')[];
  note: string;
}

/** Gotowe wyjątki: kliknięcie ustawia rodzaje braków i opis. */
export const EXCEPTION_PRESETS: ExceptionPreset[] = [
  { id: 'no-bl', label: 'Nie idzie do BaseLinkera', hint: 'Produkt nie będzie wystawiany w sklepie', kinds: ['bl'], note: 'Nie planujemy wystawiać w BaseLinkerze' },
  {
    id: 'internal',
    label: 'Tylko do użytku wewnętrznego',
    hint: 'Bez zdjęcia, opisu i BaseLinkera',
    kinds: ['photo', 'low', 'bl', 'price'],
    note: 'Pozycja wewnętrzna — nie sprzedajemy',
  },
  {
    id: 'no-validation',
    label: 'Ignoruj walidacje jakości',
    hint: 'Np. celowy duplikat nazwy, nietypowy EAN albo długi tytuł',
    kinds: ['validation'],
    note: 'Walidacje jakości pominięte',
  },
  { id: 'no-photo', label: 'Zdjęcie niepotrzebne',
 hint: 'Np. część, drobnica, usługa', kinds: ['photo'], note: 'Zdjęcie nie jest potrzebne' },
  { id: 'no-ean', label: 'Brak kodu EAN (nie istnieje)', hint: 'Produkt własny / luzem', kinds: ['ean'], note: 'Produkt bez kodu EAN' },
  { id: 'no-mfr', label: 'Bez producenta (to normalne)', hint: 'Produkt bez marki', kinds: ['mfr'], note: 'Produkt bez marki' },
  { id: 'no-price', label: 'Bez ceny sprzedaży', hint: 'Nie sprzedajemy osobno', kinds: ['price'], note: 'Nie sprzedajemy osobno' },
  { id: 'all', label: 'Cały produkt — nic nie trzeba', hint: 'Znika ze wszystkich list braków', kinds: ['all'], note: 'Wyjątek: nie wymaga uzupełnień' },
];

export function exceptionsOf(product: { meta?: { dataExceptions?: string[] } }): string[] {
  return product.meta?.dataExceptions ?? [];
}

/**
 * Ustawia (albo czyści, gdy `kinds` jest null) wyjątki dla produktów. Dopisuje do aktualnego
 * product_meta z bazy, więc nie gubi innych pól. `merge` = dołącz do istniejących wyjątków.
 */
export async function setDataExceptions(
  ids: string[],
  kinds: (ExceptionKind | 'all')[] | null,
  note = '',
  merge = true,
): Promise<{ failed: string[] }> {
  const failed: string[] = [];
  if (!isSupabaseConfigured || !supabase) return { failed: ids };
  const at = new Date().toISOString();
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    const { data, error } = await supabase.from('products').select('id,sku,display_name,name,product_meta').in('id', chunk);
    if (error) {
      failed.push(...chunk);
      continue;
    }
    const byId = new Map((data ?? []).map((r) => [String(r.id), r]));
    for (const id of chunk) {
      const row = byId.get(id);
      if (!row) {
        failed.push(id);
        continue;
      }
      const meta = { ...((row.product_meta && typeof row.product_meta === 'object' ? row.product_meta : {}) as Record<string, unknown>) };
      const before = Array.isArray(meta.dataExceptions) ? (meta.dataExceptions as string[]) : [];
      if (kinds === null) {
        delete meta.dataExceptions;
        delete meta.dataExceptionNote;
        delete meta.dataExceptionAt;
      } else {
        const next = merge ? [...new Set([...before, ...kinds])] : [...kinds];
        meta.dataExceptions = next;
        if (note.trim()) meta.dataExceptionNote = note.trim();
        meta.dataExceptionAt = at;
      }
      const { error: upErr } = await supabase.from('products').update({ product_meta: meta }).eq('id', id);
      if (upErr) {
        failed.push(id);
        continue;
      }
      logAudit({
        action: 'product.exception',
        entityType: 'product',
        entityId: String(row.sku ?? id),
        entityLabel: String(row.display_name || row.name || ''),
        summary: kinds === null ? 'Wyjątek cofnięty' : `Wyjątek: ${kinds.map((k) => EXCEPTION_KIND_LABEL[k]).join(', ')}`,
        changes: { 'meta: dataExceptions': { from: before.length ? before : null, to: kinds === null ? null : meta.dataExceptions } },
      });
    }
  }
  invalidateProductsCache();
  return { failed };
}
