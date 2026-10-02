import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  CloudDownload,
  Download,
  ExternalLink,
  Loader2,
  Package,
  RefreshCw,
  Search,
} from 'lucide-react';
import { formatPricePln } from '../../lib/format';
import { downloadCsv, stampFile } from '../../lib/exportReport';
import { useAuth } from '../../lib/auth';
import { roleCan } from '../../lib/roles';
import { getProductImage, updateProduct } from '../../lib/products';
import { mergeProductMeta } from '../../lib/productMeta';
import {
  buildProductSalesMetrics,
  CATALOG_PRODUCT_URL,
  fetchProductsForSalesAnalytics,
  invalidateSalesAnalyticsCache,
  type SalesPeriodMonths,
} from '../../lib/waproSalesAnalytics';
import { isDeadStockExcluded, isSalesMarkedExcluded } from '../../lib/salesExclusions';
import { requestWaproSalesSync, waitForSalesSync } from '../../lib/salesSync';
import { showToast } from '../../lib/toast';
import type { CatalogType, Product } from '../../types';

const PERIOD_OPTIONS: { months: SalesPeriodMonths; label: string }[] = [
  { months: 1, label: '1 miesiąc' },
  { months: 3, label: '3 miesiące' },
  { months: 6, label: '6 miesięcy' },
  { months: 12, label: '12 miesięcy' },
];

type SortKey = 'value' | 'stock' | 'lastSale' | 'name';

interface DeadStockRow {
  product: Product;
  qty: number;
  purchaseNet: number | null;
  stock: number;
  valueNet: number;
  lastSaleDate: string | null;
  daysSinceLastSale: number | null;
  /** Czy dla tego SKU w ogóle dotarły dane sprzedaży z WAPRO (false = nigdy nie zsynchronizowano). */
  hasStats: boolean;
  excluded: boolean;
}

function buildRow(product: Product, months: SalesPeriodMonths): DeadStockRow {
  const metrics = buildProductSalesMetrics(product, months);
  const stock = product.stock ?? 0;
  const purchaseNet = metrics.purchaseNet;
  const lastSaleDate = metrics.lastSaleDate;
  const daysSinceLastSale = lastSaleDate
    ? Math.max(0, Math.floor((Date.now() - new Date(lastSaleDate).getTime()) / 86_400_000))
    : null;
  return {
    product,
    qty: metrics.qty,
    purchaseNet,
    stock,
    valueNet: stock * (purchaseNet ?? 0),
    lastSaleDate,
    daysSinceLastSale,
    hasStats: metrics.hasStats,
    excluded: isDeadStockExcluded(product),
  };
}

/** WAPRO nie przechowuje historii sprzedaży sprzed swojego okna sync — brak daty
 * nie znaczy „sprzedaży nigdy nie było”, tylko że nie mamy jej zapisanej. */
function formatLastSale(row: Pick<DeadStockRow, 'lastSaleDate' | 'hasStats'>): string {
  if (row.lastSaleDate) {
    try {
      return new Date(row.lastSaleDate).toLocaleDateString('pl-PL');
    } catch {
      return row.lastSaleDate;
    }
  }
  return row.hasStats ? 'brak w oknie WAPRO' : 'brak synchronizacji';
}

function formatDays(days: number | null): string {
  if (days == null) return '—';
  return `${days.toLocaleString('pl-PL')} dni`;
}

