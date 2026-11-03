import { GitMerge, Loader2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Product } from '../../types';
import { findNearDuplicates } from '../../lib/assortmentAnalysis';
import { runBulkEdit } from '../../lib/bulkEdit';
import { confirmDialog } from '../../lib/dialog';
import { showToast } from '../../lib/toast';
import { effectiveManufacturer, NO_MANUFACTURER } from '../../lib/waproManufacturers';
import { btn, card, SectionHead } from './ui';

export interface MfGroup {
  name: string;
  ids: string[];
}

/** Producenci: marki znalezione w nazwach produktów bez producenta oraz różne zapisy tej samej marki. */
export function ManufacturersTab({
  products,
  groups,
  canEdit,
  onPatched,
}: {
  products: Product[];
  groups: MfGroup[];
  canEdit: boolean;
  onPatched: (patches: { id: string; patch: Partial<Product> }[]) => void;
}) {
  const [busy, setBusy] = useState(false);
  const singles = useMemo(() => products.filter((p) => !p.isGroup), [products]);
  const duplicates = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of products) {
      const m = effectiveManufacturer(p) || NO_MANUFACTURER;
      map.set(m, (map.get(m) ?? 0) + 1);
    }
    return findNearDuplicates([...map.entries()].filter(([name]) => name !== NO_MANUFACTURER).map(([name, count]) => ({ name, count })));
  }, [products]);

  async function assign(ids: string[], name: string) {
    if (!canEdit || !ids.length) return;
    setBusy(true);
    try {
      const res = await runBulkEdit(ids, { manufacturer: name }, `Przypisanie producenta „${name}”`);
      onPatched(res.patches);
      showToast(`Producent „${name}”: ${res.updated} produktów (cofniesz w Logi → Operacje masowe)${res.failed.length ? `, błędy: ${res.failed.length}` : ''}`, res.failed.length ? 'warn' : 'ok', 6000);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Nie udało się zapisać producenta', 'error', 8000);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className={card}>
        <SectionHead title="Producent ukryty w nazwie" hint="Produkty bez producenta, w których nazwie występuje nazwa znanej marki." />
        <ul className="space-y-2">
          {groups.slice(0, 30).map((g) => (
            <li key={g.name} className="flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 truncate font-semibold text-slate-900 dark:text-slate-100">{g.name}</span>
              <span className="flex items-center gap-3">
                <span className="tabular-nums text-slate-600 dark:text-slate-400">{g.ids.length} prod.</span>
                {canEdit && (
                  <button type="button" disabled={busy} className={btn} onClick={() => void assign(g.ids, g.name)}>
                    {busy && <Loader2 className="h-4 w-4 animate-spin" />} Przypisz
                  </button>
                )}
              </span>
            </li>
          ))}
          {groups.length === 0 && <li className="text-sm text-slate-500">Brak podpowiedzi — każdy produkt ma producenta albo marka nie występuje w nazwie.</li>}
        </ul>
      </section>

      <section className={card}>
        <SectionHead title="Różne zapisy tej samej marki" hint="Nazwy różniące się tylko wielkością liter, spacją lub znakami." />
        <ul className="space-y-3">
          {duplicates.map((g) => (
            <li key={g.key} className="flex flex-wrap items-center gap-2 text-sm">
              {g.names.map((n) => (
                <span key={n.name} className="rounded-full bg-black/[0.06] px-2.5 py-0.5 text-xs dark:bg-white/10">
                  {n.name} · {n.count}
                </span>
              ))}
              {canEdit && (
                <button
                  type="button"
                  disabled={busy}
                  className={btn}
                  onClick={async () => {
                    const keep = g.names[0].name;
                    const ids = singles.filter((p) => g.names.slice(1).some((n) => n.name === effectiveManufacturer(p))).map((p) => p.id);
                    const ok = await confirmDialog({ title: 'Scalenie producentów', message: `Ustawić producenta „${keep}” w ${ids.length} produktach?`, confirmLabel: 'Scal', tone: 'warn' });
                    if (ok) await assign(ids, keep);
                  }}
                >
                  <GitMerge className="h-4 w-4" /> Scal do „{g.names[0].name}”
                </button>
              )}
            </li>
          ))}
          {duplicates.length === 0 && <li className="text-sm text-slate-500">Nie znaleziono różnych zapisów tej samej marki.</li>}
        </ul>
      </section>
    </div>
  );
}
