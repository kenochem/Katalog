import { AlertTriangle, Building2, CheckCircle2,
 CheckSquare, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Download, EyeOff, ImageOff, Loader2, Search, SlidersHorizontal, Square, Tag, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { Product } from '../types';
import { getProductImage } from '../lib/products';
import { assessProductKnowledge } from '../lib/productKnowledge';
import { effectiveManufacturer } from '../lib/waproManufacturers';
import { hasBaselinkerLink } from '../lib/baselinkerLink';
import { HIDE_REASON_PRESETS } from '../lib/hideReasons';
import { inferProductTypeLabel } from '../lib/catalogKind';
import {
  getProductDisplayCategory,
  getProductSourceCategory,
  isGenericSourceCategory,
  isLikelyProducerCategory,
  productNeedsCategoryDecision,
} from '../lib/catalogCategory';

type DecisionIssue = {
  label: string;
  tone: 'danger' | 'warn' | 'info';
};

type DecisionRow = {
  product: Product;
  issues: DecisionIssue[];
  score: number;
  knowledgeScore: number;
};

function describeIssues(product: Product, knowledgeScore = assessProductKnowledge(product).score): DecisionIssue[] {
  const issues: DecisionIssue[] = [];
  const manufacturer = effectiveManufacturer(product);
  const typeLabel = inferProductTypeLabel(product);
  const sourceCategory = getProductSourceCategory(product);
  const targetCategory = getProductDisplayCategory(product);

  if (!getProductImage(product)) {
    issues.push({ label: 'brak zdjęcia', tone: 'danger' });
  }
  if (isGenericSourceCategory(sourceCategory)) {
    issues.push({ label: `ogólna kategoria: ${sourceCategory}`, tone: 'danger' });
  } else if (isLikelyProducerCategory(sourceCategory, product)) {
    issues.push({ label: `producent jako kategoria: ${sourceCategory}`, tone: 'danger' });
  } else if (productNeedsCategoryDecision(product)) {
    issues.push({ label: `dopasować: ${sourceCategory} → ${targetCategory}`, tone: 'info' });
  }
  if (!manufacturer || manufacturer === 'Bez producenta') {
    issues.push({ label: 'brak producenta', tone: 'warn' });
  }
  if (!product.ean?.trim() && !product.variants?.some((v) => v.ean?.trim())) {
    issues.push({ label: 'brak EAN', tone: 'warn' });
  }
  if (knowledgeScore < 65) {
    issues.push({ label: `niska kompletność: ${knowledgeScore}%`, tone: 'warn' });
  }
  if (!product.priceSaleGross && !product.priceSaleNet) {
    issues.push({ label: 'brak ceny sprzedaży', tone: 'warn' });
  }
  if (['Akcesoria', 'Produkt sklepowy'].includes(typeLabel)) {
    issues.push({ label: 'typ do potwierdzenia', tone: 'info' });
  }
  if ((product.catalog || 'accessories') === 'shop' && !hasBaselinkerLink(product)) {
    issues.push({ label: 'brak powiązania BaseLinker', tone: 'info' });
  }

  return issues;
}

function issueWeight(issue: DecisionIssue): number {
  if (issue.tone === 'danger') return 4;
  if (issue.tone === 'warn') return 2;
  return 1;
}

export function buildCatalogDecisionRows(products: Product[]): DecisionRow[] {
  return products
    .map((product) => {
      const knowledgeScore = assessProductKnowledge(product).score;
      const issues = describeIssues(product, knowledgeScore);
      return {
        product,
        issues,
        knowledgeScore,
        score: issues.reduce((sum, issue) => sum + issueWeight(issue), 0),
      };
    })
    .filter((row) => row.issues.length > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.knowledgeScore - b.knowledgeScore ||
        a.product.displayName.localeCompare(b.product.displayName, 'pl'),
    );
}

type IssueKind = { key: string; label: string; test: (row: DecisionRow) => boolean };

const ISSUE_KINDS: IssueKind[] = [
  { key: 'photo', label: 'Brak zdjęcia', test: (r) => r.issues.some((i) => i.label === 'brak zdjęcia') },
  {
    key: 'category',
    label: 'Kategoria do decyzji',
    test: (r) => hasCategoryDecision(r.product),
  },
  {
    key: 'generic',
    label: 'Ogólna kategoria / producent jako kategoria',
    test: (r) => r.issues.some((i) => i.label.startsWith('ogólna kategoria') || i.label.startsWith('producent jako kategoria')),
  },
  { key: 'mfr', label: 'Brak producenta', test: (r) => r.issues.some((i) => i.label === 'brak producenta') },
  { key: 'ean', label: 'Brak EAN', test: (r) => r.issues.some((i) => i.label === 'brak EAN') },
  { key: 'price', label: 'Brak ceny sprzedaży', test: (r) => r.issues.some((i) => i.label === 'brak ceny sprzedaży') },
  { key: 'low', label: 'Niska kompletność', test: (r) => r.issues.some((i) => i.label.startsWith('niska kompletność')) },
  { key: 'type', label: 'Typ do potwierdzenia', test: (r) => r.issues.some((i) => i.label === 'typ do potwierdzenia') },
  { key: 'bl', label: 'Brak powiązania BaseLinker', test: (r) => r.issues.some((i) => i.label === 'brak powiązania BaseLinker') },
];

type SortKey = 'urgent' | 'name' | 'sku' | 'complete' | 'stock';
type StockFilter = 'all' | 'with' | 'without';
type CatalogFilter = 'all' | 'accessories' | 'shop';

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'urgent', label: 'Najpilniejsze' },
  { key: 'name', label: 'Nazwa A–Z' },
  { key: 'sku', label: 'SKU' },
  { key: 'complete', label: 'Najmniej kompletne' },
  { key: 'stock', label: 'Największy stan' },
];

