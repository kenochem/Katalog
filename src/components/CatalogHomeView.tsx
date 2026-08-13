import type { ReactNode } from 'react';
import {
  ArrowRight,
  BookOpen,
  Boxes,
  ExternalLink,
  LayoutGrid,
  Package,
  ScanBarcode,
  Search,
  Sparkles,
  Star,
  Wrench,
} from 'lucide-react';
import { CATALOG_LABELS, CATALOG_SUBTITLES, type CatalogType } from '../types';
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
  accessoriesCount: number;
  shopCount: number;
  allProducts: { catalog?: string }[];
  missingImagesCount: number;
  canSyncStock: boolean;
  quickActions?: CatalogHomeQuickAction[];
  onOpenCatalog: (filter: CatalogType | 'all') => void;
  onOpenMissingImages?: () => void;
  onFocusSearch?: () => void;
  onOpenScanner?: () => void;
}

export function CatalogHomeView({
  accessoriesCount,
  shopCount,
  allProducts,
  missingImagesCount,
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
    <div className="mx-auto max-w-5xl space-y-10 pb-12 pt-2">
      <section className="text-center sm:text-left">
        <p className="text-xs font-medium uppercase tracking-wider text-brand-400/90">
          Kenochem Katalog
        </p>
        <h1 className="mt-1 inline-flex items-center justify-center gap-2 text-2xl font-semibold tracking-tight text-slate-100 sm:justify-start sm:text-3xl">
          Witaj w katalogu
          <ContextHelp id="catalog" side="left" />
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400 sm:text-[15px]">
          Jedno miejsce na stany i ofertę: części do myjni, chemia i produkty sklepowe.
          Wpisz indeks WAPRO, zeskanuj EAN albo wejdź na pełną listę — filtry i kategorie są
          w katalogu.
        </p>
      </section>

      <button
        type="button"
        onClick={() => onOpenCatalog('all')}
        className="group flex w-full flex-col gap-3 rounded-2xl border border-brand-500/40 bg-gradient-to-br from-brand-500/20 via-slate-900/90 to-slate-950 p-5 text-left shadow-lg shadow-brand-950/25 transition hover:border-brand-400/55 sm:flex-row sm:items-center sm:justify-between sm:p-7"
      >
        <div className="flex items-start gap-4">
          <span className="rounded-xl bg-brand-500/25 p-3 text-brand-200">
            <LayoutGrid className="h-7 w-7" />
          </span>
          <div>
            <span className="text-lg font-semibold text-slate-50 sm:text-xl">
              Wejdź do katalogu
            </span>
            <p className="mt-1 text-sm text-slate-400">
              Pełna lista — {CATALOG_LABELS.accessories.toLowerCase()} i{' '}
              {CATALOG_LABELS.shop.toLowerCase()} razem, z wyszukiwaniem i filtrami
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
          className="flex flex-1 items-center gap-3 rounded-2xl border border-slate-700/80 bg-slate-900/60 px-4 py-3.5 text-left transition hover:border-brand-500/40"
        >
          <Search className="h-5 w-5 shrink-0 text-brand-400" />
          <span className="text-sm text-slate-400">Szukaj SKU, EAN lub nazwy…</span>
        </button>
        {onOpenScanner && (
          <button
            type="button"
            onClick={onOpenScanner}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-brand-500/35 bg-brand-500/10 px-5 py-3.5 text-sm font-medium text-brand-200 hover:bg-brand-500/20"
          >
            <ScanBarcode className="h-5 w-5" />
            Skanuj EAN
          </button>
        )}
      </div>

      {quickActions.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-medium text-slate-300">Skróty</h2>
          <div className="flex flex-wrap gap-2">
            {quickActions.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={a.onClick}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-700/90 bg-slate-900/50 px-3 py-2 text-sm text-slate-200 transition hover:border-brand-500/35 hover:bg-slate-800/80"
                title={a.hint}
              >
                {a.icon ? (
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-800/90 text-brand-300">
                    {a.icon}
                  </span>
                ) : null}
                <span>{a.label}</span>
                {a.count !== undefined && a.count > 0 && (
                  <span className="rounded-md bg-slate-950/80 px-1.5 py-0.5 text-[10px] tabular-nums text-slate-400">
                    {a.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </section>
      )}

      <div>
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500">
          Dodatkowo — tylko wybrany katalog
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <CatalogTile
            icon={<Wrench className="h-6 w-6" />}
            title={CATALOG_LABELS.accessories}
            subtitle={CATALOG_SUBTITLES.accessories}
            count={accessoriesCount}
            onClick={() => onOpenCatalog('accessories')}
          />
          <CatalogTile
            icon={<Package className="h-6 w-6" />}
            title={CATALOG_LABELS.shop}
            subtitle={CATALOG_SUBTITLES.shop}
            count={shopCount}
            onClick={() => onOpenCatalog('shop')}
          />
        </div>
      </div>

      <section className="rounded-2xl border border-slate-800/80 bg-slate-900/30 px-4 py-4 sm:px-5">
        <h2 className="text-sm font-medium text-slate-300">W skrócie</h2>
        <ul className="mt-3 space-y-2 text-sm text-slate-400">
          <li className="flex gap-2">
            <Star className="mt-0.5 h-4 w-4 shrink-0 text-amber-400/80" />
            <span>
              <strong className="font-medium text-slate-300">Ulubione</strong> — szybki dostęp
              do często używanych indeksów (zakładka w menu).
            </span>
          </li>
          <li className="flex gap-2">
            <Boxes className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
            <span>
              Stany pochodzą z <strong className="font-medium text-slate-300">WAPRO</strong>
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
                  className="font-medium text-amber-200/90 underline decoration-amber-500/40 underline-offset-2 hover:text-amber-100"
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
                <strong className="font-medium text-slate-300">Sync WAPRO</strong>, aby pobrać
                stan.
              </span>
            </li>
          )}
        </ul>
      </section>

      <section className="rounded-2xl border border-slate-800/70 bg-slate-900/25 px-4 py-4 sm:flex sm:items-center sm:justify-between sm:gap-4">
        <div className="flex gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-300">
            <BookOpen className="h-5 w-5" />
          </span>
          <div>
            <h2 className="inline-flex items-center gap-2 text-sm font-medium text-slate-200">
              Biblioteka wiedzy (AI)
              <ContextHelp id="guide" side="left" />
            </h2>
            <p className="mt-0.5 max-w-lg text-xs leading-relaxed text-slate-500">
              Statyczny indeks produktów ze specyfikacją — do skrapowania przez boty. Uzupełniaj
              opisy i parametry w kartach produktów, potem odśwież export.
            </p>
          </div>
        </div>
        <a
          href="/data/knowledge/manifest.json"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-xs font-medium text-slate-300 hover:border-violet-500/40 hover:text-violet-200 sm:mt-0"
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
      ? 'text-emerald-400/95'
      : tone === 'warn'
        ? 'text-rose-400/90'
        : tone === 'amber'
          ? 'text-amber-400/90'
          : 'text-slate-100';
  return (
    <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 px-3 py-3 sm:px-4">
      <p className="text-[10px] uppercase tracking-wide text-slate-500 sm:text-[11px]">
        {label}
      </p>
      <p className={`mt-1 text-xl font-semibold tabular-nums sm:text-2xl ${valueClass}`}>
        {value.toLocaleString('pl-PL')}
      </p>
    </div>
  );
}

function CatalogTile({
  icon,
  title,
  subtitle,
  count,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900/90 to-slate-950 p-5 text-left transition hover:border-brand-500/35 hover:shadow-lg hover:shadow-brand-950/20"
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <span className="rounded-xl bg-brand-500/15 p-2.5 text-brand-300">{icon}</span>
        <span className="rounded-lg bg-slate-800/80 px-2 py-0.5 text-xs tabular-nums text-slate-300">
          {count.toLocaleString('pl-PL')}
        </span>
      </div>
      <span className="text-lg font-semibold text-slate-100">{title}</span>
      <span className="mt-1 text-xs text-slate-500">{subtitle}</span>
      <span className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-brand-400 group-hover:text-brand-300">
        Otwórz
        <ArrowRight className="h-3.5 w-3.5" />
      </span>
    </button>
  );
}
