import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Boxes,
  Clock,
  ImageOff,
  Lightbulb,
  RefreshCw,
  Rocket,
  ScanBarcode,
  Search,
  Sparkles,
} from 'lucide-react';
import type { Product } from '../types';
import { computeCatalogStats } from '../lib/catalogExport';
import { hasBaselinkerLink } from '../lib/baselinkerLink';
import { useBaselinkerLinksVersion } from '../lib/baselinkerLive';
import { supabase } from '../lib/supabase';
import { formatAgo } from '../suite/suiteData';
import { ContextHelp } from './ContextHelp';
import { computeCatalogStats as computeQualityStats, suggestNext } from '../lib/catalogStats';
import { APP_VERSION_STAMP as APP_VERSION, LATEST_CHANGE } from '../lib/appVersion.generated';
import { fetchAuditLog, type AuditEntry } from '../lib/auditLog';

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
  /** Imię do powitania. */
  userName?: string;
  /** Wejście do katalogu (cały katalog). */
  onOpenCatalog: () => void;
  /** Szukanie z ekranu startowego — otwiera katalog z wpisanym zapytaniem. */
  onSearch?: (query: string) => void;
  onOpenMissingImages?: () => void;
  onOpenScanner?: () => void;
  onOpenNews?: () => void;
  onOpenLibrary?: () => void;
  onOpenStats?: () => void;
  onOpenDecisions?: (kinds?: string[]) => void;
  onOpenUpdates?: () => void;
  /** Katalog przefiltrowany do produktów spoza BaseLinkera. */
  onOpenNotInBaselinker?: () => void;
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Dobrej nocy';
  if (h < 12) return 'Dzień dobry';
  if (h < 18) return 'Miłego popołudnia';
  return 'Dobry wieczór';
}

const CARD = 'rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/40';
const EYEBROW = 'text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500';
const LINK = 'inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-950 dark:text-slate-400 dark:hover:text-slate-100';
const BTN_OUTLINE =
  'inline-flex w-fit items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800';

