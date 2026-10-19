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
import { APP_CHANGELOG } from '../data/appChangelog';
import { APP_VERSION } from '../lib/appVersion';
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

const HERO_TEXT = { color: '#ffffff' } as const;
const HERO_SOFT = { color: 'rgba(255,255,255,0.78)' } as const;

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Dobrej nocy';
  if (h < 12) return 'Dzień dobry';
  if (h < 18) return 'Miłego popołudnia';
  return 'Dobry wieczór';
}

/** Pierścień postępu (SVG) z wartością w środku. */
function Ring({ value, label, sub, color }: { value: number; label: string; sub?: string; color: string }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="flex flex-col items-center text-center">
      <div className="relative h-24 w-24">
        <svg viewBox="0 0 80 80" className="h-24 w-24 -rotate-90">
          <circle cx="40" cy="40" r={r} fill="none" strokeWidth="8" className="stroke-slate-200 dark:stroke-slate-800" />
          <circle
            cx="40"
            cy="40"
            r={r}
            fill="none"
            strokeWidth="8"
            strokeLinecap="round"
            stroke={color}
            strokeDasharray={c}
            strokeDashoffset={c * (1 - pct / 100)}
            style={{ transition: 'stroke-dashoffset 700ms ease' }}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-xl font-bold tabular-nums text-slate-950 dark:text-slate-50">{pct}%</span>
      </div>
      <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{label}</p>
      {sub && <p className="text-[11px] text-slate-500">{sub}</p>}
    </div>
  );
}

