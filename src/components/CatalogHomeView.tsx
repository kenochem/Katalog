import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Boxes,
  CheckCircle2,
  Clock,
  ImageOff,
  Link2,
  PackageX,
  RefreshCw,
  ScanBarcode,
  Sparkles,
  TrendingDown,
} from 'lucide-react';
import type { Product } from '../types';
import { computeCatalogStats } from '../lib/catalogExport';
import { hasBaselinkerLink } from '../lib/baselinkerLink';
import { useBaselinkerLinksVersion } from '../lib/baselinkerLive';
import { supabase } from '../lib/supabase';
import { formatAgo } from '../suite/suiteData';
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
  allProducts: Product[];
  missingImagesCount: number;
  decisionCount: number;
  quickActions?: CatalogHomeQuickAction[];
  /** Wejście do katalogu (cały katalog). */
  onOpenCatalog: () => void;
  onOpenMissingImages?: () => void;
  onOpenScanner?: () => void;
  onOpenNews?: () => void;
  onOpenLibrary?: () => void;
  /** Katalog przefiltrowany do produktów spoza BaseLinkera. */
  onOpenNotInBaselinker?: () => void;
}

export function CatalogHomeView({
  allProducts,
  missingImagesCount,
  decisionCount,
  quickActions = [],
  onOpenCatalog,
  onOpenMissingImages,
  onOpenScanner,
  onOpenNews,
  onOpenLibrary,
  onOpenNotInBaselinker,
}: CatalogHomeViewProps) {
  const linksVersion = useBaselinkerLinksVersion();
  const stats = useMemo(() => computeCatalogStats(allProducts), [allProducts]);
  const lowStock = stats.lowStock;

  const baselinker = useMemo(() => {
    let linked = 0;
    let readyToAdd = 0;
    for (const p of allProducts) {
      if (p.isGroup) continue;
      if (hasBaselinkerLink(p)) {
        linked += 1;
      } else if (p.hasImage) {
        readyToAdd += 1;
      }
    }
    const total = allProducts.filter((p) => !p.isGroup).length;
    return { linked, notLinked: Math.max(0, total - linked), readyToAdd, total };
    // linksVersion: lista powiązań z BaseLinkerem odświeża się w tle
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allProducts, linksVersion]);
  const baselinkerPct = baselinker.total > 0 ? Math.round((baselinker.linked / baselinker.total) * 100) : 0;

  return (
    <div className="catalog-home-view mx-auto max-w-5xl space-y-6 pb-12 pt-2">
      <section className="catalog-home-hero rounded-3xl px-5 py-7 sm:px-8 sm:py-9">
        <div className="flex flex-col gap-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600 dark:text-brand-300">
              Kenochem Katalog
            </p>
            <h1 className="mt-1 inline-flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
              Witaj w katalogu
              <ContextHelp id="catalog" side="left" />
            </h1>
            <p className="catalog-home-muted mt-2 max-w-2xl text-sm leading-relaxed sm:text-[15px]">
              Stany i ceny z WAPRO, zdjęcia, filtry i wyszukiwarka w jednym miejscu (skrót{' '}
              <kbd className="catalog-home-kbd rounded px-1.5 py-0.5 text-[10px] font-semibold">Ctrl+K</kbd>{' '}
              po wejściu).
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
            <button
              type="button"
              onClick={onOpenCatalog}
              className="catalog-home-entry catalog-home-entry--primary group flex min-h-[6.5rem] flex-1 items-center gap-4 rounded-2xl p-5 text-left transition hover:-translate-y-0.5"
            >
              <span className="catalog-home-entry-icon flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl">
                <Boxes className="h-7 w-7" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-xl font-bold">
                  Przejdź do katalogu
                  <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" />
                </span>
                <span className="catalog-home-muted mt-1 block text-sm leading-relaxed">
                  {stats.total.toLocaleString('pl-PL')} pozycji — stany, ceny, kategorie i zdjęcia
                </span>
              </span>
            </button>
            {onOpenScanner && (
              <button
                type="button"
                onClick={onOpenScanner}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-6 py-4 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-brand-400 hover:text-brand-700 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:border-brand-500/35 sm:flex-col sm:gap-1.5"
              >
                <ScanBarcode className="h-6 w-6" />
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

      {/* BaseLinker — pokrycie */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/35">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300">
              <Link2 className="h-4 w-4" />
            </span>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">BaseLinker</p>
              <h2 className="mt-0.5 text-base font-semibold text-slate-950 dark:text-slate-100">
                Pokrycie produktów w BaseLinkerze
              </h2>
            </div>
          </div>
          {onOpenNotInBaselinker && baselinker.notLinked > 0 && (
            <button
              type="button"
              onClick={onOpenNotInBaselinker}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:border-brand-400 hover:text-brand-700 dark:border-slate-700 dark:text-slate-300 dark:hover:border-brand-500/40 dark:hover:text-brand-200"
            >
              Pokaż produkty spoza BaseLinkera
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="grid gap-4 px-5 py-4 sm:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <p className="flex items-baseline gap-2">
              <span className="text-3xl font-bold tabular-nums text-sky-600 dark:text-sky-300">
                {baselinker.linked.toLocaleString('pl-PL')}
              </span>
              <span className="text-sm text-slate-500">
                z {baselinker.total.toLocaleString('pl-PL')} produktów jest w BaseLinkerze ({baselinkerPct}%)
              </span>
            </p>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-sky-500"
                style={{ width: `${baselinkerPct}%` }}
              />
            </div>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Poza BaseLinkerem</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-amber-700 dark:text-amber-300">
              {baselinker.notLinked.toLocaleString('pl-PL')}
            </p>
            <p className="text-xs text-slate-500">oznaczone pomarańczowym „W”</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Gotowe do dodania</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
              {baselinker.readyToAdd.toLocaleString('pl-PL')}
            </p>
            <p className="text-xs text-slate-500">mają zdjęcie, a nie ma ich w BaseLinkerze</p>
          </div>
        </div>
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
        <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Porządkowanie katalogu
          </p>
          <h2 className="mt-0.5 text-base font-semibold text-slate-950 dark:text-slate-100">
            Najważniejsze zadania
          </h2>
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
        <WaproNewsCard onOpenNews={onOpenNews} />

        <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-5 dark:border-slate-800/70 dark:bg-slate-900/25">
          <div className="flex gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-600 dark:text-violet-300">
              <BookOpen className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-sm font-medium text-slate-900 dark:text-slate-200">Biblioteka</h2>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-600 dark:text-slate-500">
                Zeszyty techniczne (poradniki) oraz katalogi marek do druku — Eco Shine, Freshtek, SONAX.
                Opisy i kategorie z katalogów można edytować i od razu stosować w produktach.
              </p>
            </div>
          </div>
          {onOpenLibrary && (
            <button
              type="button"
              onClick={onOpenLibrary}
              className="mt-3 inline-flex w-fit shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:border-violet-400 hover:text-violet-700 dark:border-slate-700 dark:text-slate-300 dark:hover:border-violet-500/40 dark:hover:text-violet-200"
            >
              Otwórz bibliotekę
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

interface WaproNewsData {
  newToday: number;
  new7d: number;
  newestSku?: string;
  newestName?: string;
  newestAt?: string;
  changes24h?: number;
  lastChangeAt?: string;
}

/** Okno „Nowości z WAPRO”: ile nowych indeksów i zmian zaciągnął ostatnio sync. */
function WaproNewsCard({ onOpenNews }: { onOpenNews?: () => void }) {
  const [data, setData] = useState<WaproNewsData | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!supabase) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const sb = supabase;
      const iso = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();
      const importedCount = (from: string) =>
        sb
          .from('products')
          .select('id', { count: 'exact', head: true })
          .contains('product_meta', { waproImport: true })
          .gte('product_meta->>waproImportedAt', from);
      const [today, week, newest, changes, lastChange] = await Promise.all([
        importedCount(iso(1)),
        importedCount(iso(7)),
        sb
          .from('products')
          .select('sku,name,product_meta')
          .contains('product_meta', { waproImport: true })
          .order('product_meta->>waproImportedAt', { ascending: false })
          .limit(1),
        sb
          .from('product_sync_changes')
          .select('id', { count: 'exact', head: true })
          .gte('changed_at', iso(1)),
        sb
          .from('product_sync_changes')
          .select('changed_at')
          .order('changed_at', { ascending: false })
          .limit(1),
      ]);
      const top = newest.data?.[0] as
        | { sku: string; name: string; product_meta?: { waproImportedAt?: string } }
        | undefined;
      setData({
        newToday: today.count ?? 0,
        new7d: week.count ?? 0,
        newestSku: top?.sku,
        newestName: top?.name,
        newestAt: top?.product_meta?.waproImportedAt,
        // tabela zmian jest tylko dla zalogowanych — dla gościa zwraca pustą listę
        changes24h: lastChange.data?.length ? (changes.count ?? 0) : undefined,
        lastChangeAt: lastChange.data?.[0]?.changed_at
          ? String(lastChange.data[0].changed_at)
          : undefined,
      });
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-5 dark:border-slate-800/80 dark:bg-slate-900/30">
      <div>
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-slate-300">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
            Nowości z WAPRO
          </h2>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="rounded-md p-1 text-slate-400 hover:text-slate-200 disabled:opacity-50"
            title="Odśwież"
            aria-label="Odśwież"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {!data ? (
          <p className="mt-3 text-sm text-slate-500">
            {loading ? 'Sprawdzam ostatni sync…' : 'Nie udało się pobrać informacji o syncu.'}
          </p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-400">
            <li className="flex items-baseline justify-between gap-3">
              <span>Nowe produkty dziś</span>
              <strong className="tabular-nums text-slate-900 dark:text-slate-200">{data.newToday}</strong>
            </li>
            <li className="flex items-baseline justify-between gap-3">
              <span>Nowe produkty w 7 dni</span>
              <strong className="tabular-nums text-slate-900 dark:text-slate-200">{data.new7d}</strong>
            </li>
            {data.changes24h !== undefined && (
              <li className="flex items-baseline justify-between gap-3">
                <span>Zmiany stanów i cen (24 h)</span>
                <strong className="tabular-nums text-slate-900 dark:text-slate-200">{data.changes24h}</strong>
              </li>
            )}
            {data.lastChangeAt && (
              <li className="flex items-center gap-1.5 text-xs text-slate-500">
                <Clock className="h-3.5 w-3.5" />
                Ostatnia zmiana danych z WAPRO: {formatAgo(data.lastChangeAt)}
              </li>
            )}
            {data.newestAt && (
              <li className="rounded-lg bg-slate-50 px-2.5 py-2 text-xs text-slate-600 dark:bg-slate-800/50 dark:text-slate-400">
                Najnowszy:{' '}
                <span className="font-mono text-brand-600 dark:text-brand-300">{data.newestSku}</span>
                {data.newestName ? ` · ${data.newestName}` : ''}
                <span className="block text-slate-500">
                  dopisano{' '}
                  {new Date(data.newestAt).toLocaleString('pl-PL', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </li>
            )}
          </ul>
        )}
      </div>
      {onOpenNews && (
        <button
          type="button"
          onClick={onOpenNews}
          className="mt-3 inline-flex w-fit shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:border-brand-400 hover:text-brand-700 dark:border-slate-700 dark:text-slate-300 dark:hover:border-brand-500/40 dark:hover:text-brand-200"
        >
          Zobacz nowe produkty
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      )}
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
