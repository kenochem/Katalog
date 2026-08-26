import { AlertTriangle, CheckCircle2, ChevronRight, EyeOff, ImageOff, Tag } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Product } from '../types';
import { getProductImage } from '../lib/products';
import { assessProductKnowledge } from '../lib/productKnowledge';
import { effectiveManufacturer } from '../lib/waproManufacturers';
import { hasBaselinkerLink } from '../lib/baselinkerLink';
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

export function CatalogDecisionView({
  products,
  onOpenProduct,
  onApplyCategory,
  categoryBusyId,
  onOpenHidden,
}: {
  products: Product[];
  onOpenProduct: (product: Product) => void;
  onApplyCategory?: (product: Product, category: string) => void;
  categoryBusyId?: string | null;
  onOpenHidden?: () => void;
}) {
  const [filter, setFilter] = useState<'all' | 'category' | 'media' | 'data'>('all');
  const rows = useMemo(() => buildCatalogDecisionRows(products), [products]);
  const hard = rows.filter((row) => row.score >= 6).length;
  const imageMissing = rows.filter((row) => row.issues.some((i) => i.label === 'brak zdjęcia')).length;
  const genericCategory = rows.filter((row) =>
    row.issues.some((i) => i.label.startsWith('ogólna kategoria') || i.label.startsWith('producent jako kategoria')),
  ).length;
  const categoryRows = rows.filter((row) => hasCategoryDecision(row.product));
  const visibleRows = rows.filter((row) => {
    if (filter === 'category') return hasCategoryDecision(row.product);
    if (filter === 'media') return row.issues.some((i) => i.label === 'brak zdjęcia');
    if (filter === 'data') return row.issues.some((i) => !i.label.includes('kategoria') && i.label !== 'brak zdjęcia');
    return true;
  });

  return (
    <div className="catalog-readable-light mx-auto max-w-6xl space-y-4 pb-10">
      <section className="surface-panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-300">
              Porządkowanie katalogu
            </p>
            <h2 className="mt-1 text-xl font-bold text-slate-950 dark:text-slate-50">
              Decyzje i trudne przypadki
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-700 dark:text-slate-400">
              Lista produktów, które wymagają ręcznej decyzji: kategoria, zdjęcie, EAN,
              producent, opis, cena albo powiązanie źródeł danych.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
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
            <span className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
              {rows.length.toLocaleString('pl-PL')} do sprawdzenia
            </span>
          </div>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-4">
        <Metric label="Ciężkie przypadki" value={hard} />
        <Metric label="Kategorie" value={categoryRows.length} />
        <Metric label="Bez zdjęcia" value={imageMissing} />
        <Metric label="Ogólna kategoria" value={genericCategory} />
      </div>

      <div className="flex flex-wrap gap-2">
        <DecisionFilterButton active={filter === 'all'} onClick={() => setFilter('all')} label="Wszystkie" />
        <DecisionFilterButton active={filter === 'category'} onClick={() => setFilter('category')} label={`Kategorie (${categoryRows.length})`} />
        <DecisionFilterButton active={filter === 'media'} onClick={() => setFilter('media')} label={`Zdjęcia (${imageMissing})`} />
        <DecisionFilterButton active={filter === 'data'} onClick={() => setFilter('data')} label="Dane i opis" />
      </div>

      {visibleRows.length === 0 ? (
        <div className="surface-panel flex items-center gap-3 p-5">
          <CheckCircle2 className="h-6 w-6 text-emerald-500" />
          <div>
            <p className="font-semibold text-slate-950 dark:text-slate-50">Brak pilnych decyzji</p>
            <p className="text-sm text-slate-700 dark:text-slate-400">
              Ten filtr nie ma obecnie pozycji do pracy.
            </p>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950/30 dark:shadow-none">
          <div className="grid grid-cols-[4.5rem_1fr_auto] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-400">
            <span>Foto</span>
            <span>Produkt</span>
            <span>Akcja</span>
          </div>
          <ul className="divide-y divide-slate-200 dark:divide-slate-800">
            {visibleRows.slice(0, 220).map((row) => {
              const image = getProductImage(row.product);
              const sourceCategory = getProductSourceCategory(row.product);
              const targetCategory = getProductDisplayCategory(row.product);
              const canApply = onApplyCategory && hasCategoryDecision(row.product);
              const busy = categoryBusyId === row.product.id;
              return (
                <li
                  key={row.product.id}
                  className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-3 px-4 py-3 transition hover:bg-slate-50 dark:hover:bg-slate-900/60"
                >
                  <button
                    type="button"
                    onClick={() => onOpenProduct(row.product)}
                    className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900"
                  >
                    {image ? (
                      <img src={image} alt="" className="h-full w-full object-contain p-1" />
                    ) : (
                      <ImageOff className="h-6 w-6 text-slate-500" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenProduct(row.product)}
                    className="min-w-0 text-left"
                  >
                      <span className="block truncate font-semibold text-slate-950 dark:text-slate-50">
                        {row.product.displayName}
                      </span>
                      <span className="mt-0.5 block font-mono text-xs text-slate-600 dark:text-slate-400">
                        {row.product.sku} · {getProductDisplayCategory(row.product)} · {inferProductTypeLabel(row.product)}
                      </span>
                      {hasCategoryDecision(row.product) && (
                        <span className="mt-1 block text-xs text-slate-700 dark:text-slate-300">
                          Kategoria: {sourceCategory} → <strong>{targetCategory}</strong>
                          {row.product.meta?.categoryAssignmentConfidence != null
                            ? ` · ${row.product.meta.categoryAssignmentConfidence}%`
                            : ''}
                        </span>
                      )}
                      <span className="mt-2 flex flex-wrap gap-1.5">
                        {row.issues.slice(0, 6).map((issue) => (
                          <IssueBadge key={issue.label} issue={issue} />
                        ))}
                      </span>
                  </button>
                  <span className="flex flex-col items-end gap-2">
                    {canApply && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onApplyCategory?.(row.product, targetCategory)}
                        className="inline-flex items-center rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-500 disabled:cursor-wait disabled:opacity-60"
                      >
                        <Tag className="mr-1.5 h-4 w-4" />
                        {busy ? 'Zapisuję' : 'Ustaw kategorię'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onOpenProduct(row.product)}
                      className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 dark:text-brand-300"
                    >
                      Otwórz
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
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
