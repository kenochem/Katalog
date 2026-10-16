import { CheckSquare, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Eye, EyeOff, ImageOff, Loader2, RotateCcw, Search, SlidersHorizontal, Square, Tag, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { Product } from '../types';
import { getProductImage } from '../lib/products';
import { getProductDisplayCategory } from '../lib/catalogCategory';
import { effectiveManufacturer } from '../lib/waproManufacturers';
import { HIDE_REASON_PRESETS } from '../lib/hideReasons';

const NO_REASON = 'Bez powodu';
type Sort = 'recent' | 'name' | 'sku' | 'stock';

const reasonOf = (p: Product) => p.meta?.catalogHiddenReason?.trim() || NO_REASON;

function ago(iso?: string): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '';
  const days = Math.floor((Date.now() - t) / 86_400_000);
  if (days <= 0) return 'dziś';
  if (days === 1) return 'wczoraj';
  if (days < 30) return `${days} dni temu`;
  return new Date(iso).toLocaleDateString('pl-PL');
}

export function CatalogHiddenView({
  products,
  restoringId,
  onOpenProduct,
  onRestoreProduct,
  onRestoreMany,
  onChangeReason,
}: {
  products: Product[];
  restoringId?: string | null;
  onOpenProduct: (product: Product) => void;
  /** Brak = użytkownik nie ma uprawnienia do przywracania (przyciski są ukryte). */
  onRestoreProduct?: (product: Product) => void;
  onRestoreMany?: (products: Product[]) => void | Promise<void>;
  onChangeReason?: (products: Product[], reason: string) => void | Promise<void>;
}) {
  const [query, setQuery] = useState('');
  const [reason, setReason] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>('recent');
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [newReason, setNewReason] = useState(HIDE_REASON_PRESETS[0]);
  const [busy, setBusy] = useState<'restore' | 'reason' | null>(null);

  const reasons = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of products) map.set(reasonOf(p), (map.get(reasonOf(p)) || 0) + 1);
    return [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pl'));
  }, [products]);

  const filtered = useMemo(() => {
    const tokens = query.trim().toLocaleLowerCase('pl').split(/\s+/).filter(Boolean);
    const list = products.filter((p) => {
      if (reason && reasonOf(p) !== reason) return false;
      if (tokens.length === 0) return true;
      const hay = [p.sku, p.displayName, p.name, effectiveManufacturer(p), getProductDisplayCategory(p), reasonOf(p)]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('pl');
      return tokens.every((t) => hay.includes(t));
    });
    if (sort === 'name') list.sort((a, b) => a.displayName.localeCompare(b.displayName, 'pl'));
    else if (sort === 'sku') list.sort((a, b) => a.sku.localeCompare(b.sku, 'pl', { numeric: true }));
    else if (sort === 'stock') list.sort((a, b) => (b.stock ?? 0) - (a.stock ?? 0));
    else list.sort((a, b) => String(b.meta?.catalogHiddenAt ?? '').localeCompare(String(a.meta?.catalogHiddenAt ?? '')));
    return list;
  }, [products, query, reason, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(current * pageSize, (current + 1) * pageSize);
  const allPageSelected = pageRows.length > 0 && pageRows.every((p) => selected.has(p.id));
  const selectedProducts = filtered.filter((p) => selected.has(p.id));
  const canBulk = Boolean(onRestoreMany || onChangeReason);

  useEffect(() => {
    setPage(0);
    setSelected(new Set());
  }, [query, reason, sort, pageSize]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function togglePage() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allPageSelected) for (const p of pageRows) next.delete(p.id);
      else for (const p of pageRows) next.add(p.id);
      return next;
    });
  }

  async function restoreSelected() {
    if (!onRestoreMany || selectedProducts.length === 0) return;
    setBusy('restore');
    try {
      await onRestoreMany(selectedProducts);
    } finally {
      setBusy(null);
      setSelected(new Set());
    }
  }

  async function changeReason() {
    if (!onChangeReason || selectedProducts.length === 0 || !newReason.trim()) return;
    setBusy('reason');
    try {
      await onChangeReason(selectedProducts, newReason.trim());
    } finally {
      setBusy(null);
      setSelected(new Set());
    }
  }

  const btn =
    'inline-flex h-8 items-center rounded-lg border border-slate-300 bg-white px-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800';

  return (
    <div className="catalog-readable-light w-full space-y-4 pb-10">
      <section className="surface-panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-300">Porządkowanie katalogu</p>
            <h2 className="mt-1 flex items-center gap-2 text-xl font-bold text-slate-950 dark:text-slate-50">
              <EyeOff className="h-5 w-5" /> Ukryte produkty
            </h2>
            <p className="mt-1 max-w-3xl text-sm text-slate-700 dark:text-slate-400">
              Pozycje schowane przed codzienną pracą (części, śmietnik, stare marki). Zostają w bazie i w synchronizacji z WAPRO, ale nie widać ich
              na liście katalogu. Tutaj sprawdzisz powód ukrycia i możesz je przywrócić.
            </p>
          </div>
          <div className="flex gap-3">
            <div className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <p className="text-2xl font-bold tabular-nums text-slate-950 dark:text-slate-50">{products.length.toLocaleString('pl-PL')}</p>
              <p className="text-[11px] text-slate-600 dark:text-slate-400">ukrytych</p>
            </div>
            <div className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <p className="text-2xl font-bold tabular-nums text-slate-950 dark:text-slate-50">{reasons.length}</p>
              <p className="text-[11px] text-slate-600 dark:text-slate-400">powodów</p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_21rem] 2xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-950/30">
            <button type="button" onClick={togglePage} disabled={!canBulk || pageRows.length === 0} className="flex items-center gap-1.5 text-sm font-semibold text-slate-800 disabled:opacity-40 dark:text-slate-100">
              {allPageSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />} Strona
            </button>
            <span className="text-sm tabular-nums text-slate-700 dark:text-slate-300">
              {filtered.length === 0 ? 0 : current * pageSize + 1}–{Math.min(filtered.length, (current + 1) * pageSize)} z {filtered.length.toLocaleString('pl-PL')}
              {reason ? ` (powód: ${reason})` : ''}
            </span>
            <div className="flex items-center gap-1.5">
              <button type="button" className={btn} disabled={current === 0} onClick={() => setPage(0)} aria-label="Pierwsza"><ChevronsLeft className="h-4 w-4" /></button>
              <button type="button" className={btn} disabled={current === 0} onClick={() => setPage(current - 1)} aria-label="Poprzednia"><ChevronLeft className="h-4 w-4" /></button>
              <span className="px-1 text-sm tabular-nums text-slate-700 dark:text-slate-300">{current + 1} / {pageCount}</span>
              <button type="button" className={btn} disabled={current >= pageCount - 1} onClick={() => setPage(current + 1)} aria-label="Następna"><ChevronRight className="h-4 w-4" /></button>
              <button type="button" className={btn} disabled={current >= pageCount - 1} onClick={() => setPage(pageCount - 1)} aria-label="Ostatnia"><ChevronsRight className="h-4 w-4" /></button>
            </div>
          </div>

          {pageRows.length === 0 ? (
            <div className="surface-panel p-8 text-center text-sm text-slate-700 dark:text-slate-400">
              {products.length === 0 ? 'Nie ma ukrytych produktów.' : 'Żaden ukryty produkt nie pasuje do filtrów.'}
            </div>
          ) : (
            <ul className="divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-950/30 dark:shadow-none">
              {pageRows.map((p) => {
                const image = getProductImage(p);
                const busyRow = restoringId === p.id;
                const isSel = selected.has(p.id);
                return (
                  <li
                    key={p.id}
                    className={`grid grid-cols-[1.5rem_4rem_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2.5 transition hover:bg-slate-50 dark:hover:bg-slate-900/60 ${isSel ? 'bg-brand-50/60 dark:bg-brand-500/10' : ''}`}
                  >
                    {canBulk ? (
                      <button type="button" onClick={() => toggle(p.id)} aria-label="Zaznacz" className="text-brand-600 dark:text-brand-300">
                        {isSel ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4 text-slate-400" />}
                      </button>
                    ) : (
                      <span />
                    )}
                    <button
                      type="button"
                      onClick={() => onOpenProduct(p)}
                      title="Otwórz produkt"
                      className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 transition hover:border-brand-400 dark:border-slate-700 dark:bg-slate-900"
                    >
                      {image ? <img src={image} alt="" loading="lazy" className="h-full w-full object-contain p-1" /> : <ImageOff className="h-5 w-5 text-slate-500" />}
                    </button>
                    <button type="button" onClick={() => onOpenProduct(p)} className="min-w-0 text-left">
                      <span className="block truncate font-semibold text-slate-950 dark:text-slate-50">{p.displayName}</span>
                      <span className="mt-0.5 block truncate font-mono text-xs text-slate-600 dark:text-slate-400">
                        {p.sku} · {effectiveManufacturer(p) || 'Bez producenta'} · {getProductDisplayCategory(p)} · stan {p.stock ?? 0}
                      </span>
                      <span className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                        <span className="inline-flex items-center gap-1 rounded-full border border-rose-300 bg-rose-50 px-2 py-0.5 font-semibold text-rose-900 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
                          <EyeOff className="h-3 w-3" /> {reasonOf(p)}
                        </span>
                        {p.meta?.catalogHiddenAt && <span className="text-slate-600 dark:text-slate-400">ukryto {ago(p.meta.catalogHiddenAt)}</span>}
                      </span>
                    </button>
                    <span className="flex flex-col items-end gap-1.5">
                      {onRestoreProduct && (
                        <button
                          type="button"
                          disabled={busyRow}
                          onClick={() => onRestoreProduct(p)}
                          className="inline-flex items-center gap-1 rounded-xl bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-500 disabled:cursor-wait disabled:opacity-60"
                        >
                          {busyRow ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                          {busyRow ? 'Przywracam' : 'Przywróć'}
                        </button>
                      )}
                      <button type="button" onClick={() => onOpenProduct(p)} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 dark:text-brand-300">
                        <Eye className="h-3.5 w-3.5" /> Podgląd
                      </button>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <aside className="space-y-3 lg:sticky lg:top-3 lg:max-h-[calc(100vh-1.5rem)] lg:overflow-y-auto lg:pr-1">
          <section className="surface-panel space-y-3 p-4">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
              <SlidersHorizontal className="h-3.5 w-3.5" /> Filtry
            </p>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Szukaj: nazwa, SKU, producent, powód…" className="input-field with-icon" />
            </div>
            <div>
              <p className="mb-1.5 text-xs font-medium text-slate-600 dark:text-slate-400">Powód ukrycia</p>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setReason(null)}
                  className={`rounded-xl border px-3 py-1.5 text-xs font-semibold ${reason === null ? 'border-brand-500 bg-brand-50 text-brand-800 dark:bg-brand-500/15 dark:text-brand-200' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'}`}
                >
                  Wszystkie ({products.length})
                </button>
                {reasons.map(([r, n]) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setReason(reason === r ? null : r)}
                    className={`rounded-xl border px-3 py-1.5 text-xs font-semibold ${reason === r ? 'border-brand-500 bg-brand-50 text-brand-800 dark:bg-brand-500/15 dark:text-brand-200' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'}`}
                  >
                    {r} ({n})
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Sortowanie</span>
                <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="input-field !w-full text-sm">
                  <option value="recent">Ostatnio ukryte</option>
                  <option value="name">Nazwa A–Z</option>
                  <option value="sku">SKU</option>
                  <option value="stock">Największy stan</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Na stronie</span>
                <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} className="input-field !w-full text-sm">
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={200}>200</option>
                </select>
              </label>
            </div>
          </section>

          {canBulk && (
            <section className="surface-panel space-y-3 p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">Zaznaczone · {selected.size}</p>
                <div className="flex gap-2 text-xs font-semibold">
                  <button type="button" className="text-brand-700 hover:underline dark:text-brand-300" onClick={() => setSelected(new Set(filtered.map((p) => p.id)))}>
                    Zaznacz wszystkie ({filtered.length})
                  </button>
                  {selected.size > 0 && (
                    <button type="button" className="text-slate-600 hover:underline dark:text-slate-400" onClick={() => setSelected(new Set())}>
                      <X className="inline h-3.5 w-3.5" /> Wyczyść
                    </button>
                  )}
                </div>
              </div>
              {onRestoreMany && (
                <button
                  type="button"
                  disabled={selected.size === 0 || busy !== null}
                  onClick={() => void restoreSelected()}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy === 'restore' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                  Przywróć zaznaczone ({selected.size})
                </button>
              )}
              {onChangeReason && (
                <div className="space-y-2 border-t border-slate-200 pt-3 dark:border-slate-800">
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Zmień powód ukrycia na:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {HIDE_REASON_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setNewReason(preset)}
                        className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${newReason === preset ? 'border-rose-500 bg-rose-50 text-rose-900 dark:bg-rose-500/15 dark:text-rose-200' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'}`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                  <input value={newReason} onChange={(e) => setNewReason(e.target.value)} placeholder="Własny powód" className="input-field" />
                  <button
                    type="button"
                    disabled={selected.size === 0 || !newReason.trim() || busy !== null}
                    onClick={() => void changeReason()}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                  >
                    {busy === 'reason' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Tag className="h-4 w-4" />}
                    Zmień powód ({selected.size})
                  </button>
                </div>
              )}
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