const TILE_ACCENTS = [
  'from-emerald-500/20 to-emerald-500/5 text-emerald-600 dark:text-emerald-300',
  'from-sky-500/20 to-sky-500/5 text-sky-600 dark:text-sky-300',
  'from-violet-500/20 to-violet-500/5 text-violet-600 dark:text-violet-300',
  'from-amber-500/20 to-amber-500/5 text-amber-600 dark:text-amber-300',
  'from-rose-500/20 to-rose-500/5 text-rose-600 dark:text-rose-300',
  'from-teal-500/20 to-teal-500/5 text-teal-600 dark:text-teal-300',
];

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
  const latest = APP_CHANGELOG[0];

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
    <div className="catalog-home-view mx-auto max-w-6xl space-y-6 pb-12 pt-2">
      {/* ---------- HERO ---------- */}
      <section
        className="relative overflow-hidden rounded-3xl px-5 py-8 shadow-lg sm:px-9 sm:py-10"
        style={{ background: 'linear-gradient(135deg, #14532d 0%, #166534 35%, #0f766e 70%, #0c4a6e 100%)' }}
      >
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 left-1/3 h-72 w-72 rounded-full bg-emerald-300/10 blur-3xl" />
        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-[0.2em]" style={HERO_SOFT}>
            Kenochem Katalog · {today}
          </p>
          <h1 className="mt-2 inline-flex items-center gap-2 text-3xl font-bold tracking-tight sm:text-4xl" style={HERO_TEXT}>
            {greeting()}
            {userName ? `, ${userName}` : ''}!
            <ContextHelp id="catalog" side="left" />
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed sm:text-base" style={HERO_SOFT}>
            Wszystko o produktach w jednym miejscu: stany i ceny z WAPRO, zdjęcia, opisy, producenci i synchronizacja z BaseLinkerem.
          </p>

          <form
            className="mt-6 flex max-w-2xl flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              if (onSearch) onSearch(query.trim());
              else onOpenCatalog();
            }}
          >
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Szukaj produktu: nazwa, SKU, EAN, producent…"
                className="h-12 w-full rounded-2xl border-0 bg-white pl-12 pr-4 text-base text-slate-900 shadow-md outline-none ring-2 ring-transparent placeholder:text-slate-400 focus:ring-emerald-300"
              />
            </div>
            <button
              type="submit"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-white px-6 text-sm font-bold shadow-md transition hover:bg-emerald-50"
              style={{ color: '#14532d' }}
            >
              <Boxes className="h-5 w-5" />
              {query.trim() ? 'Szukaj' : 'Przejdź do katalogu'}
              <ArrowRight className="h-4 w-4" />
            </button>
            {onOpenScanner && (
              <button
                type="button"
                onClick={onOpenScanner}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-white/30 bg-white/10 px-5 text-sm font-semibold backdrop-blur transition hover:bg-white/20"
                style={HERO_TEXT}
              >
                <ScanBarcode className="h-5 w-5" /> Skanuj EAN
              </button>
            )}
          </form>

          <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {kpis.map((k) => (
              <div key={k.label} className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur">
                <p className="text-[11px] font-semibold uppercase tracking-wider" style={HERO_SOFT}>
                  {k.label}
                </p>
                <p className="mt-0.5 text-2xl font-bold tabular-nums sm:text-3xl" style={HERO_TEXT}>
                  {k.value}
                </p>
                {k.sub && (
                  <p className="text-[11px]" style={HERO_SOFT}>
                    {k.sub}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- NA DZIŚ ---------- */}
      {next.length > 0 && (
        <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5 shadow-sm dark:border-emerald-500/25 dark:from-emerald-500/10 dark:to-slate-900/40 sm:p-6">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
              <Lightbulb className="h-4 w-4" /> Proponowany następny krok
            </p>
            <h2 className="mt-2 text-xl font-bold text-slate-950 dark:text-slate-50">{next[0].title}</h2>
            <p className="mt-1 text-sm text-slate-700 dark:text-slate-400">{next[0].detail}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onOpenDecisions?.(next[0].kinds)}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500"
              >
                Zacznij teraz <ArrowRight className="h-4 w-4" />
              </button>
              {onOpenStats && (
                <button
                  type="button"
                  onClick={onOpenStats}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                >
                  <BarChart3 className="h-4 w-4" /> Statystyki
                </button>
              )}
            </div>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/40">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Dalej w kolejce</p>
            <ul className="mt-3 space-y-2">
              {next.slice(1).map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => onOpenDecisions?.(s.kinds)}
                    className="flex w-full items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5 text-left hover:border-brand-400 dark:border-slate-800 dark:hover:border-brand-500/40"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{s.title}</span>
                      <span className="text-[11px] text-slate-500">+{s.gain.toFixed(1)} pkt jakości</span>
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" />
                  </button>
                </li>
              ))}
              {next.length < 2 && <li className="text-sm text-slate-500">To jedyne zalecenie na dziś — dobra robota!</li>}
            </ul>
            <p className="mt-3 text-[11px] text-slate-500">
              Do uzupełnienia: <strong>{decisionCount.toLocaleString('pl-PL')}</strong> produktów
            </p>
          </div>
        </section>
      )}

      {/* ---------- ZDROWIE KATALOGU ---------- */}
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/40 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold text-slate-950 dark:text-slate-50">Zdrowie katalogu</h2>
          {onOpenStats && (
            <button type="button" onClick={onOpenStats} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline dark:text-brand-300">
              Pełne statystyki <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="mt-5 grid grid-cols-2 gap-6 sm:grid-cols-4">
          <Ring value={quality.avgScore} label="Jakość danych" sub="średnia kompletność" color="#33b33b" />
          <Ring value={photoPct} label="Zdjęcia" sub={`${quality.withPhoto.toLocaleString('pl-PL')} z ${quality.total.toLocaleString('pl-PL')}`} color="#38bdf8" />
          <Ring value={eanPct} label="Kody EAN" sub={`${quality.withEan.toLocaleString('pl-PL')} produktów`} color="#a78bfa" />
          <Ring value={baselinkerPct} label="BaseLinker" sub={`${baselinker.linked.toLocaleString('pl-PL')} powiązanych`} color="#fbbf24" />
        </div>
        {onOpenNotInBaselinker && baselinker.notLinked > 0 && (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-slate-50 px-4 py-3 text-sm dark:bg-slate-800/50">
            <span className="text-slate-700 dark:text-slate-300">
              <strong className="tabular-nums">{baselinker.notLinked.toLocaleString('pl-PL')}</strong> produktów jest poza BaseLinkerem
              {baselinker.readyToAdd > 0 && (
                <>
                  , z czego <strong className="tabular-nums">{baselinker.readyToAdd.toLocaleString('pl-PL')}</strong> ma już zdjęcie i można je dodać
                </>
              )}
              .
            </span>
            <button type="button" onClick={onOpenNotInBaselinker} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline dark:text-brand-300">
              Pokaż <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </section>

      {/* ---------- SKRÓTY ---------- */}
      {quickActions.length > 0 && (
        <section>
          <h2 className="mb-3 text-base font-bold text-slate-950 dark:text-slate-50">Narzędzia i skróty</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {quickActions.map((a, i) => (
              <button
                key={a.id}
                type="button"
                onClick={a.onClick}
                title={a.hint}
                className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-brand-400 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/50 dark:hover:border-brand-500/40"
              >
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${TILE_ACCENTS[i % TILE_ACCENTS.length]}`}>
                  {a.icon ?? <Boxes className="h-5 w-5" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{a.label}</span>
                  {a.count !== undefined && a.count > 0 && (
                    <span className="text-[11px] tabular-nums text-slate-500">{a.count.toLocaleString('pl-PL')} pozycji</span>
                  )}
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand-500" />
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ---------- AKTYWNOŚĆ ---------- */}
      <section className="grid gap-4 lg:grid-cols-2">
        <WaproNewsCard onOpenNews={onOpenNews} />
        <RecentChangesCard />
      </section>

      {/* ---------- NOWOŚCI W APLIKACJI + BIBLIOTEKA ---------- */}
      <section className="grid gap-4 sm:grid-cols-2">
        {latest && (
          <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/40 sm:p-5">
            <div className="flex gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-300">
                <Rocket className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Co nowego w katalogu <span className="ml-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-slate-600 dark:bg-slate-800 dark:text-slate-300">v{APP_VERSION}</span>
                </h2>
                <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-200">{latest.title}</p>
                <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-slate-600 dark:text-slate-500">{latest.description}</p>
              </div>
            </div>
            {onOpenUpdates && (
              <button
                type="button"
                onClick={onOpenUpdates}
                className="mt-3 inline-flex w-fit items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:border-rose-400 hover:text-rose-700 dark:border-slate-700 dark:text-slate-300 dark:hover:border-rose-500/40 dark:hover:text-rose-200"
              >
                Zobacz wszystkie aktualizacje <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
        <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/40 sm:p-5">
          <div className="flex gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-600 dark:text-violet-300">
              <BookOpen className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Biblioteka</h2>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-600 dark:text-slate-500">
                Zeszyty techniczne (poradniki) oraz katalogi marek do druku — Eco Shine, Freshtek, SONAX. Opisy i kategorie z katalogów można edytować i od razu stosować w produktach.
              </p>
            </div>
          </div>
          {onOpenLibrary && (
            <button
              type="button"
              onClick={onOpenLibrary}
              className="mt-3 inline-flex w-fit shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:border-violet-400 hover:text-violet-700 dark:border-slate-700 dark:text-slate-300 dark:hover:border-violet-500/40 dark:hover:text-violet-200"
            >
              Otwórz bibliotekę <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </section>
      {onOpenMissingImages && missingImagesCount > 0 && (
        <p className="text-center text-xs text-slate-500">
          <ImageOff className="mr-1 inline h-3.5 w-3.5" />
          {missingImagesCount.toLocaleString('pl-PL')} produktów czeka na zdjęcie —{' '}
          <button type="button" onClick={onOpenMissingImages} className="font-semibold text-brand-700 hover:underline dark:text-brand-300">
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
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/30 sm:p-5">
      <h2 className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-slate-300">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300">
          <Clock className="h-3.5 w-3.5" />
        </span>
        Ostatnie zmiany w produktach
      </h2>
      {!rows ? (
        <p className="mt-3 text-sm text-slate-500">Wczytuję…</p>
      ) : rows.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">Brak zapisanych zmian albo brak dostępu do dziennika.</p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
          {rows.map((e) => (
            <li key={e.id} className="flex items-start gap-2.5 py-2">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300">
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