/** Wskaźnik postępu: wartość, podpis i cienki pasek. */
function Meter({ value, label, sub }: { value: number; label: string; sub?: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{label}</p>
        <p className="text-sm font-semibold tabular-nums text-slate-950 dark:text-slate-50">{pct}%</p>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
        <div className="h-full rounded-full bg-brand-600 transition-[width] duration-700 dark:bg-brand-500" style={{ width: `${pct}%` }} />
      </div>
      {sub && <p className="mt-1.5 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

export function CatalogHomeView({
  allProducts,
  missingImagesCount,
  decisionCount,
  quickActions = [],
  userName,
  onOpenCatalog,
  onSearch,
  onOpenMissingImages,
  onOpenScanner,
  onOpenNews,
  onOpenLibrary,
  onOpenStats,
  onOpenDecisions,
  onOpenUpdates,
  onOpenNotInBaselinker,
}: CatalogHomeViewProps) {
  const linksVersion = useBaselinkerLinksVersion();
  const [query, setQuery] = useState('');
  const stats = useMemo(() => computeCatalogStats(allProducts), [allProducts]);
  const quality = useMemo(() => computeQualityStats(allProducts), [allProducts]);
  const next = useMemo(() => suggestNext(quality, 3), [quality]);
  const latest = LATEST_CHANGE.title ? LATEST_CHANGE : undefined;

  const baselinker = useMemo(() => {
    let linked = 0;
    let readyToAdd = 0;
    for (const p of allProducts) {
      if (p.isGroup) continue;
      if (hasBaselinkerLink(p)) linked += 1;
      else if (p.hasImage) readyToAdd += 1;
    }
    const total = allProducts.filter((p) => !p.isGroup).length;
    return { linked, notLinked: Math.max(0, total - linked), readyToAdd, total };
    // linksVersion: lista powiązań z BaseLinkerem odświeża się w tle
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allProducts, linksVersion]);
  const baselinkerPct = baselinker.total > 0 ? Math.round((baselinker.linked / baselinker.total) * 100) : 0;
  const photoPct = quality.total ? Math.round((quality.withPhoto / quality.total) * 100) : 0;
  const eanPct = quality.total ? Math.round((quality.withEan / quality.total) * 100) : 0;
  const today = new Date().toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' });

  const kpis: { label: string; value: string; sub?: string }[] = [
    { label: 'Produkty', value: stats.total.toLocaleString('pl-PL'), sub: 'w katalogu' },
    { label: 'Na stanie', value: stats.inStock.toLocaleString('pl-PL'), sub: `${stats.outOfStock.toLocaleString('pl-PL')} bez stanu` },
    { label: 'Ze zdjęciem', value: `${photoPct}%`, sub: `${missingImagesCount.toLocaleString('pl-PL')} do uzupełnienia` },
    { label: 'Jakość danych', value: `${quality.avgScore}%`, sub: 'średnia kompletność' },
  ];

  return (
    <div className="catalog-home-view mx-auto max-w-6xl space-y-8 pb-12 pt-2">
      {/* ---------- NAGŁÓWEK ---------- */}
      <section>
        <p className={EYEBROW}>
          Kenochem Katalog · {today}
        </p>
        <h1 className="mt-2 inline-flex items-center gap-2 text-3xl font-semibold tracking-tight text-slate-950 dark:text-slate-50 sm:text-4xl">
          {greeting()}
          {userName ? `, ${userName}` : ''}
          <ContextHelp id="catalog" side="left" />
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-400 sm:text-base">
          Produkty, stany i ceny z WAPRO, zdjęcia, opisy oraz synchronizacja z BaseLinkerem w jednym miejscu.
        </p>

        <form
          className="mt-6 flex max-w-3xl flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            if (onSearch) onSearch(query.trim());
            else onOpenCatalog();
          }}
        >
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Szukaj produktu: nazwa, SKU, EAN, producent…"
              className="h-11 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-4 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
          <button
            type="submit"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 text-sm font-medium text-white hover:bg-brand-500"
          >
            {query.trim() ? 'Szukaj' : 'Przejdź do katalogu'}
            <ArrowRight className="h-4 w-4" />
          </button>
          {onOpenScanner && (
            <button
              type="button"
              onClick={onOpenScanner}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <ScanBarcode className="h-4 w-4" /> Skanuj EAN
            </button>
          )}
        </form>

        <dl className={`mt-8 grid grid-cols-2 divide-x divide-y divide-slate-200 overflow-hidden sm:grid-cols-4 sm:divide-y-0 dark:divide-slate-800 ${CARD}`}>
          {kpis.map((k) => (
            <div key={k.label} className="px-5 py-4">
              <dt className={EYEBROW}>{k.label}</dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums text-slate-950 dark:text-slate-50 sm:text-3xl">{k.value}</dd>
              {k.sub && <p className="mt-0.5 text-xs text-slate-500">{k.sub}</p>}
            </div>
          ))}
        </dl>
      </section>

      {/* ---------- NA DZIŚ ---------- */}
      {next.length > 0 && (
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className={`${CARD} p-5 sm:p-6`}>
            <p className={`${EYEBROW} flex items-center gap-2`}>
              <Lightbulb className="h-3.5 w-3.5" /> Proponowany następny krok
            </p>
            <h2 className="mt-3 text-xl font-semibold text-slate-950 dark:text-slate-50">{next[0].title}</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{next[0].detail}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onOpenDecisions?.(next[0].kinds)}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500"
              >
                Zacznij teraz <ArrowRight className="h-4 w-4" />
              </button>
              {onOpenStats && (
                <button
                  type="button"
                  onClick={onOpenStats}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <BarChart3 className="h-4 w-4" /> Statystyki
                </button>
              )}
            </div>
          </div>
          <div className={`${CARD} p-5`}>
            <p className={EYEBROW}>Dalej w kolejce</p>
            <ul className="mt-3 divide-y divide-slate-200 dark:divide-slate-800">
              {next.slice(1).map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => onOpenDecisions?.(s.kinds)}
                    className="flex w-full items-center gap-3 py-2.5 text-left hover:text-brand-700 dark:hover:text-brand-300"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-900 dark:text-slate-100">{s.title}</span>
                      <span className="text-xs text-slate-500">+{s.gain.toFixed(1)} pkt jakości</span>
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" />
                  </button>
                </li>
              ))}
              {next.length < 2 && <li className="py-2 text-sm text-slate-500">To jedyne zalecenie na dziś.</li>}
            </ul>
            <p className="mt-3 text-xs text-slate-500">
              Do uzupełnienia: <strong className="font-semibold text-slate-700 dark:text-slate-300">{decisionCount.toLocaleString('pl-PL')}</strong> produktów
            </p>
          </div>
        </section>
      )}

      {/* ---------- JAKOŚĆ KATALOGU ---------- */}
      <section className={`${CARD} p-5 sm:p-6`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-slate-950 dark:text-slate-50">Jakość katalogu</h2>
          {onOpenStats && (
            <button type="button" onClick={onOpenStats} className={LINK}>
              Pełne statystyki <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="mt-5 grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
          <Meter value={quality.avgScore} label="Jakość danych" sub="średnia kompletność" />
          <Meter value={photoPct} label="Zdjęcia" sub={`${quality.withPhoto.toLocaleString('pl-PL')} z ${quality.total.toLocaleString('pl-PL')}`} />
          <Meter value={eanPct} label="Kody EAN" sub={`${quality.withEan.toLocaleString('pl-PL')} produktów`} />
          <Meter value={baselinkerPct} label="BaseLinker" sub={`${baselinker.linked.toLocaleString('pl-PL')} powiązanych`} />
        </div>
        {onOpenNotInBaselinker && baselinker.notLinked > 0 && (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-4 text-sm dark:border-slate-800">
            <span className="text-slate-600 dark:text-slate-400">
              <strong className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">{baselinker.notLinked.toLocaleString('pl-PL')}</strong> produktów jest poza BaseLinkerem
              {baselinker.readyToAdd > 0 && (
                <>
                  , z czego <strong className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">{baselinker.readyToAdd.toLocaleString('pl-PL')}</strong> ma już zdjęcie i można je dodać
                </>
              )}
              .
            </span>
            <button type="button" onClick={onOpenNotInBaselinker} className={LINK}>
              Pokaż <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </section>

      {/* ---------- SKRÓTY ---------- */}
      {quickActions.length > 0 && (
        <section>
          <h2 className="mb-3 text-base font-semibold text-slate-950 dark:text-slate-50">Narzędzia i skróty</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {quickActions.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={a.onClick}
                title={a.hint}
                className={`group flex items-center gap-3 p-3.5 text-left transition hover:border-slate-400 dark:hover:border-slate-600 ${CARD}`}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {a.icon ?? <Boxes className="h-4 w-4" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-slate-900 dark:text-slate-100">{a.label}</span>
                  {a.count !== undefined && a.count > 0 && (
                    <span className="text-xs tabular-nums text-slate-500">{a.count.toLocaleString('pl-PL')} pozycji</span>
                  )}
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:text-slate-600 dark:group-hover:text-slate-300" />
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ---------- AKTYWNOŚĆ ---------- */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <WaproNewsCard onOpenNews={onOpenNews} />
        <RecentChangesCard />
      </section>

      {/* ---------- NOWOŚCI W APLIKACJI + BIBLIOTEKA ---------- */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {latest && (
          <div className={`flex flex-col justify-between p-5 ${CARD}`}>
            <div>
              <p className={`${EYEBROW} flex items-center gap-2`}>
                <Rocket className="h-3.5 w-3.5" /> Co nowego w katalogu
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold normal-case tabular-nums tracking-normal text-slate-600 dark:bg-slate-800 dark:text-slate-300">v{APP_VERSION}</span>
              </p>
              <p className="mt-3 text-sm font-medium text-slate-900 dark:text-slate-100">{latest.title}</p>
              <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-600 dark:text-slate-500">{latest.description}</p>
            </div>
            {onOpenUpdates && (
              <button type="button" onClick={onOpenUpdates} className={`mt-4 ${BTN_OUTLINE}`}>
                Zobacz wszystkie aktualizacje <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
        <div className={`flex flex-col justify-between p-5 ${CARD}`}>
          <div>
            <p className={`${EYEBROW} flex items-center gap-2`}>
              <BookOpen className="h-3.5 w-3.5" /> Biblioteka
            </p>
            <p className="mt-3 text-xs leading-relaxed text-slate-600 dark:text-slate-500">
              Zeszyty techniczne (poradniki) oraz katalogi marek do druku — Eco Shine, Freshtek, SONAX. Opisy i kategorie z katalogów można edytować i od razu stosować w produktach.
            </p>
          </div>
          {onOpenLibrary && (
            <button type="button" onClick={onOpenLibrary} className={`mt-4 ${BTN_OUTLINE}`}>
              Otwórz bibliotekę <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </section>
      {onOpenMissingImages && missingImagesCount > 0 && (
        <p className="text-center text-xs text-slate-500">
          <ImageOff className="mr-1 inline h-3.5 w-3.5" />
          {missingImagesCount.toLocaleString('pl-PL')} produktów czeka na zdjęcie —{' '}
          <button type="button" onClick={onOpenMissingImages} className="font-medium text-brand-700 hover:underline dark:text-brand-300">
            uzupełnij zdjęcia
          </button>
        </p>
      )}
    </div>
  );
}

/** Ostatnie zmiany produktów wykonane przez zespół (z dziennika aktywności). */
function RecentChangesCard() {
  const [rows, setRows] = useState<AuditEntry[] | null>(null);
  useEffect(() => {
    let alive = true;
    fetchAuditLog({ entityType: 'product', limit: 60 })
      .then((r) => alive && setRows(r.filter((e) => e.action.startsWith('product.') && !e.changes?._batch).slice(0, 6)))
      .catch(() => alive && setRows([]));
    return () => {
      alive = false;
    };
  }, []);
  return (
    <div className={`p-5 ${CARD}`}>
      <h2 className={`${EYEBROW} flex items-center gap-2`}>
        <Clock className="h-3.5 w-3.5" />
        Ostatnie zmiany w produktach
      </h2>
      {!rows ? (
        <p className="mt-3 text-sm text-slate-500">Wczytuję…</p>
      ) : rows.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">Brak zapisanych zmian albo brak dostępu do dziennika.</p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-200 dark:divide-slate-800">
          {rows.map((e) => (
            <li key={e.id} className="flex items-start gap-2.5 py-2">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-semibold uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {(e.userLabel || '?').slice(0, 2)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-slate-800 dark:text-slate-200">
                  <span className="font-semibold">{e.userLabel || 'ktoś'}</span> · {e.entityLabel || e.entityId}
                </p>
                <p className="truncate text-[11px] text-slate-500">
                  <span className="font-mono">{e.entityId}</span> · {e.summary}
                </p>
              </div>
              <span className="shrink-0 text-[11px] text-slate-500">{formatAgo(e.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}
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
    <div className={`flex flex-col justify-between p-5 ${CARD}`}>
      <div>
        <div className="flex items-center justify-between gap-2">
          <h2 className={`${EYEBROW} flex items-center gap-2`}>
            <Sparkles className="h-3.5 w-3.5" />
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
              <li className="rounded-lg border border-slate-200 px-2.5 py-2 text-xs text-slate-600 dark:border-slate-800 dark:text-slate-400">
                Najnowszy:{' '}
                <span className="font-mono text-slate-900 dark:text-slate-100">{data.newestSku}</span>
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
          className={`mt-4 ${BTN_OUTLINE}`}
        >
          Zobacz nowe produkty
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
