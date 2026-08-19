import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  Boxes,
  CheckCircle2,
  ClipboardList,
  Loader2,
  MapPin,
  Minus,
  PackageCheck,
  Plus,
  Printer,
  RefreshCw,
  Search,
} from 'lucide-react';
import type { Product, View } from '../../types';
import { useAuth } from '../../lib/auth';
import { roleCan } from '../../lib/roles';
import { LoginGate } from '../../components/LoginGate';
import { AppHeaderActions } from '../../components/AppHeaderActions';
import { AdminHubPanel } from '../../components/AdminHubPanel';
import { RefreshControls } from '../../components/RefreshControls';
import { WarehouseHubPanel } from '../../components/warehouse/WarehouseHubPanel';
import { ContextHelp } from '../../components/ContextHelp';
import {
  fetchProducts,
  invalidateProductsCache,
  updateProduct,
} from '../../lib/products';
import {
  clearLabelQueue,
  getLabelQueue,
  removeFromLabelQueue,
  type LabelQueueItem,
} from '../../lib/labelQueue';
import { resolveProductLocation } from '../../lib/locationStore';
import { formatLocationCode } from '../../lib/warehouseLocation';
import { showToast } from '../../lib/toast';

type StockTab = 'dashboard' | 'locations' | 'alerts' | 'labels' | 'admin';

function hasLocation(product: Product): boolean {
  return Boolean(formatLocationCode(resolveProductLocation(product.id, product.warehouseLocation)));
}

function stockTone(stock: number): string {
  if (stock <= 0) return 'text-red-800 bg-red-50 border-red-500/40 dark:text-red-300 dark:bg-red-500/10 dark:border-red-500/30';
  if (stock <= 5) return 'text-amber-900 bg-amber-50 border-amber-500/45 dark:text-amber-300 dark:bg-amber-500/10 dark:border-amber-500/30';
  return 'text-emerald-800 bg-emerald-50 border-emerald-500/40 dark:text-emerald-300 dark:bg-emerald-500/10 dark:border-emerald-500/30';
}

