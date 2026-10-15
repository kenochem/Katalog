import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, Loader2, Minus, Plus, RefreshCw, X } from 'lucide-react';
import type { Kit, Product } from '../types';
import { fetchBlKits } from '../lib/baselinkerApi';
import { buildProductLookup } from '../lib/kitResolve';
import {
  blIdOfKit,
  buildKitSync,
  kitIdForBl,
  type KitSyncRow,
  type KitSyncStatus,
} from '../lib/kitSync';
import { saveKit } from '../lib/products';
import { showToast } from '../lib/toast';

const STATUS_LABEL: Record<KitSyncStatus, string> = {
  new: 'Nowy w BaseLinkerze',
  diff: 'Skład się różni',
  same: 'Zgodny z BaseLinkerem',
  'not-bundle': 'Brak składu w BL',
  'missing-in-bl': 'Nie ma już w BL',
};

const STATUS_STYLE: Record<KitSyncStatus, string> = {
  new: 'bg-sky-500/15 text-sky-300',
  diff: 'bg-amber-500/15 text-amber-300',
  same: 'bg-emerald-500/15 text-emerald-300',
  'not-bundle': 'bg-slate-600/30 text-slate-300',
  'missing-in-bl': 'bg-red-500/15 text-red-300',
};

type Filter = 'todo' | 'new' | 'diff' | 'same' | 'problems';

interface Props {
  kits: Kit[];
  products: Product[];
  onClose: () => void;
  onApplied: () => void;
}

