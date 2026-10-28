import { useMemo, useState } from 'react';
import { Check, Loader2, Search, Sparkles } from 'lucide-react';
import type { Product } from '../types';
import { attrValuesOf, getAttributes, saveAttribute, useAttributesVersion, type AttrValue } from '../lib/attributes';
import { applyAttrProposals } from '../lib/segmentApply';
import { CopyName } from './CopyName';
import {
  PART_GROUPS,
  PRODUCT_TYPES,
  SEGMENT_ATTRIBUTES,
  newAttrValues,
  proposeSegmentation,
  type ProductSegmentation,
} from '../lib/segmentation';
import { showToast } from '../lib/toast';

const PAGE = 50;

interface Row {
  product: Product;
  seg: ProductSegmentation;
  /** Wartości, które faktycznie coś zmienią (po uwzględnieniu trybu „nadpisz”). */
  fresh: Record<string, AttrValue>;
}

/** Auto-uzupełnianie atrybutów segregujących (typ towaru, grupa części, właściwości z nazwy) — propozycje do zatwierdzenia. */
export function SegmentationPanel({
  products,
  canEdit,
  onApplied,
}: {
  products: Product[];
  canEdit: boolean;
  onApplied?: (patches: { id: string; patch: Partial<Product> }[]) => void;
}) {
  const version = useAttributesVersion();
  const [overwrite, setOverwrite] = useState(false);
  const [typeFilter, setTypeFilter] = useState('');
  const [confFilter, setConfFilter] = useState<'all' | 'high' | 'low'>('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [overrides, setOverrides] = useState<Record<string, { type?: string; group?: string }>>({});
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<[number, number] | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const installedKeys = useMemo(
    () => new Set(getAttributes().map((a) => a.key)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version],
  );
  const missing = SEGMENT_ATTRIBUTES.filter((a) => !installedKeys.has(a.key));

  const base = useMemo(() => products.filter((p) => !p.isGroup && !p.meta?.catalogHidden), [products]);
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    for (const product of base) {
      const seg = proposeSegmentation(product);
      const ov = overrides[product.id];
      const attrs = { ...seg.attrs };
      if (ov?.type) {
        attrs.typ_towaru = ov.type;
        if (ov.type !== 'Część do myjek ciśnieniowych' && ov.type !== 'Pianownica / opryskiwacz') delete attrs.grupa_czesci;
      }
      if (ov?.group) attrs.grupa_czesci = ov.group;
      const fresh = newAttrValues(attrValuesOf(product), attrs, overwrite);
      if (Object.keys(fresh).length > 0) out.push({ product, seg, fresh });
    }
    return out;
  }, [base, overwrite, overrides]);

  const counts = useMemo(() => {
    const c = new Map<string, number>();
    for (const r of rows) {
      const t = String(r.fresh.typ_towaru ?? attrValuesOf(r.product).typ_towaru ?? r.seg.type.type);
      c.set(t, (c.get(t) ?? 0) + 1);
    }
    return c;
  }, [rows]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      const t = String(overrides[r.product.id]?.type ?? r.seg.type.type);
      if (typeFilter && t !== typeFilter) return false;
      if (confFilter !== 'all' && r.seg.type.confidence !== confFilter) return false;
      if (q && !`${r.product.sku} ${r.product.displayName} ${r.product.manufacturer}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, typeFilter, confFilter, query, overrides]);

  const pages = Math.max(1, Math.ceil(visible.length / PAGE));
  const cur = Math.min(page, pages - 1);
  const pageRows = visible.slice(cur * PAGE, cur * PAGE + PAGE);
  const labelOf = (key: string) => SEGMENT_ATTRIBUTES.find((a) => a.key === key)?.label ?? getAttributes().find((a) => a.key === key)?.label ?? key;
  const unitOf = (key: string) => SEGMENT_ATTRIBUTES.find((a) => a.key === key)?.unit ?? '';

  async function install() {
    setBusy(true);
    try {
      for (const def of missing) await saveAttribute(def);
      showToast(`Zainstalowano atrybuty: ${missing.length}`, 'ok');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Nie udało się zainstalować atrybutów', 'error', 7000);
    } finally {
      setBusy(false);
    }
  }

  const toggle = (id: string) =>
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  async function apply() {
    const chosen = visible.filter((r) => selected.has(r.product.id));
    if (chosen.length === 0) return;
    if (!window.confirm(`Wpisać atrybuty do ${chosen.length} produktów? Operację można cofnąć w Logi → Operacje masowe.`)) return;
    setBusy(true);
    setMessage(null);
    setProgress([0, chosen.length]);
    try {
      const res = await applyAttrProposals(
        chosen.map((r) => ({ id: r.product.id, attrs: r.fresh })),
        `Segregacja atrybutami: ${chosen.length} produktów`,
        (d, t) => setProgress([d, t]),
      );
      onApplied?.(res.patches);
      setSelected(new Set());
      setMessage(res.failed.length ? `Zapisano ${res.updated}, błędy: ${res.failed.length}` : `Zapisano atrybuty w ${res.updated} produktach`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Nie udało się zapisać', 'error', 7000);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  const highCount = visible.filter((r) => r.seg.type.confidence === 'high').length;

  return (
    <div className="space-y-4">
      {missing.length > 0 && (
        <div className="surface-panel flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="max-w-3xl text-sm text-slate-700 dark:text-slate-300">
            Zestaw atrybutów segregujących nie jest jeszcze zainstalowany ({missing.length} z {SEGMENT_ATTRIBUTES.length}): Typ towaru, Grupa części, Gwint, Materiał,
            Ciśnienie, Długość, Kąt i rozmiar dyszy, Pojemność, Masa, Forma produktu, Przeznaczenie. Istniejących atrybutów nie nadpisuje.
          </p>
          {canEdit && (
            <button type="button" disabled={busy} onClick={() => void install()} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Zainstaluj zestaw
            </button>
          )}
        </div>
      )}

      {message && <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">{message}</p>}

      <section className="surface-panel space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Sparkles className="h-4 w-4 text-brand-500" />
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {rows.length} produktów z propozycją atrybutów
            <span className="ml-2 text-xs font-normal text-slate-500">pewnych: {rows.filter((r) => r.seg.type.confidence === 'high').length}</span>
          </p>
          <label className="ml-auto flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
            <input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} className="h-4 w-4 accent-brand-600" />
            Nadpisz też już uzupełnione
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setTypeFilter('');
              setPage(0);
            }}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${typeFilter === '' ? 'border-brand-500 bg-brand-600/10 text-brand-700 dark:text-brand-300' : 'border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300'}`}
          >
            Wszystkie typy
          </button>
          {PRODUCT_TYPES.filter((t) => (counts.get(t) ?? 0) > 0).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setTypeFilter(typeFilter === t ? '' : t);
                setPage(0);
              }}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${typeFilter === t ? 'border-brand-500 bg-brand-600/10 text-brand-700 dark:text-brand-300' : 'border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300'}`}
            >
              {t} <span className="tabular-nums opacity-70">{counts.get(t)}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              ['all', 'Wszystkie'],
              ['high', 'Pewne'],
              ['low', 'Do sprawdzenia'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setConfFilter(id);
                setPage(0);
              }}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${confFilter === id ? 'border-brand-500 bg-brand-600/10 text-brand-700 dark:text-brand-300' : 'border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300'}`}
            >
              {label}
            </button>
          ))}
          <div className="relative ml-auto min-w-[14rem]">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(0);
              }}
              placeholder="Szukaj: SKU, nazwa…"
              className="w-full rounded-xl border border-slate-300 bg-white py-1.5 pl-8 pr-3 text-xs dark:border-slate-700 dark:bg-slate-900"
            />
          </div>
        </div>
        {canEdit && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSelected(new Set(visible.filter((r) => r.seg.type.confidence === 'high').map((r) => r.product.id)))}
              className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              Zaznacz pewne ({highCount})
            </button>
            <button
              type="button"
              onClick={() => setSelected(new Set(pageRows.map((r) => r.product.id)))}
              className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              Zaznacz stronę
            </button>
            {selected.size > 0 && (
              <button type="button" onClick={() => setSelected(new Set())} className="text-xs text-slate-500 underline">
                Wyczyść zaznaczenie
              </button>
            )}
            <span className="ml-auto text-xs text-slate-500">
              {visible.length} wyników · strona {cur + 1}/{pages}
            </span>
          </div>
        )}
      </section>

      {pageRows.length === 0 ? (
        <p className="py-12 text-center text-sm text-slate-500">{rows.length === 0 ? 'Wszystkie produkty mają już uzupełnione te atrybuty.' : 'Brak wyników dla wybranych filtrów.'}</p>
      ) : (
        <ul className="space-y-2">
          {pageRows.map((r) => {
            const ov = overrides[r.product.id];
            const typ = String(ov?.type ?? r.seg.type.type);
            const isPart = typ === 'Część do myjek ciśnieniowych' || typ === 'Pianownica / opryskiwacz';
            const group = String(ov?.group ?? r.seg.type.group ?? '');
            return (
              <li key={r.product.id} className={`rounded-xl border p-3 ${selected.has(r.product.id) ? 'border-brand-500/60 bg-brand-600/5' : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/50'}`}>
                <div className="flex items-start gap-3">
                  {canEdit && <input type="checkbox" checked={selected.has(r.product.id)} onChange={() => toggle(r.product.id)} className="mt-1 h-4 w-4 shrink-0 accent-brand-600" />}
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      <CopyName text={r.product.displayName}>{r.product.displayName}</CopyName>
                    </p>
                    <p className="font-mono text-[11px] text-slate-500">
                      {r.product.sku} · {r.product.manufacturer || 'bez producenta'}
                      {r.seg.type.matched && <span className="ml-2 font-sans">słowo: „{r.seg.type.matched}”</span>}
                      <span className={`ml-2 rounded-full px-1.5 py-0.5 font-sans font-semibold ${r.seg.type.confidence === 'high' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'}`}>
                        {r.seg.type.confidence === 'high' ? 'pewne' : 'do sprawdzenia'}
                      </span>
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      {canEdit ? (
                        <select value={typ} onChange={(e) => setOverrides((p) => ({ ...p, [r.product.id]: { type: e.target.value } }))} className="input-field w-auto py-0.5 text-xs font-semibold">
                          {PRODUCT_TYPES.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="font-semibold">{typ}</span>
                      )}
                      {isPart && canEdit && (
                        <select value={group} onChange={(e) => setOverrides((p) => ({ ...p, [r.product.id]: { ...p[r.product.id], group: e.target.value } }))} className="input-field w-auto py-0.5 text-xs">
                          <option value="">— grupa części —</option>
                          {PART_GROUPS.map((g) => (
                            <option key={g} value={g}>
                              {g}
                            </option>
                          ))}
                        </select>
                      )}
                      {Object.entries(r.fresh)
                        .filter(([k]) => k !== 'typ_towaru' && k !== 'grupa_czesci')
                        .map(([k, v]) => (
                          <span key={k} className="rounded-full bg-sky-500/15 px-2 py-0.5 font-medium text-sky-700 dark:text-sky-300">
                            {labelOf(k)}: {String(v)}
                            {unitOf(k) && typeof v === 'number' ? ` ${unitOf(k)}` : ''}
                          </span>
                        ))}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button type="button" disabled={cur === 0} onClick={() => setPage(cur - 1)} className="rounded-lg border border-slate-300 px-3 py-1 text-sm disabled:opacity-40 dark:border-slate-700">
            Poprzednia
          </button>
          <span className="text-xs text-slate-500">
            {cur + 1} / {pages}
          </span>
          <button type="button" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)} className="rounded-lg border border-slate-300 px-3 py-1 text-sm disabled:opacity-40 dark:border-slate-700">
            Następna
          </button>
        </div>
      )}

      {canEdit && selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-4 z-30 mx-auto flex w-fit items-center gap-3 rounded-2xl border border-slate-300 bg-white px-4 py-2.5 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
          <Check className="h-4 w-4 text-brand-500" />
          <span className="text-sm font-medium text-slate-900 dark:text-slate-100">Zaznaczono {selected.size}</span>
          <button
            type="button"
            disabled={busy || missing.length > 0}
            title={missing.length > 0 ? 'Najpierw zainstaluj zestaw atrybutów' : undefined}
            onClick={() => void apply()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-40"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {progress ? `Zapisuję ${progress[0]}/${progress[1]}` : 'Wpisz atrybuty'}
          </button>
        </div>
      )}
    </div>
  );
}
