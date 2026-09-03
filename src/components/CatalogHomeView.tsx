import { useMemo, type ReactNode } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Boxes,
  CheckCircle2,
  ExternalLink,
  ImageOff,
  Package,
  PackageX,
  ScanBarcode,
  Sparkles,
  Star,
  Store,
  TrendingDown,
} from 'lucide-react';
import type { CatalogType } from '../types';
import { computeCatalogStats } from '../lib/catalogExport';
import { ContextHelp } from './ContextHelp';

export type CatalogHomeQuickAction = {
  id: string;
  label: string;
  icon?: ReactNode;
  hint?: string;
  count?: number;
  onClick: () => void;
};

export interface CatalogHomeViewProps {
  allProducts: { catalog?: string }[];
  missingImagesCount: number;
  decisionCount: number;
  canSyncStock: boolean;
  quickActions?: CatalogHomeQuickAction[];
  onOpenCatalog: (filter: CatalogType | 'all') => void;
  onOpenMissingImages?: () => void;
  onOpenScanner?: () => void;
}

type CatalogEntry = {
  id: CatalogType | 'all';
  label: string;
  description: string;
  icon: ReactNode;
  primary?: boolean;
};

export function CatalogHomeView({
  allProducts,
  missingImagesCount,
  decisionCount,
  canSyncStock,
  quickActions = [],
  onOpenCatalog,
  onOpenMissingImages,
  onOpenScanner,
}: CatalogHomeViewProps) {
  const stats = useMemo(
    () => computeCatalogStats(allProducts as Parameters<typeof computeCatalogStats>[0]),
    [allProducts],
  );
  const lowStock = stats.lowStock;

  const catalogCounts = useMemo(() => {
    let accessories = 0;
    let shop = 0;
    for (const p of allProducts) {
      if (p.catalog === 'accessories') accessories += 1;
      else if (p.catalog === 'shop') shop += 1;
    }
    return { accessories, shop, all: allProducts.length };
  }, [allProducts]);

  const catalogEntries: CatalogEntry[] = [
    {
      id: 'all',
      label: 'Cały katalog',
      description: `${catalogCounts.all.toLocaleString('pl-PL')} pozycji — stany, ceny, filtry`,
      icon: <Boxes className="h-6 w-6" />,
      primary: true,
    },
    {
      id: 'accessories',
      label: 'Akcesoria',
      description: `${catalogCounts.accessories.toLocaleString('pl-PL')} pozycji myjni i chemii`,
      icon: <Package className="h-6 w-6" />,
    },
    {
      id: 'shop',
      label: 'Produkty sklepu',
      description: `${catalogCounts.shop.toLocaleString('pl-PL')} pozycji ze sklepu Kenochem`,
      icon: <Store className="h-6 w-6" />,
    },
  ];

  return (
    <div className="catalog-home-view mx-auto max-w-5xl space-y-8 pb-12 pt-2">
      <section className="catalog-home-hero rounded-3xl px-5 py-7 sm:px-8 sm:py-9">
        <div className="space-y-6">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600 dark:text-brand-300">
              Kenochem Katalog
            </p>
            <h1 className="mt-1 inline-flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
              Przejdź do katalogu
              <ContextHelp id="catalog" side="left" />
            </h1>
            <p className="catalog-home-muted mt-2 text-sm leading-relaxed sm:text-[15px]">
              Wybierz część asortymentu — stany z WAPRO, zdjęcia, filtry i wyszukiwarka są w widoku
              katalogu (skrót{' '}
              <kbd className="catalog-home-kbd rounded px-1.5 py-0.5 text-[10px] font-semibold">
                Ctrl+K
              </kbd>{' '}
              po wejściu).
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {catalogEntries.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => onOpenCatalog(entry.id)}
                className={`catalog-home-entry group flex min-h-[8.5rem] flex-col justify-between rounded-2xl p-4 text-left transition hover:-translate-y-0.5 ${
                  entry.primary ? 'catalog-home-entry--primary' : ''
                }`}
              >
                <span className="catalog-home-entry-icon flex h-11 w-11 items-center justify-center rounded-xl">
                  {entry.icon}
                </span>
                <span>
                  <span className="flex items-center gap-1.5 text-base font-semibold">
                    {entry.label}
                    <ArrowRight className="h-4 w-4 opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
                  </span>
                  <span className="catalog-home-muted mt-1 block text-xs leading-relaxed">
                    {entry.description}
                  </span>
                </span>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => onOpenCatalog('all')}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-500"
            >
              Otwórz pełny katalog
              <ArrowRight className="h-4 w-4" />
            </button>
            {onOpenScanner && (
              <button
                type="button"
                onClick={onOpenScanner}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-800 shadow-sm transition hover:border-brand-400 hover:text-brand-700 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:border-brand-500/35"
              >
                <ScanBarcode className="h-5 w-5" />
                Skanuj EAN
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 divide-x divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900/40 sm:grid-cols-4 sm:divide-y-0">
        <StatCell label="Pozycji" value={stats.total} icon={<Boxes className="h-4 w-4" />} />
        <StatCell
          label="Na stanie"
          value={stats.inStock}
          tone="ok"
          icon={<CheckCircle2 className="h-4 w-4" />}
        />
        <StatCell
          label="Brak na stanie"
          value={stats.outOfStock}
          tone="warn"
          icon={<PackageX className="h-4 w-4" />}
        />
        <StatCell
          label="Niski stan ≤5"
          value={lowStock}
          tone="amber"
          icon={<TrendingDown className="h-4 w-4" />}
        />
      </section>

      {quickActions.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-medium text-slate-800 dark:text-slate-300">Skróty</h2>
          <div className="flex flex-wrap gap-2">
            {quickActions.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={a.onClick}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm transition hover:border-brand-400 hover:bg-brand-50 dark:border-slate-700/90 dark:bg-slate-900/50 dark:text-slate-200 dark:hover:border-brand-500/35 dark:hover:bg-slate-800/80"
                title={a.hint}
              >
                {a.icon ? (
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700 dark:bg-slate-800/90 dark:text-brand-300">
                    {a.icon}
                  </span>
                ) : null}
                <span>{a.label}</span>
                {a.count !== undefined && a.count > 0 && (
                  <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] tabular-nums text-slate-700 dark:bg-slate-950/80 dark:text-slate-400">
                    {a.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/35">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Porządkowanie katalogu
            </p>
            <h2 className="mt-0.5 text-base font-semibold text-slate-950 dark:text-slate-100">
              Najważniejsze zadania
            </h2>
          </div>
          <button
            type="button"
            onClick={() => onOpenCatalog('all')}
            className="hidden rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:border-brand-400 hover:text-brand-700 dark:border-slate-700 dark:text-slate-300 dark:hover:border-brand-500/40 dark:hover:text-brand-200 sm:inline-flex"
          >
            Otwórz listę
          </button>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          <TaskRow
            icon={<AlertTriangle className="h-4 w-4" />}
            label="Decyzje"
            description="Kategorie, brakujące źródła danych i trudne przypadki do ręcznego sprawdzenia."
            value={decisionCount}
            total={stats.total}
            tone="warn"
            actionLabel="Przejdź do decyzji"
            onClick={quickActions.find((a) => a.id === 'catalog-decisions')?.onClick}
          />
          <TaskRow
            icon={<ImageOff className="h-4 w-4" />}
            label="Bez zdjęć"
            description="Produkty wymagające zdjęcia lub podmiany grafiki."
            value={missingImagesCount}
            total={stats.total}
            tone="amber"
            actionLabel="Uzupełnij zdjęcia"
            onClick={onOpenMissingImages}
          />
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-5 dark:border-slate-800/80 dark:bg-slate-900/30">
          <h2 className="text-sm font-medium text-slate-900 dark:text-slate-300">W skrócie</h2>
          <ul className="mt-3 space-y-1.5 text-sm text-slate-600 dark:text-slate-400">
            <li className="flex items-start gap-3 rounded-xl px-2 py-1.5 transition hover:bg-black/[0.03] dark:hover:bg-white/[0.05]">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-500 dark:bg-amber-500/10 dark:text-amber-300">
                <Star className="h-3.5 w-3.5" />
              </span>
              <span className="pt-1">
                <strong className="font-medium text-slate-900 dark:text-slate-300">Ulubione</strong> — szybki
                dostęp do często używanych indeksów (zakładka w menu).
              </span>
            </li>
            <li className="flex items-start gap-3 rounded-xl px-2 py-1.5 transition hover:bg-black/[0.03] dark:hover:bg-white/[0.05]">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                <Boxes className="h-3.5 w-3.5" />
              </span>
              <span className="pt-1">
                Stany pochodzą z <strong className="font-medium text-slate-900 dark:text-slate-300">WAPRO</strong>
                {canSyncStock ? ' — sync w prawym górnym rogu po zalogowaniu.' : '.'}
              </span>
            </li>
            {missingImagesCount > 0 && onOpenMissingImages && (
              <li className="flex items-start gap-3 rounded-xl px-2 py-1.5 transition hover:bg-black/[0.03] dark:hover:bg-white/[0.05]">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-[10px] font-bold text-amber-600 dark:bg-amber-500/15 dark:text-amber-300">
                  {missingImagesCount > 99 ? '99+' : missingImagesCount}
                </span>
                <span className="pt-1">
                  <button
                    type="button"
                    onClick={onOpenMissingImages}
                    className="font-medium text-amber-700 underline decoration-amber-500/40 underline-offset-2 hover:text-amber-900 dark:text-amber-200/90 dark:hover:text-amber-100"
                  >
                    {missingImagesCount} pozycji bez zdjęcia
                  </button>
                  {' — warto uzupełnić w widoku „Bez zdjęć”.'
                  }
                </span>
              </li>
            )}
            {canSyncStock && (
              <li className="flex items-start gap-3 rounded-xl px-2 py-1.5 transition hover:bg-black/[0.03] dark:hover:bg-white/[0.05]">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
                  <Sparkles className="h-3.5 w-3.5" />
                </span>
                <span className="pt-1">
                  Nowy indeks w Mag? Dodaj produkt ręcznie, potem{' '}
                  <strong className="font-medium text-slate-900 dark:text-slate-300">Sync WAPRO</strong>, aby
                  pobrać stan.
                </span>
              </li>
            )}
          </ul>
        </div>

        <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-5 dark:border-slate-800/70 dark:bg-slate-900/25">
          <div className="flex gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-600 dark:text-violet-300">
              <BookOpen className="h-5 w-5" />
            </span>
            <div>
              <h2 className="inline-flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-slate-200">
                Biblioteka wiedzy (AI)
                <ContextHelp id="guide" side="left" />
              </h2>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-600 dark:text-slate-500">
                Statyczny indeks produktów ze specyfikacją — do skrapowania przez boty. Uzupełniaj opisy i
                parametry w kartach produktów, potem odśwież export.
              </p>
            </div>
          </div>
          <a
            href="/data/knowledge/manifest.json"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex w-fit shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:border-violet-400 hover:text-violet-700 dark:border-slate-700 dark:text-slate-300 dark:hover:border-violet-500/40 dark:hover:text-violet-200"
          >
            manifest.json
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </section>
    </div>
  );
}

function StatCell({
  label,
  value,
  tone = 'default',
  icon,
}: {
  label: string;
  value: number;
  tone?: 'default' | 'ok' | 'warn' | 'amber';
  icon?: ReactNode;
}) {
  const valueClass =
    tone === 'ok'
      ? 'text-emerald-700 dark:text-emerald-400/95'
      : tone === 'warn'
        ? 'text-rose-700 dark:text-rose-400/90'
        : tone === 'amber'
          ? 'text-amber-700 dark:text-amber-400/90'
          : 'text-slate-950 dark:text-slate-100';
  const iconClass =
    tone === 'ok'
      ? 'text-emerald-500 dark:text-emerald-300'
      : tone === 'warn'
        ? 'text-rose-500 dark:text-rose-300'
        : tone === 'amber'
          ? 'text-amber-500 dark:text-amber-300'
          : 'text-slate-400 dark:text-slate-500';
  return (
    <div className="px-4 py-3.5 sm:px-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] uppercase tracking-wide text-slate-500 sm:text-[11px]">{label}</p>
        {icon && <span className={iconClass}>{icon}</span>}
      </div>
      <p className={`mt-1 text-xl font-semibold tabular-nums sm:text-2xl ${valueClass}`}>
        {value.toLocaleString('pl-PL')}
      </p>
    </div>
  );
}

function TaskRow({
  icon,
  label,
  description,
  value,
  total,
  tone,
  actionLabel,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  description: string;
  value: number;
  total: number;
  tone: 'warn' | 'amber';
  actionLabel: string;
  onClick?: () => void;
}) {
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  const done = Math.max(0, total - value);
  const barClass = tone === 'warn' ? 'bg-rose-400 dark:bg-rose-500' : 'bg-amber-400 dark:bg-amber-500';
  const chipClass =
    tone === 'warn'
      ? 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300'
      : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300';

  return (
    <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${chipClass}`}>
          {icon}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <h3 className="font-semibold text-slate-950 dark:text-slate-100">{label}</h3>
            <span className="text-xs tabular-nums text-slate-500">
              {value.toLocaleString('pl-PL')} do pracy · {done.toLocaleString('pl-PL')} OK
            </span>
          </div>
          <p className="mt-0.5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{description}</p>
          <div className="mt-2 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div className={`h-full rounded-full ${barClass}`} style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:border-brand-400 hover:text-brand-700 dark:border-slate-700 dark:text-slate-300 dark:hover:border-brand-500/40 dark:hover:text-brand-200 sm:self-center"
        >
          {actionLabel}
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}
