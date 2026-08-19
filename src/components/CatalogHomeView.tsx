import type { ReactNode } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Boxes,
  ExternalLink,
  ImageOff,
  LayoutGrid,
  ScanBarcode,
  Search,
  Sparkles,
  Star,
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
  onFocusSearch?: () => void;
  onOpenScanner?: () => void;
}

export function CatalogHomeView({
  allProducts,
  missingImagesCount,
  decisionCount,
  canSyncStock,
  quickActions = [],
  onOpenCatalog,
  onOpenMissingImages,
  onFocusSearch,
  onOpenScanner,
}: CatalogHomeViewProps) {
  const stats = computeCatalogStats(allProducts as Parameters<typeof computeCatalogStats>[0]);
  const lowStock = stats.lowStock;

  return (
    <div className="catalog-home-view mx-auto max-w-5xl space-y-10 pb-12 pt-2">
      <section className="text-center sm:text-left">
        <p className="text-xs font-medium uppercase tracking-wider text-brand-400/90">
          Kenochem Katalog
        </p>
        <h1 className="mt-1 inline-flex items-center justify-center gap-2 text-2xl font-semibold tracking-tight text-slate-950 dark:text-slate-100 sm:justify-start sm:text-3xl">
          Witaj w katalogu
          <ContextHelp id="catalog" side="left" />
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-400 sm:text-[15px]">
          Jedno miejsce na stany i ofertę: części do myjni, chemia i produkty sklepowe.
          Wpisz indeks WAPRO, zeskanuj EAN albo wejdź na pełną listę — filtry i kategorie są
          w katalogu.
        </p>
      </section>

      <button
        type="button"
        onClick={() => onOpenCatalog('all')}
        className="group flex w-full flex-col gap-3 rounded-2xl border border-brand-300 bg-gradient-to-br from-brand-50 via-white to-slate-50 p-5 text-left shadow-sm shadow-slate-200/70 transition hover:border-brand-400 dark:border-brand-500/40 dark:from-brand-500/20 dark:via-slate-900/90 dark:to-slate-950 dark:shadow-lg dark:shadow-brand-950/25 dark:hover:border-brand-400/55 sm:flex-row sm:items-center sm:justify-between sm:p-7"
      >
        <div className="flex items-start gap-4">
          <span className="rounded-xl bg-brand-100 p-3 text-brand-700 dark:bg-brand-500/25 dark:text-brand-200">
            <LayoutGrid className="h-7 w-7" />
          </span>
          <div>
            <span className="text-lg font-semibold text-slate-950 dark:text-slate-50 sm:text-xl">
              Wejdź do katalogu
            </span>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Pełna lista produktów z wyszukiwaniem, filtrami, cenami, zdjęciami i stanami.
            </p>
          </div>
        </div>
        <span className="inline-flex items-center justify-center gap-2 self-start rounded-xl bg-brand-600 px-5 py-3 text-sm font-medium text-white group-hover:bg-brand-500 sm:self-center">
          {stats.total.toLocaleString('pl-PL')} SKU
          <ArrowRight className="h-4 w-4" />
        </span>
      </button>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        <StatCard label="Pozycji" value={stats.total} />
        <StatCard label="Na stanie" value={stats.inStock} tone="ok" />
        <StatCard label="Brak na stanie" value={stats.outOfStock} tone="warn" />
        <StatCard label="Niski stan ≤5" value={lowStock} tone="amber" />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
        <button
          type="button"
          onClick={onFocusSearch}
          className="flex flex-1 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-left shadow-sm transition hover:border-brand-400 dark:border-slate-700/80 dark:bg-slate-900/60 dark:hover:border-brand-500/40"
        >
          <Search className="h-5 w-5 shrink-0 text-brand-400" />
          <span className="text-sm text-slate-600 dark:text-slate-400">Szukaj SKU, EAN lub nazwy…</span>
        </button>
        {onOpenScanner && (
          <button
            type="button"
            onClick={onOpenScanner}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-brand-300 bg-brand-50 px-5 py-3.5 text-sm font-medium text-brand-800 hover:bg-brand-100 dark:border-brand-500/35 dark:bg-brand-500/10 dark:text-brand-200 dark:hover:bg-brand-500/20"
          >
            <ScanBarcode className="h-5 w-5" />
            Skanuj EAN
          </button>
        )}
      </div>

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

      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-500">
              Porządkowanie katalogu
            </p>
            <h2 className="mt-1 text-lg font-semibold text-slate-950 dark:text-slate-100">
              Najważniejsze zadania
            </h2>
          </div>
          <button
            type="button"
            onClick={() => onOpenCatalog('all')}
            className="hidden rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:border-brand-400 hover:text-brand-700 dark:border-slate-700 dark:bg-transparent dark:text-slate-300 dark:hover:border-brand-500/40 dark:hover:text-brand-200 sm:inline-flex"
          >
            Otwórz listę
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <DonutStatusCard
            icon={<AlertTriangle className="h-5 w-5" />}
            label="Decyzje"
            description="Kategorie, brakujące źródła danych i trudne przypadki do ręcznego sprawdzenia."
            value={decisionCount}
            total={stats.total}
            tone="warn"
            actionLabel="Przejdź do decyzji"
            onClick={quickActions.find((a) => a.id === 'catalog-decisions')?.onClick}
          />
          <DonutStatusCard
            icon={<ImageOff className="h-5 w-5" />}
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

      <section className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-5 dark:border-slate-800/80 dark:bg-slate-900/30">
        <h2 className="text-sm font-medium text-slate-900 dark:text-slate-300">W skrócie</h2>
        <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-400">
          <li className="flex gap-2">
            <Star className="mt-0.5 h-4 w-4 shrink-0 text-amber-400/80" />
            <span>
              <strong className="font-medium text-slate-900 dark:text-slate-300">Ulubione</strong> — szybki dostęp
              do często używanych indeksów (zakładka w menu).
            </span>
          </li>
          <li className="flex gap-2">
            <Boxes className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
            <span>
              Stany pochodzą z <strong className="font-medium text-slate-900 dark:text-slate-300">WAPRO</strong>
              {canSyncStock ? ' — sync w prawym górnym rogu po zalogowaniu.' : '.'}
            </span>
          </li>
          {missingImagesCount > 0 && onOpenMissingImages && (
            <li className="flex gap-2">
              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded bg-amber-500/20 text-[10px] font-bold text-amber-300">
                {missingImagesCount > 99 ? '99+' : missingImagesCount}
              </span>
              <span>
                <button
                  type="button"
                  onClick={onOpenMissingImages}
                  className="font-medium text-amber-700 underline decoration-amber-500/40 underline-offset-2 hover:text-amber-900 dark:text-amber-200/90 dark:hover:text-amber-100"
                >
                  {missingImagesCount} pozycji bez zdjęcia
                </button>
                {' — warto uzupełnić w widoku „Bez zdjęć”.'}
              </span>
            </li>
          )}
          {canSyncStock && (
            <li className="flex gap-2">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand-400/80" />
              <span>
                Nowy indeks w Mag? Dodaj produkt ręcznie, potem{' '}
                <strong className="font-medium text-slate-900 dark:text-slate-300">Sync WAPRO</strong>, aby pobrać
                stan.
              </span>
            </li>
          )}
        </ul>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm sm:flex sm:items-center sm:justify-between sm:gap-4 dark:border-slate-800/70 dark:bg-slate-900/25">
        <div className="flex gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-300">
            <BookOpen className="h-5 w-5" />
          </span>
          <div>
            <h2 className="inline-flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-slate-200">
              Biblioteka wiedzy (AI)
              <ContextHelp id="guide" side="left" />
            </h2>
            <p className="mt-0.5 max-w-lg text-xs leading-relaxed text-slate-600 dark:text-slate-500">
              Statyczny indeks produktów ze specyfikacją — do skrapowania przez boty. Uzupełniaj
              opisy i parametry w kartach produktów, potem odśwież export.
            </p>
          </div>
        </div>
        <a
          href="/data/knowledge/manifest.json"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:border-violet-400 hover:text-violet-700 dark:border-slate-700 dark:text-slate-300 dark:hover:border-violet-500/40 dark:hover:text-violet-200 sm:mt-0"
        >
          manifest.json
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: number;
  tone?: 'default' | 'ok' | 'warn' | 'amber';
}) {
  const valueClass =
    tone === 'ok'
      ? 'text-emerald-700 dark:text-emerald-400/95'
      : tone === 'warn'
        ? 'text-rose-700 dark:text-rose-400/90'
        : tone === 'amber'
          ? 'text-amber-700 dark:text-amber-400/90'
          : 'text-slate-950 dark:text-slate-100';
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm sm:px-4 dark:border-slate-800/80 dark:bg-slate-900/40">
      <p className="text-[10px] uppercase tracking-wide text-slate-500 sm:text-[11px]">
        {label}
      </p>
      <p className={`mt-1 text-xl font-semibold tabular-nums sm:text-2xl ${valueClass}`}>
        {value.toLocaleString('pl-PL')}
      </p>
    </div>
  );
}

