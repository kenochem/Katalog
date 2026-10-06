import { useEffect, useMemo, useState } from 'react';
import { Sparkles, Loader2, RefreshCw, Calendar, Clock } from 'lucide-react';
import type { Product } from '../types';
import { getRecentlyImportedProducts, windowCutoffIso } from '../lib/newProducts';
import { ProductGrid } from './ProductGrid';
import { CatalogGridCard } from './CatalogGridCard';

type GridDensity = 'sm' | 'md' | 'lg';

const GRID_CLASS: Record<GridDensity, string> = {
  sm: 'grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10',
  md: 'grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7',
  lg: 'grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-3',
};

type RangePreset = 'day' | 'week' | 'month' | 'custom';

const PRESETS: { id: RangePreset; label: string }[] = [
  { id: 'day', label: 'Ostatni dzień' },
  { id: 'week', label: 'Ostatni tydzień' },
  { id: 'month', label: 'Ostatnie 30 dni' },
  { id: 'custom', label: 'Własny zakres' },
];

function toDateInputValue(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfDayIso(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toISOString();
}

function endOfDayIso(dateStr: string): string {
  return new Date(`${dateStr}T23:59:59.999`).toISOString();
}

function formatRelativeDate(iso: string | undefined): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const diffMs = Date.now() - then;
  const diffDays = Math.floor(diffMs / 86_400_000);
  if (diffDays <= 0) return 'dziś';
  if (diffDays === 1) return 'wczoraj';
  if (diffDays < 30) return `${diffDays} dni temu`;
  return new Date(iso).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' });
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Lokalny klucz dnia (RRRR-MM-DD) — do grupowania „dodano w dniu…”. */
function localDayKey(iso: string | undefined): string {
  if (!iso) return 'brak-daty';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return 'brak-daty';
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function dayHeading(key: string): string {
  if (key === 'brak-daty') return 'Bez daty';
  const today = localDayKey(new Date().toISOString());
  const yesterday = localDayKey(new Date(Date.now() - 86_400_000).toISOString());
  const d = new Date(`${key}T12:00:00`);
  const long = d.toLocaleDateString('pl-PL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  if (key === today) return `Dzisiaj · ${long}`;
  if (key === yesterday) return `Wczoraj · ${long}`;
  return long.charAt(0).toUpperCase() + long.slice(1);
}

/** „29.09.2026, 08:30” — dokładny moment dopisania przez sync. */
function formatAddedAt(iso: string | undefined): string {
  if (!iso) return 'brak daty';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return 'brak daty';
  return d.toLocaleString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface CatalogNewProductsViewProps {
  gridDensity?: GridDensity;
  hideImages?: boolean;
  showPrices?: boolean;
  onProductClick: (p: Product) => void;
  collectionUserKey?: string;
  onCollectionsChange?: () => void;
}

export function CatalogNewProductsView({
  gridDensity = 'md',
  hideImages = false,
  showPrices = true,
  onProductClick,
  collectionUserKey,
  onCollectionsChange,
}: CatalogNewProductsViewProps) {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [preset, setPreset] = useState<RangePreset>('month');
  const [customFrom, setCustomFrom] = useState(() => toDateInputValue(new Date(Date.now() - 30 * 86_400_000)));
  const [customTo, setCustomTo] = useState(() => toDateInputValue(new Date()));

  const range = useMemo(() => {
    if (preset === 'day') return { from: windowCutoffIso(1) };
    if (preset === 'week') return { from: windowCutoffIso(7) };
    if (preset === 'month') return { from: windowCutoffIso(30) };
    return { from: startOfDayIso(customFrom), to: endOfDayIso(customTo) };
  }, [preset, customFrom, customTo]);

  const load = () => {
    setLoading(true);
    void getRecentlyImportedProducts(range)
      .then(setProducts)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.from, range.to]);

  // Najnowsze na górze; grupy według dnia dopisania do katalogu.
  const sorted = useMemo(
    () =>
      [...(products ?? [])].sort((a, b) =>
        String(b.meta?.waproImportedAt ?? '').localeCompare(String(a.meta?.waproImportedAt ?? '')),
      ),
    [products],
  );

  const groups = useMemo(() => {
    const map = new Map<string, Product[]>();
    for (const p of sorted) {
      const key = localDayKey(p.meta?.waproImportedAt);
      const list = map.get(key);
      if (list) list.push(p);
      else map.set(key, [p]);
    }
    return [...map.entries()];
  }, [sorted]);

  const newestAt = sorted[0]?.meta?.waproImportedAt;
  const newestDate = useMemo(() => formatRelativeDate(newestAt), [newestAt]);

  const rangeLabel = useMemo(() => {
    const found = PRESETS.find((p) => p.id === preset);
    if (preset !== 'custom') return (found?.label ?? '').toLowerCase();
    return `${new Date(customFrom).toLocaleDateString('pl-PL')} – ${new Date(customTo).toLocaleDateString('pl-PL')}`;
  }, [preset, customFrom, customTo]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPreset(p.id)}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
              preset === p.id
                ? 'bg-brand-600 text-white'
                : 'border border-slate-700 text-slate-300 hover:bg-slate-800'
            }`}
          >
            {p.id === 'custom' && <Calendar className="h-3.5 w-3.5" />}
            {p.label}
          </button>
        ))}
      </div>

      {preset === 'custom' && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-300">
          <label className="flex items-center gap-1.5">
            od
            <input
              type="date"
              value={customFrom}
              max={customTo}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="rounded-lg border border-slate-700 bg-transparent px-2 py-1 text-slate-100"
            />
          </label>
          <label className="flex items-center gap-1.5">
            do
            <input
              type="date"
              value={customTo}
              min={customFrom}
              max={toDateInputValue(new Date())}
              onChange={(e) => setCustomTo(e.target.value)}
              className="rounded-lg border border-slate-700 bg-transparent px-2 py-1 text-slate-100"
            />
          </label>
        </div>
      )}

      <div className="flex items-start justify-between gap-3 rounded-xl border border-brand-500/40 bg-brand-500/10 px-4 py-3">
        <div className="flex items-start gap-2">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand-400" />
          <p className="text-sm text-brand-950 dark:text-brand-100">
            {products === null ? (
              'Wczytuję nowe produkty…'
            ) : products.length === 0 ? (
              `Brak nowych produktów w wybranym okresie (${rangeLabel}).`
            ) : (
              <>
                <strong>{products.length}</strong> produktów dopisanych automatycznie przez sync
                WAPRO — {rangeLabel} (nowe indeksy z Mag).
                {newestAt && (
                  <>
                    {' '}
                    Najnowszy: {formatAddedAt(newestAt)}
                    {newestDate ? ` (${newestDate})` : ''}.
                  </>
                )}
              </>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Odśwież
        </button>
      </div>

      <p className="flex items-start gap-1.5 text-xs text-slate-500">
        <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          Data przy produkcie to <strong className="font-medium text-slate-400">moment, w którym sync WAPRO
          wykrył nowy indeks w Mag i dopisał go do katalogu</strong> — nie data założenia artykułu w WAPRO.
          Sync działa co kilka minut, więc różnica zwykle jest niewielka; dla starszych pozycji
          (zaimportowanych hurtowo) data może odpowiadać dniowi importu.
        </span>
      </p>

      {loading && products === null ? (
        <div className="flex items-center justify-center py-16 text-slate-500">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : products && products.length === 0 ? (
        <div className="py-16 text-center text-slate-500">
          <Sparkles className="mx-auto h-10 w-10 opacity-40" />
          <p className="mt-3">Brak nowych produktów</p>
          <p className="mt-1 text-sm">
            Pozycja pojawi się tutaj, gdy sync WAPRO wykryje nowy indeks w Mag i doda go do
            katalogu. Spróbuj też szerszego zakresu dat.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map(([dayKey, list]) => (
            <section key={dayKey}>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-200">
                <Calendar className="h-4 w-4 text-brand-400" />
                {dayHeading(dayKey)}
                <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-slate-400">
                  {list.length}
                </span>
              </h3>
              <ProductGrid
                products={list}
                className={GRID_CLASS[gridDensity]}
                resetKey={`${gridDensity}|${range.from}|${range.to ?? ''}|${dayKey}`}
                renderItem={(product) => (
                  <div>
                    <CatalogGridCard
                      product={product}
                      editMode={false}
                      isFavorite={false}
                      onProductClick={onProductClick}
                      stockBusy={false}
                      density={gridDensity}
                      orderQty={0}
                      hideImages={hideImages}
                      showPrices={showPrices}
                      showCatalogKind
                      collectionUserKey={collectionUserKey}
                      onCollectionsChange={onCollectionsChange}
                    />
                    <p
                      className="mt-1 flex items-center gap-1 px-1 text-[11px] tabular-nums text-slate-500"
                      title="Moment dopisania do katalogu przez sync WAPRO"
                    >
                      <Clock className="h-3 w-3 shrink-0" />
                      Dopisano {formatAddedAt(product.meta?.waproImportedAt)}
                    </p>
                  </div>
                )}
              />
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