function StockMetric({
  label,
  value,
  icon,
  tone = 'border-slate-200 bg-white text-slate-950 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-100',
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  tone?: string;
}) {
  return (
    <div className={`rounded-2xl border p-4 ${tone}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-current opacity-70">{label}</p>
        <span className="text-current opacity-65">{icon}</span>
      </div>
      <p className="mt-3 text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

function StockTabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${
        active
          ? 'bg-brand-600 text-white shadow-sm'
          : 'border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400 dark:hover:border-slate-700 dark:hover:text-slate-100'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function StockDashboard({
  products,
  loading,
  labelQueue,
  onRefresh,
  canSync,
  canEditStock,
  onTab,
  onStockDelta,
}: {
  products: Product[];
  loading: boolean;
  labelQueue: LabelQueueItem[];
  onRefresh: () => void;
  canSync: boolean;
  canEditStock: boolean;
  onTab: (tab: StockTab) => void;
  onStockDelta: (product: Product, delta: number) => void;
}) {
  const zeroStock = products.filter((p) => (p.stock ?? 0) <= 0);
  const lowStock = products.filter((p) => (p.stock ?? 0) > 0 && (p.stock ?? 0) <= 5);
  const unassigned = products.filter((p) => !hasLocation(p));
  const urgent = [...zeroStock, ...lowStock]
    .sort((a, b) => (a.stock ?? 0) - (b.stock ?? 0))
    .slice(0, 8);

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/70 dark:shadow-none sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-400">
              Centrum magazynu
            </p>
            <h1 className="mt-1 inline-flex items-center gap-2 text-2xl font-bold text-slate-950 dark:text-slate-50">
              Operacje magazynowe Kenochem
              <ContextHelp id="warehouse" side="left" />
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              Jeden ekran do kontroli stanow, adresow SKU, etykiet, kompletacji i synchronizacji WAPRO.
            </p>
          </div>
          <RefreshControls
            loading={loading}
            onRefresh={onRefresh}
            canRequestStockSync={canSync}
            catalog="all"
            className="rounded-2xl border border-slate-200 bg-slate-50 px-2 py-1 dark:border-slate-800 dark:bg-slate-950/60"
          />
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StockMetric label="SKU w bazie" value={products.length} icon={<Boxes className="h-5 w-5" />} />
        <StockMetric
          label="Braki"
          value={zeroStock.length}
          icon={<AlertTriangle className="h-5 w-5" />}
          tone="border-red-500/40 bg-red-50 text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200"
        />
        <StockMetric
          label="Niski stan"
          value={lowStock.length}
          icon={<ClipboardList className="h-5 w-5" />}
          tone="border-amber-500/45 bg-amber-50 text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
        />
        <StockMetric
          label="Bez lokalizacji"
          value={unassigned.length}
          icon={<MapPin className="h-5 w-5" />}
          tone="border-sky-500/45 bg-sky-50 text-sky-950 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200"
        />
      </section>

      <section className="grid gap-3 lg:grid-cols-3">
        <button
          type="button"
          onClick={() => onTab('locations')}
          className="group rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-brand-500/40 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900/60 dark:shadow-none dark:hover:bg-slate-900"
        >
          <MapPin className="h-6 w-6 text-brand-400" />
          <h2 className="mt-3 text-sm font-bold text-slate-950 dark:text-slate-100">Mapa magazynu i adresy SKU</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-500">Regaly, strefy, polki i przypisanie produktow do miejsc.</p>
          <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-brand-400">
            Otworz <ArrowUpRight className="h-3.5 w-3.5" />
          </span>
        </button>
        <button
          type="button"
          onClick={() => onTab('labels')}
          className="group rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-brand-500/40 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900/60 dark:shadow-none dark:hover:bg-slate-900"
        >
          <Printer className="h-6 w-6 text-brand-400" />
          <h2 className="mt-3 text-sm font-bold text-slate-950 dark:text-slate-100">Etykiety polkowe</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-500">Druk kolejki etykiet z kodem i adresem magazynowym.</p>
          <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-brand-400">
            {labelQueue.length} w kolejce <ArrowUpRight className="h-3.5 w-3.5" />
          </span>
        </button>
        <button
          type="button"
          onClick={() => onTab('alerts')}
          className="group rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-brand-500/40 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900/60 dark:shadow-none dark:hover:bg-slate-900"
        >
          <PackageCheck className="h-6 w-6 text-brand-400" />
          <h2 className="mt-3 text-sm font-bold text-slate-950 dark:text-slate-100">Kontrola zapasu</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-500">Najpilniejsze braki i szybkie korekty stanow.</p>
          <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-brand-400">
            Przejrzyj <ArrowUpRight className="h-3.5 w-3.5" />
          </span>
        </button>
      </section>

      <StockAlertsTable
        products={urgent}
        canEditStock={canEditStock}
        onStockDelta={onStockDelta}
        emptyText="Brak pilnych stanow do poprawy."
      />
    </div>
  );
}

function StockAlertsTable({
  products,
  canEditStock,
  onStockDelta,
  emptyText,
}: {
  products: Product[];
  canEditStock: boolean;
  onStockDelta: (product: Product, delta: number) => void;
  emptyText: string;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/60 dark:shadow-none">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <div>
          <h2 className="text-sm font-bold text-slate-950 dark:text-slate-100">Najpilniejsze pozycje</h2>
          <p className="text-xs text-slate-600 dark:text-slate-500">Braki i niskie stany do reakcji magazynu.</p>
        </div>
      </div>
      {products.length === 0 ? (
        <div className="px-4 py-10 text-center text-sm text-slate-500">{emptyText}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600 dark:bg-slate-950/50 dark:text-slate-500">
              <tr>
                <th className="px-4 py-3">Produkt</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Adres</th>
                <th className="px-4 py-3 text-right">Stan</th>
                {canEditStock && <th className="px-4 py-3 text-right">Korekta</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {products.map((product) => {
                const location = formatLocationCode(
                  resolveProductLocation(product.id, product.warehouseLocation),
                );
                return (
                  <tr key={product.id} className="hover:bg-slate-50 dark:hover:bg-slate-950/30">
                    <td className="max-w-[22rem] px-4 py-3">
                      <p className="truncate font-medium text-slate-950 dark:text-slate-100">{product.displayName}</p>
                      <p className="truncate text-xs text-slate-600 dark:text-slate-500">{product.category || 'Bez kategorii'}</p>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-400">{product.sku || '-'}</td>
                    <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400">{location || 'Brak'}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`rounded-full border px-2 py-1 text-xs font-bold ${stockTone(product.stock ?? 0)}`}>
                        {product.stock ?? 0}
                      </span>
                    </td>
                    {canEditStock && (
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => onStockDelta(product, -1)}
                            className="rounded-lg border border-slate-300 p-1.5 text-slate-600 hover:border-red-500/50 hover:text-red-700 dark:border-slate-700 dark:text-slate-400 dark:hover:text-red-300"
                            aria-label="Zmniejsz stan"
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onStockDelta(product, 1)}
                            className="rounded-lg border border-slate-300 p-1.5 text-slate-600 hover:border-brand-500/50 hover:text-brand-700 dark:border-slate-700 dark:text-slate-400 dark:hover:text-brand-300"
                            aria-label="Zwieksz stan"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function StockLabelsPanel({
  queue,
  onRefresh,
}: {
  queue: LabelQueueItem[];
  onRefresh: () => void;
}) {
  const printAll = () => {
    void import('../../lib/printLabel').then(({ printShelfLabels }) => {
      printShelfLabels(queue);
    });
  };

  const printOne = (item: LabelQueueItem) => {
    void import('../../lib/printLabel').then(({ printShelfLabels }) => {
      printShelfLabels([item]);
    });
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="inline-flex items-center gap-2 text-xl font-bold text-slate-950 dark:text-slate-50">
            Etykiety polkowe
            <ContextHelp id="labels" />
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-500">Kolejka druku dla regalu, pojemnika i kodu kreskowego.</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:text-slate-100"
          >
            <RefreshCw className="h-4 w-4" />
            Odswiez
          </button>
          <button
            type="button"
            onClick={() => {
              clearLabelQueue();
              onRefresh();
              showToast('Wyczyszczono kolejke etykiet', 'info');
            }}
            disabled={queue.length === 0}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950 disabled:opacity-40 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:text-slate-100"
          >
            Wyczysc
          </button>
          <button
            type="button"
            onClick={printAll}
            disabled={queue.length === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-3 py-2 text-sm font-bold text-white hover:bg-brand-500 disabled:opacity-40"
          >
            <Printer className="h-4 w-4" />
            Drukuj
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/60 dark:shadow-none">
        {queue.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-slate-500">Kolejka etykiet jest pusta.</div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {queue.map((item) => (
              <div key={item.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-950 dark:text-slate-100">{item.displayName}</p>
                  <p className="text-xs text-slate-600 dark:text-slate-500">
                    {item.sku} {item.locationCode ? `- ${item.locationCode}` : '- bez adresu'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => printOne(item)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-brand-500/60 hover:text-brand-700 dark:border-slate-700 dark:text-slate-300 dark:hover:text-brand-300"
                >
                  Drukuj
                </button>
                <button
                  type="button"
                  onClick={() => {
                    removeFromLabelQueue(item.id);
                    onRefresh();
                  }}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-red-500/60 hover:text-red-700 dark:border-slate-700 dark:text-slate-400 dark:hover:text-red-300"
                >
                  Usun
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function StockSearchPanel({
  products,
  canEditStock,
  onStockDelta,
}: {
  products: Product[];
  canEditStock: boolean;
  onStockDelta: (product: Product, delta: number) => void;
}) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = products.filter((p) => (p.stock ?? 0) <= 5);
    if (!q) return base.slice(0, 80);
    return products
      .filter((p) =>
        [p.displayName, p.name, p.sku, p.ean, p.category]
          .join(' ')
          .toLowerCase()
          .includes(q),
      )
      .slice(0, 80);
  }, [products, query]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="inline-flex items-center gap-2 text-xl font-bold text-slate-950 dark:text-slate-50">
            Kontrola zapasu
            <ContextHelp id="warehouse" />
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-500">Braki, niskie stany i szybkie korekty bez wchodzenia do katalogu.</p>
        </div>
        <label className="flex min-w-0 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:shadow-none sm:w-96">
          <Search className="h-4 w-4 shrink-0 text-slate-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Szukaj SKU, EAN, nazwy..."
            className="min-w-0 flex-1 bg-transparent text-sm text-slate-950 outline-none placeholder:text-slate-500 dark:text-slate-100 dark:placeholder:text-slate-600"
          />
        </label>
      </div>
      <StockAlertsTable
        products={filtered}
        canEditStock={canEditStock}
        onStockDelta={onStockDelta}
        emptyText="Brak pozycji dla tego filtra."
      />
    </div>
  );
}

export function StockProductApp() {
  const { mode, role } = useAuth();
  const [tab, setTab] = useState<StockTab>('dashboard');
  const [products, setProducts] = useState<Product[]>([]);
  const [labels, setLabels] = useState<LabelQueueItem[]>(() => getLabelQueue());
  const [loading, setLoading] = useState(true);

  const canEditStock = roleCan(role, 'editStock');
  const canPrintLabels = roleCan(role, 'printLabels');
  const canAdmin = roleCan(role, 'manageUsers') || roleCan(role, 'viewRoleMatrix');
  const headerView: View = tab === 'admin' ? 'admin' : 'warehouse';

  const refreshLabels = useCallback(() => setLabels(getLabelQueue()), []);

  const loadProducts = useCallback(async (force = false) => {
    setLoading(true);
    try {
      if (force) invalidateProductsCache();
      const next = force
        ? await fetchProducts(undefined, { force: true, source: 'supabase' })
        : await fetchProducts(undefined, { source: 'json' });
      setProducts(next);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Nie udalo sie pobrac danych magazynu', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (mode === 'gate' || mode === 'loading') return;
    void loadProducts();
  }, [loadProducts, mode]);

  const handleLocationSaved = useCallback((productId: string, location: Product['warehouseLocation']) => {
    setProducts((prev) =>
      prev.map((product) =>
        product.id === productId ? { ...product, warehouseLocation: location } : product,
      ),
    );
  }, []);

  const handleStockDelta = useCallback(
    (product: Product, delta: number) => {
      if (!canEditStock) return;
      const nextStock = Math.max(0, Math.round((product.stock ?? 0) + delta));
      const prevStock = product.stock ?? 0;
      setProducts((prev) =>
        prev.map((p) =>
          p.id === product.id ? { ...p, stock: nextStock, stockManual: true } : p,
        ),
      );
      void updateProduct(product.id, { stock: nextStock, stockManual: true })
        .then(() => showToast('Zapisano korekte stanu', 'ok', 1600))
        .catch((err) => {
          setProducts((prev) =>
            prev.map((p) =>
              p.id === product.id ? { ...p, stock: prevStock, stockManual: product.stockManual } : p,
            ),
          );
          showToast(err instanceof Error ? err.message : 'Nie udalo sie zapisac stanu', 'error');
        });
    },
    [canEditStock],
  );

  if (mode === 'loading') {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-brand-400" />
      </div>
    );
  }

  if (mode === 'gate') {
    return <LoginGate />;
  }

  return (
    <div className="stock-app min-h-dvh bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-slate-100">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 pt-[env(safe-area-inset-top)] shadow-sm supports-[backdrop-filter]:backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-950/95 dark:shadow-none">
        <div className="flex flex-wrap items-center gap-2 px-3 py-2 sm:px-4 xl:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <img src="/icons/stock-icon-192.png" alt="" className="h-10 w-10 rounded-xl" />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-950 dark:text-slate-100">Kenochem Magazyn</p>
              <p className="truncate text-[11px] text-slate-600 dark:text-slate-500">Stany, lokalizacje, etykiety i dostawy</p>
            </div>
          </div>
          <div className="min-w-0 flex-1" />
          <AppHeaderActions
            role={role}
            view={headerView}
            onOpenAdmin={() => setTab('admin')}
            onNavigate={(view) => {
              if (view === 'admin') setTab('admin');
            }}
            showAdminShortcut={canAdmin}
          />
        </div>
        <nav className="flex gap-2 overflow-x-auto px-3 pb-3 sm:px-4 xl:px-5">
          <StockTabButton
            active={tab === 'dashboard'}
            onClick={() => setTab('dashboard')}
            icon={<Boxes className="h-4 w-4" />}
            label="Pulpit"
          />
          <StockTabButton
            active={tab === 'locations'}
            onClick={() => setTab('locations')}
            icon={<MapPin className="h-4 w-4" />}
            label="Lokalizacje"
          />
          <StockTabButton
            active={tab === 'alerts'}
            onClick={() => setTab('alerts')}
            icon={<AlertTriangle className="h-4 w-4" />}
            label="Stany"
          />
          {canPrintLabels && (
            <StockTabButton
              active={tab === 'labels'}
              onClick={() => {
                refreshLabels();
                setTab('labels');
              }}
              icon={<Printer className="h-4 w-4" />}
              label={`Etykiety${labels.length ? ` (${labels.length})` : ''}`}
            />
          )}
          <a
            href="https://kenochem-f4a5b.web.app/"
            className="ml-auto hidden items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400 dark:hover:border-slate-700 dark:hover:text-slate-100 sm:inline-flex"
          >
            Suite
            <ArrowUpRight className="h-4 w-4" />
          </a>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-7xl px-3 py-5 sm:px-5 sm:py-7">
        {loading && products.length === 0 ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-brand-400" />
          </div>
        ) : tab === 'admin' && canAdmin ? (
          <AdminHubPanel
            product="stock"
            onBack={() => setTab('dashboard')}
            backLabel="Wroc do magazynu"
            title="Administracja Magazynu"
            description="Uzytkownicy i uprawnienia dla pracy magazynowej."
          />
        ) : tab === 'locations' ? (
          <WarehouseHubPanel
            products={products}
            labelQueueCount={labels.length}
            onOpenLabels={() => {
              refreshLabels();
              setTab('labels');
            }}
            onLocationSaved={handleLocationSaved}
          />
        ) : tab === 'labels' && canPrintLabels ? (
          <StockLabelsPanel queue={labels} onRefresh={refreshLabels} />
        ) : tab === 'alerts' ? (
          <StockSearchPanel
            products={products}
            canEditStock={canEditStock}
            onStockDelta={handleStockDelta}
          />
        ) : (
          <StockDashboard
            products={products}
            loading={loading}
            labelQueue={labels}
            onRefresh={() => void loadProducts(true)}
            canSync={canEditStock}
            canEditStock={canEditStock}
            onTab={setTab}
            onStockDelta={handleStockDelta}
          />
        )}
      </main>

      <div className="fixed bottom-4 right-4 hidden rounded-full border border-emerald-500/40 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 shadow-xl shadow-slate-300/40 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200 dark:shadow-black/30 sm:flex">
        <CheckCircle2 className="mr-2 h-4 w-4" />
        Magazyn jako osobna aplikacja
      </div>
    </div>
  );
}