/** Porównanie składu zestawów z BaseLinkerem (bundle_products) i zastosowanie poprawek jednym kliknięciem. */
export function KitSyncModal({ kits, products, onClose, onApplied }: Props) {
  const [rows, setRows] = useState<KitSyncRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState('');
  const [filter, setFilter] = useState<Filter>('todo');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const lookup = useMemo(() => buildProductLookup(products), [products]);

  useEffect(() => {
    let cancelled = false;
    const ids = kits.map(blIdOfKit).filter((x): x is number => x != null);
    fetchBlKits(ids)
      .then((r) => {
        if (cancelled) return;
        const built = buildKitSync(r.kits, kits, lookup);
        setRows(built);
        setInfo(`Przeskanowano ${r.scanned} produktów BaseLinkera, sprawdzono ${r.candidates} kandydatów na zestawy.`);
        setSelected(new Set(built.filter((x) => x.status === 'diff' || x.status === 'new').map((x) => x.key)));
      })
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : 'Nie udało się pobrać zestawów z BaseLinkera'));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const counts = useMemo(() => {
    const c: Record<KitSyncStatus, number> = { new: 0, diff: 0, same: 0, 'not-bundle': 0, 'missing-in-bl': 0 };
    for (const r of rows ?? []) c[r.status]++;
    return c;
  }, [rows]);

  const shown = useMemo(() => {
    const list = rows ?? [];
    switch (filter) {
      case 'todo':
        return list.filter((r) => r.status === 'new' || r.status === 'diff');
      case 'new':
        return list.filter((r) => r.status === 'new');
      case 'diff':
        return list.filter((r) => r.status === 'diff');
      case 'same':
        return list.filter((r) => r.status === 'same');
      default:
        return list.filter((r) => r.status === 'not-bundle' || r.status === 'missing-in-bl' || r.unresolved.length > 0);
    }
  }, [rows, filter]);

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function apply() {
    const chosen = (rows ?? []).filter((r) => selected.has(r.key) && (r.status === 'diff' || r.status === 'new'));
    if (chosen.length === 0) return;
    setBusy(true);
    let ok = 0;
    const failed: string[] = [];
    for (const r of chosen) {
      try {
        if (r.status === 'new' && r.blKit) {
          await saveKit({
            id: kitIdForBl(r.blKit.blId),
            name: r.blKit.name,
            description: `Import BaseLinker · zestaw ${r.blKit.blId}`,
            category: 'zestawy',
            items: r.proposedItems,
            imageUrl: r.blKit.image || undefined,
            createdAt: Date.now(),
          });
        } else if (r.localKit) {
          await saveKit({ ...r.localKit, items: r.proposedItems });
        }
        ok++;
      } catch (e) {
        console.error('Zapis zestawu', r.key, e);
        failed.push(r.blKit?.name ?? r.localKit?.name ?? r.key);
      }
    }
    setBusy(false);
    if (failed.length === 0) showToast(`Zaktualizowano ${ok} zestawów wg BaseLinkera`, 'ok', 6000);
    else showToast(`Zapisano ${ok}, błąd: ${failed.length} (${failed.slice(0, 3).join(', ')})`, 'warn', 9000);
    onApplied();
    onClose();
  }

  const applicable = (rows ?? []).filter((r) => selected.has(r.key) && (r.status === 'diff' || r.status === 'new')).length;
  const tab = (id: Filter, label: string, n: number) => (
    <button
      key={id}
      type="button"
      onClick={() => setFilter(id)}
      className={`rounded-lg px-3 py-1.5 text-xs font-medium ${filter === id ? 'bg-slate-700 text-slate-50' : 'text-slate-400 hover:bg-slate-800'}`}
    >
      {label} ({n})
    </button>
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-2 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-800 px-4 py-3">
          <div>
            <h3 className="flex items-center gap-2 text-base font-bold text-slate-50">
              <RefreshCw className="h-4 w-4" /> Skład zestawów z BaseLinkera
            </h3>
            <p className="text-xs text-slate-400">
              Źródłem prawdy jest skład zapisany w BaseLinkerze (bundle). Wcześniejszy import z pliku zgadywał skład z opisów.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800">
            <X className="h-4 w-4" />
          </button>
        </div>

        {error ? (
          <p className="m-4 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</p>
        ) : rows === null ? (
          <div className="flex flex-col items-center gap-2 py-16 text-slate-400">
            <Loader2 className="h-6 w-6 animate-spin" />
            <p className="text-sm">Pobieram zestawy z BaseLinkera…</p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-1 border-b border-slate-800 px-3 py-2">
              {tab('todo', 'Do zmiany', counts.new + counts.diff)}
              {tab('new', 'Nowe', counts.new)}
              {tab('diff', 'Różnice', counts.diff)}
              {tab('same', 'Zgodne', counts.same)}
              {tab('problems', 'Problemy', counts['not-bundle'] + counts['missing-in-bl'])}
            </div>
            <p className="px-4 pt-2 text-[11px] text-slate-500">{info}</p>

            <ul className="min-h-0 flex-1 divide-y divide-slate-800 overflow-y-auto">
              {shown.length === 0 && <li className="px-4 py-10 text-center text-sm text-slate-500">Brak pozycji w tym widoku.</li>}
              {shown.map((r) => {
                const actionable = r.status === 'diff' || r.status === 'new';
                const name = r.blKit?.name ?? r.localKit?.name ?? r.key;
                return (
                  <li key={r.key} className="px-4 py-3">
                    <div className="flex items-start gap-3">
                      {actionable ? (
                        <input type="checkbox" className="mt-1" checked={selected.has(r.key)} onChange={() => toggle(r.key)} />
                      ) : (
                        <span className="w-4" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-100">
                          <span className="truncate">{name}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_STYLE[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                        </p>
                        {r.blKit?.sku && <p className="font-mono text-[11px] text-slate-500">BL: {r.blKit.sku}</p>}

                        {r.status === 'missing-in-bl' && (
                          <p className="mt-1 text-xs text-slate-400">Produkt zestawu nie istnieje już w BaseLinkerze — zostaje bez zmian.</p>
                        )}
                        {r.status === 'not-bundle' && (
                          <p className="mt-1 text-xs text-slate-400">
                            W BaseLinkerze ten produkt nie ma zdefiniowanego składu (nie jest zestawem). Skład w katalogu pochodzi ze starego importu —
                            sprawdź go ręcznie albo zdefiniuj zestaw w BaseLinkerze.
                          </p>
                        )}

                        {(r.status === 'diff' || r.status === 'new') && (
                          <ul className="mt-1.5 space-y-0.5 text-xs">
                            {r.status === 'new' &&
                              r.proposedItems.map((it, i) => (
                                <li key={i} className="flex items-center gap-1.5 text-slate-300">
                                  <Plus className="h-3 w-3 text-emerald-400" />
                                  {it.quantity}× <span className="font-mono text-slate-500">{it.sku}</span> {it.name}
                                </li>
                              ))}
                            {r.diff.added.length > 0 && r.status === 'diff' &&
                              r.diff.added.map((it, i) => (
                                <li key={`a${i}`} className="flex items-center gap-1.5 text-emerald-300">
                                  <Plus className="h-3 w-3" />
                                  dodać: {it.quantity}× <span className="font-mono text-emerald-400/70">{it.sku}</span> {it.name}
                                </li>
                              ))}
                            {r.diff.removed.map((it, i) => (
                              <li key={`r${i}`} className="flex items-center gap-1.5 text-red-300">
                                <Minus className="h-3 w-3" />
                                usunąć: {it.quantity}× <span className="font-mono text-red-400/70">{it.sku}</span> {it.name}
                              </li>
                            ))}
                            {r.diff.changed.map((c, i) => (
                              <li key={`c${i}`} className="flex items-center gap-1.5 text-amber-300">
                                <Check className="h-3 w-3" />
                                ilość <span className="font-mono">{c.sku}</span>: {c.from} → {c.to}
                              </li>
                            ))}
                          </ul>
                        )}

                        {r.unresolved.length > 0 && (
                          <p className="mt-1.5 flex items-start gap-1.5 text-xs text-amber-300">
                            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                            Składniki spoza katalogu (zostaną dopisane z BL): {r.unresolved.join(', ')}
                          </p>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 px-4 py-3">
              <p className="text-xs text-slate-400">
                Zaznaczone do zapisania: <b className="text-slate-200">{applicable}</b>. Zmieniamy tylko skład — nazwy, opisy i zdjęcia zestawów zostają.
              </p>
              <button
                type="button"
                disabled={busy || applicable === 0}
                onClick={() => void apply()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                Zastosuj skład z BaseLinkera ({applicable})
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