export function CatalogDecisionView({
  products,
  onOpenProduct,
  onApplyCategory,
  categoryBusyId,
  onOpenHidden,
  onHideProducts,
  onOpenManufacturers,
}: {
  products: Product[];
  onOpenProduct: (product: Product) => void;
  onApplyCategory?: (product: Product, category: string) => void | Promise<void>;
  categoryBusyId?: string | null;
  onOpenHidden?: () => void;
  onHideProducts?: (products: Product[], reason: string) => void | Promise<void>;
  onOpenManufacturers?: () => void;
}) {
  const [kinds, setKinds] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('urgent');
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const [catalogFilter, setCatalogFilter] = useState<CatalogFilter>('all');
  const [manufacturer, setManufacturer] = useState('');
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);
  const [hideReason, setHideReason] = useState(HIDE_REASON_PRESETS[0]);
  const [hiding, setHiding] = useState(false);

  const rows = useMemo(() => buildCatalogDecisionRows(products), [products]);
  const kindCounts = useMemo(
    () => new Map(ISSUE_KINDS.map((k) => [k.key, rows.filter((r) => k.test(r)).length])),
    [rows],
  );
  const manufacturers = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) {
      const m = effectiveManufacturer(r.product) || 'Bez producenta';
      map.set(m, (map.get(m) || 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pl'));
  }, [rows]);
  const hard = rows.filter((row) => row.score >= 6).length;

  const filteredRows = useMemo(() => {
    const tokens = query.trim().toLocaleLowerCase('pl').split(/\s+/).filter(Boolean);
    const activeKinds = ISSUE_KINDS.filter((k) => kinds.has(k.key));
    const list = rows.filter((row) => {
      const p = row.product;
      if (tokens.length > 0) {
        const hay = [p.sku, p.displayName, p.name, p.ean, effectiveManufacturer(p), getProductDisplayCategory(p)]
          .filter(Boolean)
          .join(' ')
          .toLocaleLowerCase('pl');
        if (!tokens.every((t) => hay.includes(t))) return false;
      }
      if (activeKinds.length > 0 && !activeKinds.some((k) => k.test(row))) return false;
      if (stockFilter === 'with' && !((p.stock ?? 0) > 0)) return false;
      if (stockFilter === 'without' && (p.stock ?? 0) > 0) return false;
      if (catalogFilter !== 'all' && (p.catalog || 'accessories') !== catalogFilter) return false;
      if (manufacturer && (effectiveManufacturer(p) || 'Bez producenta') !== manufacturer) return false;
      return true;
    });
    const byName = (a: DecisionRow, b: DecisionRow) =>
      a.product.displayName.localeCompare(b.product.displayName, 'pl');
    if (sort === 'name') list.sort(byName);
    else if (sort === 'sku') list.sort((a, b) => a.product.sku.localeCompare(b.product.sku, 'pl', { numeric: true }));
    else if (sort === 'complete') list.sort((a, b) => a.knowledgeScore - b.knowledgeScore || byName(a, b));
    else if (sort === 'stock') list.sort((a, b) => (b.product.stock ?? 0) - (a.product.stock ?? 0) || byName(a, b));
    return list;
  }, [rows, query, kinds, stockFilter, catalogFilter, manufacturer, sort]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const pageRows = filteredRows.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  const allPageSelected = pageRows.length > 0 && pageRows.every((r) => selected.has(r.product.id));
  const allFilteredSelected = filteredRows.length > 0 && filteredRows.every((r) => selected.has(r.product.id));
  const selectedRows = filteredRows.filter((r) => selected.has(r.product.id));
  const selectedCategoryRows = selectedRows.filter((r) => onApplyCategory && hasCategoryDecision(r.product));
  const filtersActive =
    kinds.size > 0 || query.trim() !== '' || stockFilter !== 'all' || catalogFilter !== 'all' || manufacturer !== '';

  useEffect(() => {
    setPage(0);
    setSelected(new Set());
  }, [kinds, query, sort, stockFilter, catalogFilter, manufacturer, pageSize]);

  function toggleKind(key: string) {
    setKinds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function resetFilters() {
    setKinds(new Set());
    setQuery('');
    setStockFilter('all');
    setCatalogFilter('all');
    setManufacturer('');
  }

  function toggleSelected(id: string) {
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
      if (allPageSelected) for (const r of pageRows) next.delete(r.product.id);
      else for (const r of pageRows) next.add(r.product.id);
      return next;
    });
  }

  function toggleAllFiltered() {
    setSelected(allFilteredSelected ? new Set() : new Set(filteredRows.map((r) => r.product.id)));
  }

  async function hideSelected() {
    if (!onHideProducts) return;
    const items = selectedRows.map((row) => row.product);
    const reason = hideReason.trim();
    if (items.length === 0 || !reason) return;
    setHiding(true);
    try {
      await onHideProducts(items, reason);
    } finally {
      setHiding(false);
      setSelected(new Set());
    }
  }

  async function applySelected() {
    if (!onApplyCategory) return;
    const items = selectedCategoryRows;
    if (items.length === 0) return;
    setBulkProgress({ done: 0, total: items.length });
    for (const row of items) {
      try {
        await onApplyCategory(row.product, getProductDisplayCategory(row.product));
      } catch (err) {
        console.error(err);
      }
      setBulkProgress((prev) => (prev ? { done: prev.done + 1, total: prev.total } : prev));
    }
    setBulkProgress(null);
    setSelected(new Set());
  }

  function exportCsv() {
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [
      ['SKU', 'Nazwa', 'Producent', 'Kategoria', 'Stan', 'EAN', 'Kompletność %', 'Problemy'].map(esc).join(';'),
      ...filteredRows.map((r) =>
        [
          r.product.sku,
          r.product.displayName,
          effectiveManufacturer(r.product),
          getProductDisplayCategory(r.product),
          r.product.stock ?? 0,
          r.product.ean ?? '',
          r.knowledgeScore,
          r.issues.map((i) => i.label).join(', '),
        ]
          .map(esc)
          .join(';'),
      ),
    ];
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `decyzje-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const selectCls =
    'input-field !w-full text-sm';

  return (
    <div className="catalog-readable-light w-full space-y-4 pb-10">
      <section className="surface-panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-300">
              Porządkowanie katalogu
            </p>
            <h2 className="mt-1 text-xl font-bold text-slate-950 dark:text-slate-50">Decyzje i trudne przypadki</h2>
            <p className="mt-1 max-w-3xl text-sm text-slate-700 dark:text-slate-400">
              Wszystkie produkty wymagające decyzji: kategoria, zdjęcie, EAN, producent, opis, cena albo powiązanie.
              Filtry i akcje masowe są w panelu obok listy.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onOpenManufacturers}

              className="inline-flex items-center rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              <Building2 className="mr-1.5 h-4 w-4" />
              Producenci
            </button>
            <button
              type="button"
              onClick={exportCsv}
              disabled={filteredRows.length === 0}
              className="inline-flex items-center rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              <Download className="mr-1.5 h-4 w-4" />
              Eksport CSV
            </button>
            {onOpenHidden && (
              <button
                type="button"
                onClick={onOpenHidden}
                className="inline-flex items-center rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
              >
                <EyeOff className="mr-1.5 h-4 w-4" />
                Ukryte
              </button>
            )}
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Metric label="Do sprawdzenia" value={rows.length} />
          <Metric label="Ciężkie przypadki" value={hard} />
          <Metric label="Bez zdjęcia" value={kindCounts.get('photo') ?? 0} />
          <Metric label="Kategorie do decyzji" value={kindCounts.get('category') ?? 0} />
          <Metric label="Po filtrach" value={filteredRows.length} />
        </div>
      </section>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_21rem] 2xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0 space-y-3">
          <Pager
            page={currentPage}
            pageCount={pageCount}
            total={filteredRows.length}
            pageSize={pageSize}
            onPage={setPage}
            allPageSelected={allPageSelected}
            onTogglePage={togglePage}
          />

          {filteredRows.length === 0 ? (
            <div className="surface-panel flex items-center gap-3 p-5">
              <CheckCircle2 className="h-6 w-6 text-emerald-500" />
              <div>
                <p className="font-semibold text-slate-950 dark:text-slate-50">Brak pozycji</p>
                <p className="text-sm text-slate-700 dark:text-slate-400">
                  {filtersActive ? 'Żaden produkt nie pasuje do filtrów.' : 'Brak pilnych decyzji.'}
                </p>
              </div>
            </div>
          ) : (
            <ul className="divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-950/30 dark:shadow-none">
              {pageRows.map((row) => {
                const p = row.product;
                const image = getProductImage(p);
                const canApply = onApplyCategory && hasCategoryDecision(p);
                const busy = categoryBusyId === p.id;
                const isSel = selected.has(p.id);
                return (
                  <li
                    key={p.id}
                    className={`grid grid-cols-[1.5rem_4rem_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2.5 transition hover:bg-slate-50 dark:hover:bg-slate-900/60 ${
                      isSel ? 'bg-brand-50/60 dark:bg-brand-500/10' : ''
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSelected(p.id)}
                      aria-label="Zaznacz"
                      className="text-brand-600 dark:text-brand-300"
                    >
                      {isSel ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4 text-slate-400" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenProduct(p)}
                      className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900"
                    >
                      {image ? (
                        <img src={image} alt="" loading="lazy" className="h-full w-full object-contain p-1" />
                      ) : (
                        <ImageOff className="h-5 w-5 text-slate-500" />
                      )}
                    </button>
                    <button type="button" onClick={() => onOpenProduct(p)} className="min-w-0 text-left">
                      <span className="block truncate font-semibold text-slate-950 dark:text-slate-50">
                        {p.displayName}
                      </span>
                      <span className="mt-0.5 block truncate font-mono text-xs text-slate-600 dark:text-slate-400">
                        {p.sku} · {effectiveManufacturer(p) || 'Bez producenta'} · {getProductDisplayCategory(p)} · stan {p.stock ?? 0} · {row.knowledgeScore}%
                      </span>
                      {canApply && (
                        <span className="mt-0.5 block text-xs text-slate-700 dark:text-slate-300">
                          Kategoria: {getProductSourceCategory(p)} → <strong>{getProductDisplayCategory(p)}</strong>
                          {p.meta?.categoryAssignmentConfidence != null ? ` · ${p.meta.categoryAssignmentConfidence}%` : ''}
                        </span>
                      )}
                      <span className="mt-1.5 flex flex-wrap gap-1.5">
                        {row.issues.map((issue) => (
                          <IssueBadge key={issue.label} issue={issue} />
                        ))}
                      </span>
                    </button>
                    <span className="flex flex-col items-end gap-1.5">
                      {canApply && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => onApplyCategory?.(p, getProductDisplayCategory(p))}
                          className="inline-flex items-center rounded-xl bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-500 disabled:cursor-wait disabled:opacity-60"
                        >
                          <Tag className="mr-1 h-3.5 w-3.5" />
                          {busy ? 'Zapisuję' : 'Ustaw kategorię'}
                        </button>
                      )}
                      {onHideProducts && (
                        <button
                          type="button"
                          onClick={() => void onHideProducts([p], hideReason.trim() || HIDE_REASON_PRESETS[0])}
                          title={`Ukryj jako: ${hideReason.trim() || HIDE_REASON_PRESETS[0]}`}
                          className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                          <EyeOff className="h-3.5 w-3.5" />
                          Ukryj
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onOpenProduct(p)}
                        className="inline-flex items-center gap-0.5 text-xs font-semibold text-brand-700 dark:text-brand-300"
                      >
                        Otwórz
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}

          {filteredRows.length > pageSize && (
            <Pager
              page={currentPage}
              pageCount={pageCount}
              total={filteredRows.length}
              pageSize={pageSize}
              onPage={(n) => {
                setPage(n);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              allPageSelected={allPageSelected}
              onTogglePage={togglePage}
            />
          )}
        </div>

        <aside className="space-y-3 lg:sticky lg:top-3 lg:max-h-[calc(100vh-1.5rem)] lg:overflow-y-auto lg:pr-1">
          <section className="surface-panel space-y-3 p-4">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Filtry
              </p>
              {filtersActive && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 dark:text-brand-300"
                >
                  <X className="h-3.5 w-3.5" />
                  Wyczyść
                </button>
              )}
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Szukaj: nazwa, SKU, EAN, producent..."
                className="input-field with-icon"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {ISSUE_KINDS.map((k) => {
                const count = kindCounts.get(k.key) ?? 0;
                if (count === 0 && !kinds.has(k.key)) return null;
                return (
                  <DecisionFilterButton
                    key={k.key}
                    active={kinds.has(k.key)}
                    onClick={() => toggleKind(k.key)}
                    label={`${k.label} (${count})`}
                  />
                );
              })}
            </div>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Producent</span>
              <select value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} className={selectCls}>
                <option value="">Wszyscy ({manufacturers.length})</option>
                {manufacturers.map(([m, c]) => (
                  <option key={m} value={m}>
                    {m} ({c})
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Stan magazynowy</span>
                <select value={stockFilter} onChange={(e) => setStockFilter(e.target.value as StockFilter)} className={selectCls}>
                  <option value="all">Dowolny</option>
                  <option value="with">Ze stanem</option>
                  <option value="without">Bez stanu</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Katalog</span>
                <select value={catalogFilter} onChange={(e) => setCatalogFilter(e.target.value as CatalogFilter)} className={selectCls}>
                  <option value="all">Wszystkie</option>
                  <option value="accessories">Akcesoria</option>
                  <option value="shop">Sklep</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Sortowanie</span>
                <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className={selectCls}>
                  {SORTS.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Na stronie</span>
                <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} className={selectCls}>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={200}>200</option>
                </select>
              </label>
            </div>
          </section>

          <section className="surface-panel space-y-3 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
              Zaznaczanie · {selected.size}
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={togglePage} className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800">
                {allPageSelected ? 'Odznacz stronę' : `Zaznacz stronę (${pageRows.length})`}
              </button>
              <button type="button" onClick={toggleAllFiltered} className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800">
                {allFilteredSelected ? 'Odznacz wszystko' : `Zaznacz wszystkie (${filteredRows.length})`}
              </button>
              {selected.size > 0 && (
                <button type="button" onClick={() => setSelected(new Set())} className="rounded-xl px-2 py-1.5 text-xs font-semibold text-slate-600 hover:underline dark:text-slate-400">
                  Wyczyść
                </button>
              )}
            </div>
          </section>

          {onHideProducts && (
            <section className="surface-panel space-y-3 p-4">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                <EyeOff className="h-3.5 w-3.5" />
                Ukryj zaznaczone
              </p>
              <div className="flex flex-wrap gap-1.5">
                {HIDE_REASON_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setHideReason(preset)}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
                      hideReason === preset
                        ? 'border-rose-500 bg-rose-50 text-rose-900 dark:bg-rose-500/15 dark:text-rose-200'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
              <input
                value={hideReason}
                onChange={(e) => setHideReason(e.target.value)}
                placeholder="Własny opis powodu ukrycia"
                className="input-field"
              />
              <button
                type="button"
                disabled={selected.size === 0 || !hideReason.trim() || hiding}
                onClick={() => void hideSelected()}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {hiding ? <Loader2 className="h-4 w-4 animate-spin" /> : <EyeOff className="h-4 w-4" />}
                Ukryj zaznaczone ({selected.size})
              </button>
            </section>
          )}

          {onApplyCategory && (kindCounts.get('category') ?? 0) > 0 && (
            <section className="surface-panel space-y-3 p-4">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                <Tag className="h-3.5 w-3.5" />
                Kategorie
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Zastosuje proponowaną kategorię do zaznaczonych pozycji, które ją mają ({selectedCategoryRows.length}).
              </p>
              <button
                type="button"
                disabled={selectedCategoryRows.length === 0 || bulkProgress !== null}
                onClick={() => void applySelected()}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {bulkProgress ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Zapisuję {bulkProgress.done}/{bulkProgress.total}
                  </>
                ) : (
                  <>
                    <Tag className="h-4 w-4" />
                    Zastosuj kategorie ({selectedCategoryRows.length})
                  </>
                )}
              </button>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

function Pager({
  page,
  pageCount,
  total,
  pageSize,
  onPage,
  allPageSelected,
  onTogglePage,
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  onPage: (n: number) => void;
  allPageSelected: boolean;
  onTogglePage: () => void;
}) {
  const from = total === 0 ? 0 : page * pageSize + 1;
  const to = Math.min(total, (page + 1) * pageSize);
  const btn =
    'inline-flex h-8 items-center rounded-lg border border-slate-300 bg-white px-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800';
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-950/30">
      <button
        type="button"
        onClick={onTogglePage}
        className="flex items-center gap-1.5 text-sm font-semibold text-slate-800 dark:text-slate-100"
      >
        {allPageSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
        Strona
      </button>
      <span className="text-sm tabular-nums text-slate-700 dark:text-slate-300">
        {from.toLocaleString('pl-PL')}–{to.toLocaleString('pl-PL')} z {total.toLocaleString('pl-PL')}
      </span>
      <div className="flex items-center gap-1.5">
        <button type="button" className={btn} disabled={page === 0} onClick={() => onPage(0)} aria-label="Pierwsza">
          <ChevronsLeft className="h-4 w-4" />
        </button>
        <button type="button" className={btn} disabled={page === 0} onClick={() => onPage(page - 1)} aria-label="Poprzednia">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="px-1 text-sm tabular-nums text-slate-700 dark:text-slate-300">
          {page + 1} / {pageCount}
        </span>
        <button type="button" className={btn} disabled={page >= pageCount - 1} onClick={() => onPage(page + 1)} aria-label="Następna">
          <ChevronRight className="h-4 w-4" />
        </button>
        <button type="button" className={btn} disabled={page >= pageCount - 1} onClick={() => onPage(pageCount - 1)} aria-label="Ostatnia">
          <ChevronsRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="surface-panel p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-slate-950 dark:text-slate-50">
        {value.toLocaleString('pl-PL')}
      </p>
    </div>
  );
}

function hasCategoryDecision(product: Product): boolean {
  return productNeedsCategoryDecision(product) && getProductDisplayCategory(product) !== 'Do decyzji';
}

function DecisionFilterButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
        active
          ? 'border-brand-500 bg-brand-50 text-brand-800 dark:bg-brand-500/15 dark:text-brand-200'
          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
      }`}
    >
      {label}
    </button>
  );
}

function IssueBadge({ issue }: { issue: DecisionIssue }) {
  const cls =
    issue.tone === 'danger'
      ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200'
      : issue.tone === 'warn'
        ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200'
        : 'border-sky-300 bg-sky-50 text-sky-950 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${cls}`}>
      {issue.tone !== 'info' ? <AlertTriangle className="h-3 w-3" /> : null}
      {issue.label}
    </span>
  );
}
