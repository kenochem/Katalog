import { AlertTriangle, CheckCircle2, ChevronRight, ImageOff } from 'lucide-react';
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

function describeIssues(product: Product): DecisionIssue[] {
  const issues: DecisionIssue[] = [];
  const knowledge = assessProductKnowledge(product);
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
  if (knowledge.score < 65) {
    issues.push({ label: `niska kompletność: ${knowledge.score}%`, tone: 'warn' });
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
      const issues = describeIssues(product);
      const knowledgeScore = assessProductKnowledge(product).score;
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
}: {
  products: Product[];
  onOpenProduct: (product: Product) => void;
}) {
  const rows = buildCatalogDecisionRows(products);
  const hard = rows.filter((row) => row.score >= 6).length;
  const imageMissing = rows.filter((row) => row.issues.some((i) => i.label === 'brak zdjęcia')).length;
  const genericCategory = rows.filter((row) =>
    row.issues.some((i) => i.label.startsWith('ogólna kategoria') || i.label.startsWith('producent jako kategoria')),
  ).length;

  return (
    <div className="mx-auto max-w-6xl space-y-4 pb-10">
      <section className="surface-panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-300">
              Porządkowanie katalogu
            </p>
            <h2 className="mt-1 text-xl font-bold text-slate-50 dark:text-slate-50">
              Decyzje i trudne przypadki
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-300 dark:text-slate-400">
              Lista produktów, które wymagają ręcznej decyzji: kategoria, zdjęcie, EAN,
              producent, opis, cena albo powiązanie źródeł danych.
            </p>
          </div>
          <span className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            {rows.length.toLocaleString('pl-PL')} do sprawdzenia
          </span>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="Ciężkie przypadki" value={hard} />
        <Metric label="Bez zdjęcia" value={imageMissing} />
        <Metric label="Ogólna kategoria" value={genericCategory} />
      </div>

      {rows.length === 0 ? (
        <div className="surface-panel flex items-center gap-3 p-5">
          <CheckCircle2 className="h-6 w-6 text-emerald-500" />
          <div>
            <p className="font-semibold text-slate-50 dark:text-slate-50">Brak pilnych decyzji</p>
            <p className="text-sm text-slate-300 dark:text-slate-400">
              Widoczny katalog wygląda spójnie według obecnych reguł.
            </p>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-white dark:bg-slate-950/30">
          <div className="grid grid-cols-[4.5rem_1fr_auto] gap-3 border-b border-slate-800 bg-slate-900/80 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <span>Foto</span>
            <span>Produkt</span>
            <span>Akcja</span>
          </div>
          <ul className="divide-y divide-slate-800">
            {rows.slice(0, 220).map((row) => {
              const image = getProductImage(row.product);
              return (
                <li key={row.product.id}>
                  <button
                    type="button"
                    onClick={() => onOpenProduct(row.product)}
                    className="grid w-full grid-cols-[4.5rem_1fr_auto] items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-950/5 dark:hover:bg-slate-900/60"
                  >
                    <span className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl border border-slate-700 bg-slate-950/5 dark:bg-slate-900">
                      {image ? (
                        <img src={image} alt="" className="h-full w-full object-contain p-1" />
                      ) : (
                        <ImageOff className="h-6 w-6 text-slate-500" />
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-slate-50 dark:text-slate-50">
                        {row.product.displayName}
                      </span>
                      <span className="mt-0.5 block font-mono text-xs text-slate-500">
                        {row.product.sku} · {getProductDisplayCategory(row.product)} · {inferProductTypeLabel(row.product)}
                      </span>
                      <span className="mt-2 flex flex-wrap gap-1.5">
                        {row.issues.slice(0, 6).map((issue) => (
                          <IssueBadge key={issue.label} issue={issue} />
                        ))}
                      </span>
                    </span>
                    <span className="flex items-center gap-1 text-sm font-semibold text-brand-700 dark:text-brand-300">
                      Otwórz
                      <ChevronRight className="h-4 w-4" />
                    </span>
                  </button>
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
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-slate-50 dark:text-slate-50">
        {value.toLocaleString('pl-PL')}
      </p>
    </div>
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