function DonutStatusCard({
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
  const color = tone === 'warn' ? '#fb7185' : '#f59e0b';
  const bg = `conic-gradient(${color} ${pct}%, rgba(51,65,85,.55) 0)`;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/35">
      <div className="flex items-center gap-4">
        <div
          className="relative flex h-24 w-24 shrink-0 items-center justify-center rounded-full"
          style={{ background: bg }}
          aria-label={`${label}: ${value} z ${total}`}
        >
          <div className="absolute inset-3 rounded-full bg-white dark:bg-slate-950" />
          <div className="relative text-center">
            <p className="text-xl font-semibold tabular-nums text-slate-950 dark:text-slate-100">
              {pct}%
            </p>
            <p className="text-[10px] uppercase tracking-wide text-slate-600 dark:text-slate-500">
              wymaga
            </p>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={`rounded-lg p-2 ${tone === 'warn' ? 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'}`}>
              {icon}
            </span>
            <h3 className="font-semibold text-slate-950 dark:text-slate-100">{label}</h3>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{description}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="rounded-lg bg-slate-100 px-2 py-1 text-slate-800 dark:bg-slate-950/70 dark:text-slate-300">
              {value.toLocaleString('pl-PL')} do pracy
            </span>
            <span className="rounded-lg bg-emerald-50 px-2 py-1 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">
              {done.toLocaleString('pl-PL')} OK
            </span>
          </div>
          {onClick ? (
            <button
              type="button"
              onClick={onClick}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:border-brand-400 hover:text-brand-700 dark:border-slate-700 dark:text-slate-300 dark:hover:border-brand-500/40 dark:hover:text-brand-200"
            >
              {actionLabel}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