export function OpsDeadStockAnalysis({ onBack }: { onBack: () => void }) {
  const { role } = useAuth();
  const showPrices = roleCan(role, 'viewPrices');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [period, setPeriod] = useState<SalesPeriodMonths>(12);
  const [catalog, setCatalog] = useState<'all' | CatalogType>('all');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('value');
  const [pageSize, setPageSize] = useState(100);
  const [page, setPage] = useState(1);
  const [showExcluded, setShowExcluded] = useState(false);
  const [excludeBusyId, setExcludeBusyId] = useState<string | null>(null);

  const loadData = useCallback(
    async (opts?: { force?: boolean }) => {
      setLoadError(null);
      try {
        const catalogFilter = catalog === 'all' ? undefined : catalog;
        const list = await fetchProductsForSalesAnalytics(catalogFilter, period, {
          force: opts?.force,
        });
        setProducts(list);
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : 'Błąd ładowania produktów');
      }
    },
    [catalog, period],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void loadData().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [loadData]);

  /** Re-czyta to, co już jest w Supabase (szybkie, ale bez nowych danych z WAPRO). */
  async function handleRefresh() {
    setRefreshing(true);
    invalidateSalesAnalyticsCache();
    await loadData({ force: true });
    setRefreshing(false);
  }

  /** Zleca realny sync sprzedaży z Mag WAPRO (może potrwać), potem przeładowuje widok. */
  async function handleSyncFromMag() {
    setRefreshing(true);
    try {
      const req = await requestWaproSalesSync();
      if (!req.ok || !req.id) {
        showToast(req.error ?? 'Nie udało się zlecić sync sprzedaży.', 'error');
        return;
      }
      showToast('Sync sprzedaży w kolejce — czekam na Mag WAPRO…', 'info');
      const done = await waitForSalesSync(req.id);
      if (!done || done.status === 'error') {
        showToast(done?.message ?? 'Błąd sync sprzedaży na serwerze WAPRO.', 'error');
        return;
      }
      invalidateSalesAnalyticsCache();
      await loadData({ force: true });
      showToast('Dane sprzedaży zaktualizowane do dziś.', 'ok');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Błąd odświeżania', 'error');
    } finally {
      setRefreshing(false);
    }
  }

  /** Wykluczenie zapisane na produkcie (product_meta.salesExcludeFromSum) — widoczne
   * i odwracalne dla każdego z dostępem do Ops, nie tylko na tym urządzeniu. */
  async function toggleProductExclude(product: Product) {
    const next = !isSalesMarkedExcluded(product);
    setExcludeBusyId(product.id);
    try {
      const nextMeta = mergeProductMeta(product.meta, { salesExcludeFromSum: next });
      await updateProduct(product.id, { meta: nextMeta });
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, meta: nextMeta } : p)),
      );
      showToast(next ? 'Wykluczono z sum martwego stocku' : 'Cofnięto wykluczenie', 'ok');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Nie udało się zapisać', 'error');
    } finally {
      setExcludeBusyId(null);
    }
  }

  const allRows = useMemo(
    () =>
      products
        .map((p) => buildRow(p, period))
        .filter((row) => row.stock > 0 && row.qty === 0),
    [products, period],
  );

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const row of allRows) if (row.product.category) set.add(row.product.category);
    return [...set].sort((a, b) => a.localeCompare(b, 'pl'));
  }, [allRows]);

  const manufacturers = useMemo(() => {
    const set = new Set<string>();
    for (const row of allRows) if (row.product.manufacturer) set.add(row.product.manufacturer);
    return [...set].sort((a, b) => a.localeCompare(b, 'pl'));
  }, [allRows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allRows.filter((row) => {
      if (!showExcluded && row.excluded) return false;
      const p = row.product;
      if (q) {
        const hay = `${p.sku} ${p.name} ${p.displayName} ${p.ean}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (category && p.category !== category) return false;
      if (manufacturer && p.manufacturer !== manufacturer) return false;
      return true;
    });
  }, [allRows, search, category, manufacturer, showExcluded]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      switch (sortKey) {
        case 'stock':
          return b.stock - a.stock;
        case 'lastSale':
          return (b.daysSinceLastSale ?? Infinity) - (a.daysSinceLastSale ?? Infinity);
        case 'name':
          return a.product.displayName.localeCompare(b.product.displayName, 'pl');
        case 'value':
        default:
          return b.valueNet - a.valueNet;
      }
    });
    return copy;
  }, [filtered, sortKey]);

  const summary = useMemo(() => {
    const included = sorted.filter((r) => !r.excluded);
    return {
      count: included.length,
      totalValue: included.reduce((sum, r) => sum + r.valueNet, 0),
      excludedCount: filtered.length - included.length,
      noSyncCount: included.filter((r) => !r.hasStats).length,
    };
  }, [sorted, filtered.length]);

  const lastSyncInfo = useMemo(() => {
    let newest: string | null = null;
    for (const p of products) {
      if (p.waproSalesSyncedAt && (!newest || p.waproSalesSyncedAt > newest)) {
        newest = p.waproSalesSyncedAt;
      }
    }
    if (!newest) return null;
    const ageDays = Math.floor((Date.now() - new Date(newest).getTime()) / 86_400_000);
    const label =
      ageDays <= 0
        ? 'dziś'
        : ageDays === 1
          ? 'wczoraj'
          : `${ageDays} dni temu (${new Date(newest).toLocaleDateString('pl-PL')})`;
    return { label, stale: ageDays > 7 };
  }, [products]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const pageRows = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, safePage, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [search, category, manufacturer, showExcluded, period, catalog]);

  function handleExportCsv() {
    downloadCsv(
      stampFile('martwy_stock'),
      ['SKU', 'Nazwa', 'Kategoria', 'Producent', 'Stan', 'Cena zakupu netto', 'Wartość netto', 'Ostatnia sprzedaż', 'Dni bez sprzedaży', 'Wykluczony'],
      sorted.map((r) => [
        r.product.sku,
        r.product.displayName,
        r.product.category,
        r.product.manufacturer || '',
        r.stock,
        r.purchaseNet ?? '',
        r.valueNet.toFixed(2),
        formatLastSale(r),
        r.daysSinceLastSale ?? '',
        r.excluded ? 'tak' : 'nie',
      ]),
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4 pb-10">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Wróć
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={loading || !sorted.length}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Eksport CSV
          </button>
          <button
            type="button"
            onClick={() => void handleRefresh()}
            disabled={refreshing}
            title="Wczytaj ponownie to, co już jest zapisane w bazie — bez pytania WAPRO o nowe dane"
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-50"
          >
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Odśwież widok
          </button>
          <button
            type="button"
            onClick={() => void handleSyncFromMag()}
            disabled={refreshing}
            title="Zleć pobranie aktualnej sprzedaży z WAPRO Mag — może potrwać kilkadziesiąt sekund"
            className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-50"
          >
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudDownload className="h-4 w-4" />}
            Sync z Mag WAPRO
          </button>
        </div>
      </div>

      {lastSyncInfo && (
        <div
          className={`rounded-xl border px-4 py-2.5 text-xs ${
            lastSyncInfo.stale
              ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
              : 'border-slate-800 bg-slate-900/40 text-slate-500'
          }`}
        >
          Dane sprzedaży zsynchronizowane: <strong>{lastSyncInfo.label}</strong>
          {lastSyncInfo.stale &&
            ' — to dawno, lista może pokazywać towar, który w międzyczasie się sprzedał. Kliknij „Sync z Mag WAPRO”, żeby odświeżyć.'}
        </div>
      )}

      <section className="surface-panel p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-300">
          Analiza sprzedaży produktów
        </p>
        <h2 className="mt-1 text-xl font-bold text-slate-50">Martwy stock</h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-400">
          Towar na stanie, dla którego nie odnotowano ani jednej sprzedaży w wybranym okresie.
          Palety, obudowy serwisowe, komplety naprawcze i zgłoszone błędne wpisy są automatycznie
          pomijane w sumie (można je podejrzeć przełącznikiem niżej). Ręczne „Wyklucz” zapisuje się
          na produkcie — widoczne i do cofnięcia dla każdego z dostępem do Ops, nie tylko na Twoim urządzeniu.
        </p>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="surface-panel p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pozycji martwego stocku</p>
          <p className="mt-1 text-3xl font-bold text-slate-50">{summary.count.toLocaleString('pl-PL')}</p>
          {summary.excludedCount > 0 && (
            <p className="mt-1 text-xs text-slate-500">
              + {summary.excludedCount.toLocaleString('pl-PL')} pominiętych (wewnętrzne / błędne)
            </p>
          )}
          {summary.noSyncCount > 0 && (
            <p className="mt-1 text-xs text-slate-500">
              w tym {summary.noSyncCount.toLocaleString('pl-PL')} bez zsynchronizowanych danych sprzedaży
              (nie znaczy „nigdy się nie sprzedało" — po prostu nie mamy historii)
            </p>
          )}
        </div>
        <div className="surface-panel p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Zamrożona wartość (stan × cena zakupu)
          </p>
          <p className="mt-1 text-3xl font-bold text-amber-400">
            {showPrices ? formatPricePln(summary.totalValue) : '—'}
          </p>
        </div>
      </div>

      <div className="surface-panel space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Brak sprzedaży od:</span>
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.months}
              type="button"
              onClick={() => setPeriod(opt.months)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                period === opt.months
                  ? 'bg-brand-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-100'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-500">
          Krótszy okres = łagodniejsze kryterium, więc trafia więcej pozycji (wystarczy brak
          sprzedaży w ostatnim miesiącu). Dłuższy okres = surowsze kryterium — mniej pozycji, ale
          każda z nich potwierdza brak sprzedaży przez cały ten czas. 12 miesięcy to najpewniejsza,
          rekomendowana lista do decyzji.
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[14rem] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Szukaj SKU, nazwy, EAN…"
              className="w-full rounded-lg border border-slate-700 bg-slate-900 py-2 pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-brand-500 focus:outline-none"
            />
          </div>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
          >
            <option value="">Wszystkie kategorie</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select
            value={manufacturer}
            onChange={(e) => setManufacturer(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
          >
            <option value="">Wszyscy producenci</option>
            {manufacturers.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <select
            value={catalog}
            onChange={(e) => setCatalog(e.target.value as 'all' | CatalogType)}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
          >
            <option value="all">Cały katalog</option>
            <option value="accessories">Akcesoria / chemia</option>
            <option value="shop">Produkty sklepowe</option>
          </select>
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
          >
            <option value="value">Sortuj: wartość</option>
            <option value="stock">Sortuj: stan</option>
            <option value="lastSale">Sortuj: dni bez sprzedaży</option>
            <option value="name">Sortuj: nazwa</option>
          </select>
          <label className="flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={showExcluded}
              onChange={(e) => setShowExcluded(e.target.checked)}
            />
            Pokaż pominięte
          </label>
        </div>
      </div>

      {loadError && (
        <div className="surface-panel border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300">
          {loadError}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          Ładowanie…
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/30">
          <div className="grid grid-cols-[3rem_1.6fr_5rem_6rem_6rem_6rem_5rem] gap-3 border-b border-slate-800 bg-slate-900/80 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <span></span>
            <span>Produkt</span>
            <span className="text-right">Stan</span>
            <span className="text-right">Zakup netto</span>
            <span className="text-right">Wartość</span>
            <span className="text-right">Ost. sprzedaż</span>
            <span className="text-right">Akcja</span>
          </div>
          <ul className="divide-y divide-slate-800">
            {pageRows.map((row) => {
              const p = row.product;
              const image = getProductImage(p);
              const isManuallyExcluded = isSalesMarkedExcluded(p);
              const busy = excludeBusyId === p.id;
              return (
                <li
                  key={p.id}
                  className={`grid grid-cols-[3rem_1.6fr_5rem_6rem_6rem_6rem_5rem] items-center gap-3 px-4 py-3 ${
                    row.excluded ? 'opacity-50' : ''
                  }`}
                >
                  <div className="h-10 w-10 overflow-hidden rounded-lg bg-slate-800">
                    {image ? (
                      <img src={image} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-slate-600">
                        <Package className="h-5 w-5" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-100" title={p.displayName}>
                      {p.displayName}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {p.sku} · {p.category}
                      {row.excluded && ' · pominięty (wewnętrzny/błędny)'}
                    </p>
                  </div>
                  <span className="text-right text-sm text-slate-200">{row.stock}</span>
                  <span className="text-right text-sm text-slate-300">
                    {showPrices ? formatPricePln(row.purchaseNet) : '—'}
                  </span>
                  <span className="text-right text-sm font-semibold text-amber-400">
                    {showPrices ? formatPricePln(row.valueNet) : '—'}
                  </span>
                  <span className="text-right text-xs text-slate-400">
                    {formatLastSale(row)}
                    <br />
                    {formatDays(row.daysSinceLastSale)}
                  </span>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => void toggleProductExclude(p)}
                      disabled={busy}
                      className="flex items-center gap-1 rounded-lg border border-slate-700 px-2 py-1 text-[11px] font-medium text-slate-400 hover:bg-slate-800 hover:text-slate-100 disabled:opacity-50"
                      title={
                        isManuallyExcluded
                          ? 'Cofnij wykluczenie — widoczne dla wszystkich w Ops'
                          : 'Wyklucz z sum — widoczne i odwracalne dla wszystkich w Ops'
                      }
                    >
                      {busy && <Loader2 className="h-3 w-3 animate-spin" />}
                      {isManuallyExcluded ? 'Cofnij' : 'Wyklucz'}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          {!pageRows.length && (
            <div className="p-8 text-center text-sm text-slate-500">Brak pozycji spełniających kryteria.</div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-400">
        <span>
          {sorted.length.toLocaleString('pl-PL')} pozycji (strona {safePage}/{totalPages})
        </span>
        <div className="flex items-center gap-2">
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
          >
            <option value={50}>50 / str.</option>
            <option value={100}>100 / str.</option>
            <option value={250}>250 / str.</option>
            <option value={sorted.length || 1}>Wszystkie</option>
          </select>
          <button
            type="button"
            disabled={safePage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-lg border border-slate-700 px-3 py-1.5 disabled:opacity-40"
          >
            Poprzednia
          </button>
          <button
            type="button"
            disabled={safePage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="rounded-lg border border-slate-700 px-3 py-1.5 disabled:opacity-40"
          >
            Następna
          </button>
        </div>
      </div>

      <a
        href={CATALOG_PRODUCT_URL}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 text-xs font-medium text-brand-400 hover:text-brand-300"
      >
        Otwórz katalog <ExternalLink className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}
