import { useEffect, useState, useCallback, useMemo, useDeferredValue, lazy, Suspense, useRef } from 'react';
import {
  Search,
  Layers,
  ImageOff,
  Loader2,
  Plus,
  BarChart3,
  Wrench,
  ShoppingBag,
  Sparkles,
  Sun,
  Moon,
  Pencil,
  Star,
  Printer,
  Trash2,
  LogOut,
  Users,
  LayoutGrid,
  Rows2,
  Square,
  SlidersHorizontal,
  X,
  ShoppingCart,
  Calculator,
} from 'lucide-react';
import type { Product, Kit, View, CatalogType } from './types';
import { CATALOG_LABELS, deriveCategories } from './types';
import { fetchProducts, fetchKits, getProductImage, updateProduct, invalidateProductsCache } from './lib/products';
import {
  applyCatalogFilters,
  filterProducts,
  CATALOG_SORT_OPTIONS,
  LOW_STOCK_MAX,
  type CatalogSort,
  type StockFilter,
  type ImageFilter,
} from './lib/search';
import { useTheme } from './lib/theme';
import { loadAndMergeFavorites, getLocalFavoriteIds, setCloudFavorite, setLocalFavorite } from './lib/favorites';
import {
  getOrderDraft,
  addToOrderDraft,
  removeDraftItem,
  setDraftItemQty,
} from './lib/orderDraft';
import { showToast } from './lib/toast';
import {
  getLabelQueue,
  removeFromLabelQueue,
  clearLabelQueue,
  type LabelQueueItem,
} from './lib/labelQueue';
import { ProductCard } from './components/ProductCard';
import { SearchBar } from './components/SearchBar';
import { ProductGrid } from './components/ProductGrid';
import { InstallAppHint, resetInstallHint } from './components/InstallAppHint';
import { LoginGate } from './components/LoginGate';
import { RefreshControls } from './components/RefreshControls';
import { MobileBottomNav, MobileMoreSheet } from './components/MobileNav';
import { requestWaproStockSync, getLatestStockSync } from './lib/stockSync';
import {
  getDeferredInstall,
} from './lib/pwaInstall';
import { useAuth } from './lib/auth';
import { roleCan, ROLE_LABELS } from './lib/roles';

const KitsView = lazy(() =>
  import('./components/KitsView').then((m) => ({ default: m.KitsView })),
);
const AddProductModal = lazy(() =>
  import('./components/AddProductModal').then((m) => ({ default: m.AddProductModal })),
);
const BarcodeScanner = lazy(() =>
  import('./components/BarcodeScanner').then((m) => ({ default: m.BarcodeScanner })),
);
const PhotoProgressView = lazy(() =>
  import('./components/PhotoProgressView').then((m) => ({ default: m.PhotoProgressView })),
);
const VisualSearchModal = lazy(() =>
  import('./components/VisualSearchModal').then((m) => ({ default: m.VisualSearchModal })),
);
const AdminUsersPanel = lazy(() =>
  import('./components/AdminUsersPanel').then((m) => ({ default: m.AdminUsersPanel })),
);
const RoleMatrixPanel = lazy(() =>
  import('./components/RoleMatrixPanel').then((m) => ({ default: m.RoleMatrixPanel })),
);
const EanHygieneView = lazy(() =>
  import('./components/EanHygieneView').then((m) => ({ default: m.EanHygieneView })),
);
const ProductDetail = lazy(() =>
  import('./components/ProductDetail').then((m) => ({ default: m.ProductDetail })),
);
const CrmOrderView = lazy(() =>
  import('./components/CrmOrderView').then((m) => ({ default: m.CrmOrderView })),
);
const OpsHubView = lazy(() =>
  import('./components/OpsHubView').then((m) => ({ default: m.OpsHubView })),
);
const CrmOrderSidePanel = lazy(() =>
  import('./components/CrmOrderSidePanel').then((m) => ({
    default: m.CrmOrderSidePanel,
  })),
);

const CATALOG_STORAGE_KEY = 'katalog-active-catalog';
const SORT_STORAGE_KEY = 'katalog-sort';
const GRID_DENSITY_KEY = 'katalog-grid-density';

type GridDensity = 'sm' | 'md' | 'lg';

function loadGridDensity(): GridDensity {
  try {
    const v = localStorage.getItem(GRID_DENSITY_KEY);
    if (v === 'sm' || v === 'md' || v === 'lg') return v;
  } catch {
    /* ignore */
  }
  return 'md';
}

const GRID_CLASS: Record<GridDensity, string> = {
  sm: 'grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10',
  md: 'grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7',
  /** Duże = mniej w rzędzie, większe zdjęcia (karty pionowe). */
  lg: 'grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-3',
};


function loadSavedSort(): CatalogSort {
  try {
    const v = localStorage.getItem(SORT_STORAGE_KEY);
    if (CATALOG_SORT_OPTIONS.some((o) => o.value === v)) return v as CatalogSort;
  } catch {
    /* ignore */
  }
  return 'category';
}

function loadSavedCatalog(): CatalogType {
  try {
    const v = localStorage.getItem(CATALOG_STORAGE_KEY);
    return v === 'shop' ? 'shop' : 'accessories';
  } catch {
    return 'accessories';
  }
}

export default function App() {
  const { toggleTheme, isDark } = useTheme();
  const {
    mode,
    user,
    role,
    displayLabel,
    signOut,
    exitGuest,
  } = useAuth();
  const [catalogCache, setCatalogCache] = useState<
    Partial<Record<CatalogType, Product[]>>
  >({});
  const [kits, setKits] = useState<Kit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCatalog, setActiveCatalog] = useState<CatalogType>(loadSavedCatalog);
  const [view, setView] = useState<View>('catalog');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Wszystkie');
  const [sort, setSort] = useState<CatalogSort>(loadSavedSort);
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const [imageFilter, setImageFilter] = useState<ImageFilter>('all');
  const [editMode, setEditMode] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => getLocalFavoriteIds());
  const [orderCount, setOrderCount] = useState(() => getOrderDraft().items.length);
  const [orderRevision, setOrderRevision] = useState(0);
  const [orderQtys, setOrderQtys] = useState<Record<string, number>>(() => {
    const items = getOrderDraft().items;
    return Object.fromEntries(items.map((i) => [i.productId, i.quantity]));
  });
  const [labelQueue, setLabelQueue] = useState<LabelQueueItem[]>(() => getLabelQueue());
  const [stockBusyId, setStockBusyId] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [showVisualSearch, setShowVisualSearch] = useState(false);
  const [showAdminUsers, setShowAdminUsers] = useState(false);
  const [showRoleMatrix, setShowRoleMatrix] = useState(false);
  const [missingCategory, setMissingCategory] = useState('Wszystkie');
  const [gridDensity, setGridDensity] = useState<GridDensity>(loadGridDensity);
  const [showMobileMore, setShowMobileMore] = useState(false);
  const [syncBusy, setSyncBusy] = useState(false);

  function patchProductInCache(
    productId: string,
    patch: Partial<Product> | ((p: Product) => Product),
  ) {
    setCatalogCache((prev) => {
      const next = { ...prev };
      for (const key of ['accessories', 'shop'] as const) {
        const list = next[key];
        if (!list) continue;
        const idx = list.findIndex((p) => p.id === productId);
        if (idx < 0) continue;
        const copy = [...list];
        const cur = copy[idx];
        copy[idx] = typeof patch === 'function' ? patch(cur) : { ...cur, ...patch };
        next[key] = copy;
      }
      return next;
    });
  }

  function changeGridDensity(next: GridDensity) {
    setGridDensity(next);
    try {
      localStorage.setItem(GRID_DENSITY_KEY, next);
    } catch {
      /* ignore */
    }
  }

  function triggerInstallApp() {
    if (getDeferredInstall()) {
      try {
        localStorage.removeItem('katalog-pwa-hint-dismissed');
      } catch {
        /* ignore */
      }
      window.dispatchEvent(new Event('katalog-show-install'));
      return;
    }
    resetInstallHint();
  }

  async function handleSyncStock() {
    setSyncBusy(true);
    try {
      const res = await requestWaproStockSync(activeCatalog);
      if (!res.ok) {
        showToast(res.error || 'Nie udało się zlecić syncu', 'error');
        return;
      }
      const label = activeCatalog === 'shop' ? 'Produkty' : 'Akcesoria';
      showToast(`Sync WAPRO (${label}): stany i ceny — czekam…`, 'info', 4000);
      const started = Date.now();
      while (Date.now() - started < 180_000) {
        await new Promise((r) => setTimeout(r, 4000));
        const last = await getLatestStockSync();
        if (!last) continue;
        if (res.id && last.id !== res.id) continue;
        if (last.status === 'done') {
          showToast(last.message || `Sync ${label} zakończony`, 'ok', 7000);
          invalidateProductsCache();
          void loadData();
          return;
        }
        if (last.status === 'error') {
          showToast(last.message || 'Sync WAPRO — błąd', 'error', 8000);
          return;
        }
      }
      showToast('Sync nadal trwa — sprawdź sync.log na serwerze WAPRO', 'info', 8000);
    } finally {
      setSyncBusy(false);
    }
  }

  useEffect(() => {
    if (!roleCan(role, 'editStock')) setEditMode(false);
    if (!roleCan(role, 'printLabels') && view === 'labels') setView('catalog');
    if (!roleCan(role, 'viewProgress') && view === 'progress') setView('catalog');
    if (!roleCan(role, 'manageFavorites') && view === 'favorites') setView('catalog');
    if (!roleCan(role, 'manageKits') && view === 'kits') setView('catalog');
    if (!roleCan(role, 'viewOps') && view === 'ops') setView('catalog');
    if (!roleCan(role, 'viewRoleMatrix') && view === 'role-matrix') setView('catalog');
    if (
      !roleCan(role, 'editProduct') &&
      !roleCan(role, 'manageUsers') &&
      view === 'ean-hygiene'
    ) {
      setView('catalog');
    }
  }, [role, view]);

  useEffect(() => {
    let cancelled = false;
    async function syncFavorites() {
      if (mode === 'signed_in' && user?.id) {
        try {
          const ids = await loadAndMergeFavorites(user.id);
          if (!cancelled) setFavoriteIds(ids);
        } catch (err) {
          console.warn('favorites load', err);
          if (!cancelled) {
            setFavoriteIds(getLocalFavoriteIds());
            showToast('Nie udało się wczytać ulubionych z chmury', 'warn');
          }
        }
        return;
      }
      if (!cancelled) setFavoriteIds(getLocalFavoriteIds());
    }
    void syncFavorites();
    return () => {
      cancelled = true;
    };
  }, [mode, user?.id]);

  const allProducts = useMemo(
    () => [...(catalogCache.accessories ?? []), ...(catalogCache.shop ?? [])],
    [catalogCache],
  );

  const products = useMemo(
    () => allProducts.filter((p) => (p.catalog || 'accessories') === activeCatalog),
    [allProducts, activeCatalog],
  );

  const catalogCacheRef = useRef(catalogCache);
  catalogCacheRef.current = catalogCache;

  const loadCatalog = useCallback(async (catalog: CatalogType, force = false) => {
    if (!force && (catalogCacheRef.current[catalog]?.length ?? 0) > 0) return;
    const prods = await fetchProducts(catalog, { force });
    setCatalogCache((prev) => ({ ...prev, [catalog]: prods }));
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      invalidateProductsCache(activeCatalog);
      const prods = await fetchProducts(activeCatalog, { force: true });
      setCatalogCache((prev) => ({ ...prev, [activeCatalog]: prods }));
      void fetchKits()
        .then(setKits)
        .catch((err) => console.warn('kits', err));
    } catch (err) {
      console.error(err);
      setError(
        'Nie udało się załadować katalogu. Sprawdź połączenie z internetem.',
      );
    } finally {
      setLoading(false);
    }
  }, [activeCatalog]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // cache hit — nie blokuj UI
      if ((catalogCache[activeCatalog]?.length ?? 0) > 0) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const prods = await fetchProducts(activeCatalog);
        if (cancelled) return;
        setCatalogCache((prev) => ({ ...prev, [activeCatalog]: prods }));
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setError(
            'Nie udało się załadować katalogu. Sprawdź połączenie z internetem.',
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tylko przy zmianie katalogu
  }, [activeCatalog]);

  /** Prefetch drugiego katalogu dopiero gdy UI jest wolne — mniej zamulania na telefonie. */
  useEffect(() => {
    if (loading) return;
    if ((catalogCache[activeCatalog]?.length ?? 0) === 0) return;
    const other: CatalogType =
      activeCatalog === 'shop' ? 'accessories' : 'shop';
    if ((catalogCache[other]?.length ?? 0) > 0) return;

    let cancelled = false;
    const run = () => {
      if (cancelled || document.visibilityState === 'hidden') return;
      void loadCatalog(other);
    };

    let idleId: number | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (typeof w.requestIdleCallback === 'function') {
      idleId = w.requestIdleCallback(run, { timeout: 4000 });
    } else {
      timeoutId = setTimeout(run, 2500);
    }

    return () => {
      cancelled = true;
      if (idleId != null && typeof w.cancelIdleCallback === 'function') {
        w.cancelIdleCallback(idleId);
      }
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [loading, activeCatalog, catalogCache, loadCatalog]);

  useEffect(() => {
    if (view === 'favorites') {
      void loadCatalog('accessories');
      void loadCatalog('shop');
    }
  }, [view, loadCatalog]);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      if (cancelled) return;
      void fetchKits()
        .then(setKits)
        .catch((err) => console.warn('kits', err));
    };
    const t = setTimeout(load, 800);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, []);

  const switchCatalog = useCallback((next: CatalogType) => {
    setActiveCatalog(next);
    try {
      localStorage.setItem(CATALOG_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    setSearch('');
    setCategory('Wszystkie');
    setStockFilter('all');
    setImageFilter('all');
    setView('catalog');
    setSelectedProduct(null);
    setMissingCategory('Wszystkie');
  }, []);

  const categoryList = useMemo(() => deriveCategories(products), [products]);

  const deferredSearch = useDeferredValue(search);
  const favoriteSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);

  const filtered = useMemo(() => {
    const base =
      view === 'favorites'
        ? products.filter((p) => favoriteSet.has(p.id))
        : products;
    return applyCatalogFilters(base, {
      search: deferredSearch,
      category,
      sort,
      stockFilter,
      imageFilter,
    });
  }, [products, deferredSearch, category, sort, stockFilter, imageFilter, view, favoriteSet]);

  const favoriteCount = useMemo(
    () => products.reduce((n, p) => n + (favoriteSet.has(p.id) ? 1 : 0), 0),
    [products, favoriteSet],
  );

  const handleSortChange = useCallback((next: CatalogSort) => {
    setSort(next);
    try {
      localStorage.setItem(SORT_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const handleToggleFavorite = useCallback(
    async (productId: string) => {
      let wasOn = false;
      let nextOn = false;
      setFavoriteIds((prev) => {
        wasOn = prev.includes(productId);
        nextOn = !wasOn;
        return nextOn
          ? [productId, ...prev.filter((id) => id !== productId)]
          : prev.filter((id) => id !== productId);
      });

      if (mode === 'signed_in' && user?.id) {
        try {
          await setCloudFavorite(user.id, productId, nextOn);
          showToast(nextOn ? 'Dodano do ulubionych' : 'Usunięto z ulubionych', nextOn ? 'ok' : 'info');
        } catch (err) {
          console.error(err);
          setFavoriteIds((prev) =>
            wasOn
              ? [productId, ...prev.filter((id) => id !== productId)]
              : prev.filter((id) => id !== productId),
          );
          showToast('Nie udało się zapisać ulubionych', 'error');
        }
        return;
      }

      setLocalFavorite(productId, nextOn);
      showToast(nextOn ? 'Dodano do ulubionych' : 'Usunięto z ulubionych', nextOn ? 'ok' : 'info');
    },
    [mode, user?.id],
  );

  const refreshOrderCount = useCallback(() => {
    const items = getOrderDraft().items;
    setOrderCount(items.length);
    setOrderQtys(Object.fromEntries(items.map((i) => [i.productId, i.quantity])));
    setOrderRevision((n) => n + 1);
  }, []);

  const handleOrderDelta = useCallback(
    (product: Product, delta: number) => {
      if (delta > 0) {
        addToOrderDraft(
          {
            ...product,
            imageUrl: getProductImage(product) || undefined,
          },
          delta,
        );
      } else {
        const current = getOrderDraft().items.find((i) => i.productId === product.id);
        if (!current) return;
        const next = current.quantity + delta;
        if (next <= 0) removeDraftItem(product.id);
        else setDraftItemQty(product.id, next);
      }
      refreshOrderCount();
    },
    [refreshOrderCount],
  );

  const refreshLabelQueue = useCallback(() => {
    setLabelQueue(getLabelQueue());
  }, []);

  const handleStockDelta = useCallback(
    async (product: Product, delta: number) => {
      const next = Math.max(0, Math.round((product.stock ?? 0) + delta));
      setStockBusyId(product.id);
      patchProductInCache(product.id, { stock: next, stockManual: true });
      try {
        await updateProduct(product.id, { stock: next, stockManual: true });
        showToast(`Stan: ${next}`, 'ok', 1800);
      } catch (err) {
        console.error(err);
        patchProductInCache(product.id, {
          stock: product.stock,
          stockManual: product.stockManual,
        });
        showToast('Nie udało się zapisać stanu', 'error');
      } finally {
        setStockBusyId(null);
      }
    },
    [],
  );

  const missingImages = useMemo(
    () => products.filter((p) => !getProductImage(p)),
    [products],
  );

  const handleImageUpdated = useCallback(
    (productId: string, url: string) => {
      patchProductInCache(productId, { customImageUrl: url, hasImage: true });
      if (selectedProduct?.id === productId) {
        setSelectedProduct((prev) =>
          prev ? { ...prev, customImageUrl: url, hasImage: true } : null,
        );
      }
    },
    [selectedProduct],
  );

  const handleProductUpdated = useCallback((updated: Product) => {
    patchProductInCache(updated.id, () => updated);
    if (selectedProduct?.id === updated.id) {
      setSelectedProduct((prev) => (prev ? { ...prev, ...updated } : null));
    }
  }, [selectedProduct]);

  const openMissingImages = useCallback((categoryFilter = 'Wszystkie') => {
    setMissingCategory(categoryFilter);
    setView('missing-images');
  }, []);

  const handleBarcodeScan = useCallback(
    (code: string) => {
      const trimmed = code.trim();
      if (!trimmed) return;
      setView('catalog');
      setCategory('Wszystkie');
      setSearch(trimmed);
      const matches = filterProducts(products, trimmed, 'Wszystkie');
      if (matches.length === 1) {
        setSelectedProduct(matches[0]);
      }
    },
    [products],
  );

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { Wszystkie: products.length };
    for (const p of products) {
      counts[p.category] = (counts[p.category] || 0) + 1;
    }
    return counts;
  }, [products]);

  if (mode === 'loading') {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-brand-400" />
      </div>
    );
  }

  if (mode === 'gate') {
    return <LoginGate />;
  }

  return (
    <div
      className={`app-shell relative mx-auto min-h-dvh w-full max-w-none pb-[calc(4.25rem+env(safe-area-inset-bottom))] lg:pb-0 ${
        editMode ? 'ring-2 ring-inset ring-amber-500' : ''
      }`}
    >
      {editMode && (
        <div
          className="pointer-events-none fixed inset-0 z-[70] border-[3px] border-amber-500"
          aria-hidden
        />
      )}
      <header className="border-b border-slate-800/80 bg-slate-950 pt-[env(safe-area-inset-top)]">
        {/* Mobile: logo + switch; Desktop (lg+): pełny pasek */}
        <div className="flex flex-col gap-2 px-3 py-2 sm:px-4 lg:flex-row lg:items-center lg:gap-3 lg:py-3 xl:px-6">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3 lg:min-w-[12rem]">
            <a
              href="https://kenochem.com"
              target="_blank"
              rel="noreferrer"
              className="flex shrink-0 items-center"
              title="Kenochem.com"
            >
              <img
                src="/kenochem-logo.webp"
                alt="Kenochem"
                className="kenochem-logo"
              />
            </a>
            <div className="hidden min-w-0 flex-1 sm:block lg:hidden">
              <h1 className="truncate text-base font-bold tracking-tight text-slate-100">
                Katalog
              </h1>
            </div>
          </div>

          <div className="w-full shrink-0 lg:w-auto lg:min-w-[16rem]">
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-900 p-1 ring-1 ring-slate-800">
              <CatalogSwitch
                active={activeCatalog === 'accessories'}
                onClick={() => switchCatalog('accessories')}
                icon={<Wrench className="h-4 w-4 shrink-0" />}
                label={CATALOG_LABELS.accessories}
              />
              <CatalogSwitch
                active={activeCatalog === 'shop'}
                onClick={() => switchCatalog('shop')}
                icon={<ShoppingBag className="h-4 w-4 shrink-0" />}
                label={CATALOG_LABELS.shop}
              />
            </div>
          </div>

          {/* Desktop actions — ukryte na mobile (są w Więcej) */}
          <div className="ml-auto hidden gap-1.5 lg:flex lg:flex-wrap lg:justify-end">
            <div
              className="flex shrink-0 items-center rounded-lg border border-slate-700 px-2.5 py-1.5"
              title={ROLE_LABELS[role]}
            >
              <span className="max-w-[10rem] truncate text-sm font-medium text-slate-200">
                {displayLabel}
              </span>
            </div>
            {roleCan(role, 'manageUsers') && (
              <button
                type="button"
                onClick={() => setShowAdminUsers(true)}
                className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800"
                title="Zarządzaj użytkownikami"
              >
                <Users className="h-4 w-4" />
                Konta
              </button>
            )}
            {roleCan(role, 'viewRoleMatrix') && (
              <button
                type="button"
                onClick={() => setShowRoleMatrix(true)}
                className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800"
                title="Podgląd uprawnień ról"
              >
                Uprawnienia
              </button>
            )}
            {(roleCan(role, 'editProduct') || roleCan(role, 'manageUsers')) && (
              <button
                type="button"
                onClick={() => setView('ean-hygiene')}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                  view === 'ean-hygiene'
                    ? 'border-amber-500/50 bg-amber-500/15 text-amber-200'
                    : 'border-slate-700 text-slate-300 hover:bg-slate-800'
                }`}
                title="Higiena EAN"
              >
                EAN
              </button>
            )}
            {roleCan(role, 'addProduct') && (
              <button
                type="button"
                onClick={() => setShowAddProduct(true)}
                className="flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-500"
              >
                <Plus className="h-4 w-4" />
                Dodaj
              </button>
            )}
            {activeCatalog === 'shop' && roleCan(role, 'useLens') && (
              <button
                type="button"
                onClick={() => setShowVisualSearch(true)}
                className="flex shrink-0 items-center gap-1.5 rounded-lg border border-brand-500/40 bg-brand-500/10 px-3 py-2 text-sm font-medium text-brand-300 hover:bg-brand-500/20"
              >
                <Sparkles className="h-4 w-4" />
                Lens
              </button>
            )}
            {roleCan(role, 'editStock') && (
              <button
                type="button"
                onClick={() => setEditMode((v) => !v)}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  editMode
                    ? 'bg-amber-500 text-amber-950'
                    : 'border border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                }`}
              >
                <Pencil className="h-4 w-4" />
                {editMode ? 'Edycja ON' : 'Edycja'}
              </button>
            )}
            <button
              type="button"
              onClick={toggleTheme}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
              title={isDark ? 'Motyw jasny' : 'Motyw ciemny'}
            >
              {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            <RefreshControls
              loading={loading}
              onRefresh={loadData}
              catalog={activeCatalog}
              canRequestStockSync={
                mode === 'signed_in' && roleCan(role, 'editStock')
              }
            />
            <button
              type="button"
              onClick={() => {
                if (mode === 'guest') exitGuest();
                else void signOut();
              }}
              className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-700 px-3 py-2 text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-slate-100"
              title={mode === 'guest' ? 'Wróć do logowania' : 'Wyloguj'}
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden xl:inline">
                {mode === 'guest' ? 'Logowanie' : 'Wyloguj'}
              </span>
            </button>
          </div>
        </div>

        {/* Desktop nav tabs */}
        <div className="hidden border-t border-slate-800/60 px-3 py-2 sm:px-4 lg:flex lg:items-center lg:gap-4 xl:px-6">
          <nav className="flex min-w-0 flex-1 flex-wrap gap-1">
            <NavTab
              active={view === 'catalog'}
              onClick={() => setView('catalog')}
              icon={<Search className="h-4 w-4" />}
              label="Katalog"
              count={products.length}
            />
            {roleCan(role, 'useCrm') && (
              <NavTab
                active={view === 'crm'}
                onClick={() => setView('crm')}
                icon={<ShoppingCart className="h-4 w-4" />}
                label="Zamówienie"
                count={orderCount}
                highlight={orderCount > 0}
              />
            )}
            {roleCan(role, 'manageFavorites') && (
              <NavTab
                active={view === 'favorites'}
                onClick={() => setView('favorites')}
                icon={<Star className="h-4 w-4" />}
                label="Ulubione"
                count={favoriteCount}
                highlight={favoriteCount > 0}
              />
            )}
            {roleCan(role, 'viewOps') && (
              <NavTab
                active={view === 'ops'}
                onClick={() => setView('ops')}
                icon={<Calculator className="h-4 w-4" />}
                label="Operacje"
              />
            )}
            {activeCatalog === 'accessories' && roleCan(role, 'manageKits') && (
              <NavTab
                active={view === 'kits'}
                onClick={() => setView('kits')}
                icon={<Layers className="h-4 w-4" />}
                label="Zestawy"
                count={kits.length}
              />
            )}
            {roleCan(role, 'viewProgress') && (
              <NavTab
                active={view === 'progress'}
                onClick={() => setView('progress')}
                icon={<BarChart3 className="h-4 w-4" />}
                label="Postęp"
              />
            )}
            {roleCan(role, 'viewProgress') && (
              <NavTab
                active={view === 'missing-images'}
                onClick={() => openMissingImages()}
                icon={<ImageOff className="h-4 w-4" />}
                label="Bez zdjęć"
                count={missingImages.length}
                highlight={missingImages.length > 0}
              />
            )}
            {roleCan(role, 'printLabels') && (
              <NavTab
                active={view === 'labels'}
                onClick={() => {
                  refreshLabelQueue();
                  setView('labels');
                }}
                icon={<Printer className="h-4 w-4" />}
                label="Etykiety"
                count={labelQueue.length}
                highlight={labelQueue.length > 0}
              />
            )}
          </nav>

          {(view === 'catalog' || view === 'favorites') && (
            <div className="hidden min-w-0 flex-[1.4] gap-2 lg:flex">
              <div className="min-w-0 flex-1">
                <SearchBar
                  value={search}
                  onChange={setSearch}
                  onScanClick={() => setShowScanner(true)}
                />
              </div>
              {activeCatalog === 'shop' &&
                view === 'catalog' &&
                roleCan(role, 'useLens') && (
                  <button
                    type="button"
                    onClick={() => setShowVisualSearch(true)}
                    className="flex shrink-0 items-center gap-2 rounded-xl border border-brand-500/40 bg-brand-500/10 px-4 py-2 text-sm font-medium text-brand-200 hover:bg-brand-500/20"
                  >
                    <Sparkles className="h-5 w-5" />
                    Lens
                  </button>
                )}
            </div>
          )}
        </div>
      </header>

      {/* Wyszukiwarka sticky — tylko mobile/tablet; na lg jest w headerze */}
      {(view === 'catalog' || view === 'favorites') && (
        <div className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/95 px-3 py-2 shadow-md shadow-black/10 sm:px-4 lg:hidden supports-[backdrop-filter]:backdrop-blur-md">
          <div className="flex gap-2">
            <div className="min-w-0 flex-1">
              <SearchBar
                value={search}
                onChange={setSearch}
                onScanClick={() => setShowScanner(true)}
              />
            </div>
            {activeCatalog === 'shop' &&
              view === 'catalog' &&
              roleCan(role, 'useLens') && (
              <button
                type="button"
                onClick={() => setShowVisualSearch(true)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-brand-500/40 bg-brand-500/10 text-brand-200 transition hover:bg-brand-500/20"
                title="Lens — rozpoznaj produkt po zdjęciu"
                aria-label="Lens — rozpoznaj produkt po zdjęciu"
              >
                <Sparkles className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>
      )}

      <main
        className={`px-3 py-3 sm:px-4 sm:py-4 xl:px-6 xl:py-5 ${
          roleCan(role, 'useCrm') && orderCount > 0 && view !== 'crm'
            ? 'xl:pr-[24rem]'
            : ''
        }`}
      >
        {loading && products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24">
            <Loader2 className="h-10 w-10 animate-spin text-brand-500" />
            <p className="mt-4 text-slate-400">Ładowanie katalogu...</p>
          </div>
        ) : error && products.length === 0 && allProducts.length === 0 ? (
          <div className="rounded-2xl border border-red-900/50 bg-red-950/30 p-6 text-center">
            <p className="text-red-300">{error}</p>
            <button
              type="button"
              onClick={loadData}
              className="mt-4 rounded-xl bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-500"
            >
              Spróbuj ponownie
            </button>
          </div>
        ) : view === 'catalog' || view === 'favorites' ? (
          <CatalogView
            search={search}
            category={category}
            onCategoryChange={setCategory}
            sort={sort}
            onSortChange={handleSortChange}
            stockFilter={stockFilter}
            onStockFilterChange={setStockFilter}
            imageFilter={imageFilter}
            onImageFilterChange={setImageFilter}
            filtered={filtered}
            categoryList={categoryList}
            categoryCounts={categoryCounts}
            onProductClick={setSelectedProduct}
            editMode={editMode}
            favoriteIds={favoriteIds}
            onToggleFavorite={handleToggleFavorite}
            onStockDelta={handleStockDelta}
            stockBusyId={stockBusyId}
            emptyFavorites={view === 'favorites' && favoriteCount === 0}
            gridDensity={gridDensity}
            onGridDensityChange={changeGridDensity}
            onOrderDelta={roleCan(role, 'useCrm') ? handleOrderDelta : undefined}
            orderQtys={orderQtys}
            hideImages={!roleCan(role, 'viewImages')}
            showPrices={roleCan(role, 'viewPrices')}
          />
        ) : view === 'labels' ? (
          <LabelsView
            queue={labelQueue}
            onRefresh={refreshLabelQueue}
            onRemove={(id) => {
              removeFromLabelQueue(id);
              refreshLabelQueue();
              showToast('Usunięto z kolejki', 'info', 1800);
            }}
            onClear={() => {
              clearLabelQueue();
              refreshLabelQueue();
              showToast('Wyczyszczono kolejkę etykiet', 'info');
            }}
            onPrintAll={() => {
              void import('./lib/printLabel').then(({ printShelfLabels }) => {
                printShelfLabels(labelQueue);
              });
            }}
            onPrintOne={(item) => {
              void import('./lib/printLabel').then(({ printShelfLabels }) => {
                printShelfLabels([item]);
              });
            }}
          />
        ) : view === 'ean-hygiene' &&
          (roleCan(role, 'editProduct') || roleCan(role, 'manageUsers')) ? (
          <Suspense fallback={<ViewFallback />}>
            <EanHygieneView
              products={allProducts}
              onOpenProduct={setSelectedProduct}
            />
          </Suspense>
        ) : view === 'crm' && roleCan(role, 'useCrm') ? (
          <Suspense fallback={<ViewFallback />}>
            <CrmOrderView
              authorLabel={displayLabel}
              products={allProducts}
              cloudEnabled={mode === 'signed_in'}
              onChanged={refreshOrderCount}
            />
          </Suspense>
        ) : view === 'ops' && roleCan(role, 'viewOps') ? (
          <Suspense fallback={<ViewFallback />}>
            <OpsHubView
              products={allProducts}
              canManageKits={roleCan(role, 'manageKits')}
              onOpenKits={() => {
                if (activeCatalog !== 'accessories') {
                  setActiveCatalog('accessories');
                  try {
                    localStorage.setItem(CATALOG_STORAGE_KEY, 'accessories');
                  } catch {
                    /* ignore */
                  }
                }
                setView('kits');
              }}
            />
          </Suspense>
        ) : view === 'kits' &&
          activeCatalog === 'accessories' &&
          roleCan(role, 'manageKits') ? (
          <Suspense fallback={<ViewFallback />}>
            <KitsView
              kits={kits}
              products={products}
              onKitsChange={loadData}
              canAddToOrder={roleCan(role, 'useCrm')}
              onOrderDraftChange={refreshOrderCount}
            />
          </Suspense>
        ) : view === 'progress' ? (
          <Suspense fallback={<ViewFallback />}>
            <PhotoProgressView
              products={products}
              onOpenMissing={(cat) => openMissingImages(cat ?? 'Wszystkie')}
            />
          </Suspense>
        ) : (
          <MissingImagesView
            products={missingImages}
            categoryList={categoryList}
            initialCategory={missingCategory}
            onProductClick={setSelectedProduct}
            onImageUpdated={handleImageUpdated}
            canUpload={roleCan(role, 'uploadImage')}
          />
        )}

        {roleCan(role, 'useCrm') && orderCount > 0 && view !== 'crm' && (
          <Suspense fallback={null}>
            <CrmOrderSidePanel
              products={allProducts}
              revision={orderRevision}
              onOpenFull={() => setView('crm')}
              onChanged={refreshOrderCount}
            />
          </Suspense>
        )}
      </main>

      {selectedProduct && (
        <Suspense fallback={null}>
          <ProductDetail
            product={selectedProduct}
            onClose={() => setSelectedProduct(null)}
            onImageUpdated={handleImageUpdated}
            onProductUpdated={handleProductUpdated}
            onLabelQueueChange={refreshLabelQueue}
            onOrderDraftChange={refreshOrderCount}
            role={role}
          />
        </Suspense>
      )}

      {showAddProduct && (
        <Suspense fallback={null}>
          <AddProductModal
            catalog={activeCatalog}
            existingProducts={products}
            onClose={() => setShowAddProduct(false)}
            onSaved={(product) => {
              const cat = product.catalog || activeCatalog;
              setCatalogCache((prev) => ({
                ...prev,
                [cat]: [...(prev[cat] ?? []), product],
              }));
              setShowAddProduct(false);
            }}
          />
        </Suspense>
      )}

      {showScanner && (
        <Suspense fallback={null}>
          <BarcodeScanner
            onScan={handleBarcodeScan}
            onClose={() => setShowScanner(false)}
          />
        </Suspense>
      )}

      {showVisualSearch && activeCatalog === 'shop' && roleCan(role, 'useLens') && (
        <Suspense fallback={null}>
          <VisualSearchModal
            products={products}
            onClose={() => setShowVisualSearch(false)}
            onSelect={(product) => {
              setSelectedProduct(product);
              setView('catalog');
            }}
          />
        </Suspense>
      )}

      {showAdminUsers && roleCan(role, 'manageUsers') && (
        <Suspense fallback={null}>
          <AdminUsersPanel onClose={() => setShowAdminUsers(false)} />
        </Suspense>
      )}
      {showRoleMatrix && roleCan(role, 'viewRoleMatrix') && (
        <Suspense fallback={null}>
          <RoleMatrixPanel onClose={() => setShowRoleMatrix(false)} />
        </Suspense>
      )}

      <MobileBottomNav
        view={view}
        role={role}
        favoriteCount={favoriteCount}
        labelCount={labelQueue.length}
        orderCount={orderCount}
        onMore={() => setShowMobileMore(true)}
        onView={(v) => {
          if (v === 'labels') refreshLabelQueue();
          if (v === 'missing-images') openMissingImages();
          else setView(v);
        }}
      />

      <MobileMoreSheet
        open={showMobileMore}
        onClose={() => setShowMobileMore(false)}
        role={role}
        displayLabel={displayLabel}
        roleLabel={ROLE_LABELS[role]}
        activeCatalog={activeCatalog}
        view={view}
        editMode={editMode}
        loading={loading}
        syncBusy={syncBusy}
        canRequestStockSync={mode === 'signed_in' && roleCan(role, 'editStock')}
        missingCount={missingImages.length}
        kitsCount={kits.length}
        onView={(v) => {
          if (v === 'labels') refreshLabelQueue();
          if (v === 'missing-images') openMissingImages();
          else setView(v);
        }}
        onToggleEdit={() => setEditMode((v) => !v)}
        onAddProduct={() => setShowAddProduct(true)}
        onLens={() => setShowVisualSearch(true)}
        onAdminUsers={() => setShowAdminUsers(true)}
        onRoleMatrix={() => setShowRoleMatrix(true)}
        onInstallApp={triggerInstallApp}
        onToggleTheme={toggleTheme}
        isDark={isDark}
        onRefresh={loadData}
        onSyncStock={() => void handleSyncStock()}
        onSignOut={() => {
          if (mode === 'guest') exitGuest();
          else void signOut();
        }}
        modeGuest={mode === 'guest'}
      />

      <InstallAppHint />
    </div>
  );
}

function ViewFallback() {
  return (
    <div className="flex justify-center py-16">
      <Loader2 className="h-8 w-8 animate-spin text-brand-400" />
    </div>
  );
}

function CatalogSwitch({
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
      className={`flex min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-medium transition sm:gap-2 sm:px-3 sm:text-sm ${
        active
          ? 'bg-brand-600 text-white shadow'
          : 'text-slate-400 hover:bg-slate-800 hover:text-slate-50'
      }`}
    >
      {icon}
      <span className="truncate">{label}</span>
    </button>
  );
}

function NavTab({
  active,
  onClick,
  icon,
  label,
  count,
  highlight,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count?: number;
  highlight?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition sm:gap-2 sm:px-4 sm:text-sm ${
        active
          ? 'bg-brand-600 text-white'
          : highlight
            ? 'bg-amber-500 text-amber-950 hover:bg-amber-600'
            : 'text-slate-400 hover:bg-slate-800 hover:text-slate-50'
      }`}
    >
      {icon}
      <span>{label}</span>
      {count !== undefined && (
        <span
          className={`rounded-full px-1.5 py-0.5 text-[10px] sm:text-xs ${
            active
              ? 'bg-black/20 text-white'
              : highlight
                ? 'bg-amber-950/15 text-amber-950'
                : 'bg-slate-700 text-slate-400'
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function CatalogView({
  search,
  category,
  onCategoryChange,
  sort,
  onSortChange,
  stockFilter,
  onStockFilterChange,
  imageFilter,
  onImageFilterChange,
  filtered,
  categoryList,
  categoryCounts,
  onProductClick,
  editMode = false,
  favoriteIds = [],
  onToggleFavorite,
  onStockDelta,
  stockBusyId = null,
  emptyFavorites = false,
  gridDensity = 'md',
  onGridDensityChange,
  onOrderDelta,
  orderQtys = {},
  hideImages = false,
  showPrices = false,
}: {
  search: string;
  category: string;
  onCategoryChange: (v: string) => void;
  sort: CatalogSort;
  onSortChange: (v: CatalogSort) => void;
  stockFilter: StockFilter;
  onStockFilterChange: (v: StockFilter) => void;
  imageFilter: ImageFilter;
  onImageFilterChange: (v: ImageFilter) => void;
  filtered: Product[];
  categoryList: string[];
  categoryCounts: Record<string, number>;
  onProductClick: (p: Product) => void;
  editMode?: boolean;
  favoriteIds?: string[];
  onToggleFavorite?: (id: string) => void;
  onStockDelta?: (product: Product, delta: number) => void;
  stockBusyId?: string | null;
  emptyFavorites?: boolean;
  gridDensity?: GridDensity;
  onGridDensityChange?: (v: GridDensity) => void;
  onOrderDelta?: (product: Product, delta: number) => void;
  orderQtys?: Record<string, number>;
  hideImages?: boolean;
  showPrices?: boolean;
}) {
  const searching = search.trim().length >= 2;
  const [filtersOpen, setFiltersOpen] = useState(false);
  const favoriteSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);

  const activeFilterCount =
    (category !== 'Wszystkie' ? 1 : 0) +
    (stockFilter !== 'all' ? 1 : 0) +
    (imageFilter !== 'all' ? 1 : 0);

  function resetFilters() {
    onCategoryChange('Wszystkie');
    onStockFilterChange('all');
    onImageFilterChange('all');
  }

  if (emptyFavorites) {
    return (
      <div className="py-16 text-center text-slate-500">
        <Star className="mx-auto h-10 w-10 opacity-40" />
        <p className="mt-3">Brak ulubionych</p>
        <p className="mt-1 text-sm">
          Kliknij gwiazdkę na karcie produktu, żeby go tu przypiąć.
        </p>
      </div>
    );
  }

  const categoryChips = (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
      {categoryList
        .filter((c) => c === 'Wszystkie' || (categoryCounts[c] ?? 0) > 0)
        .map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => onCategoryChange(cat)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition ${
              category === cat
                ? 'bg-brand-500/20 text-brand-300 ring-1 ring-brand-500/40'
                : 'bg-slate-800 text-slate-400 hover:text-slate-100'
            }`}
          >
            {cat}
            {(categoryCounts[cat] ?? 0) > 0 && (
              <span className="ml-1 opacity-60">{categoryCounts[cat]}</span>
            )}
          </button>
        ))}
    </div>
  );

  const stockImageFilters = (
    <div className="flex flex-wrap gap-1.5">
      {(
        [
          { id: 'all' as const, label: 'Wszystkie' },
          { id: 'in-stock' as const, label: 'Na stanie' },
          { id: 'low' as const, label: `Niski (≤${LOW_STOCK_MAX})` },
          { id: 'out' as const, label: 'Brak' },
        ] as const
      ).map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onStockFilterChange(opt.id)}
          className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
            stockFilter === opt.id
              ? 'bg-brand-500 text-white'
              : 'bg-slate-800 text-slate-400 hover:text-slate-100'
          }`}
        >
          {opt.label}
        </button>
      ))}
      <span className="mx-0.5 hidden h-6 w-px bg-slate-700 sm:inline-block" />
      {(
        [
          { id: 'all' as const, label: 'Wszystkie' },
          { id: 'with' as const, label: 'Ze zdjęciem' },
          { id: 'without' as const, label: 'Bez zdjęcia' },
        ] as const
      ).map((opt) => (
        <button
          key={`img-${opt.id}`}
          type="button"
          onClick={() => onImageFilterChange(opt.id)}
          className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
            imageFilter === opt.id
              ? 'bg-brand-500 text-white'
              : 'bg-slate-800 text-slate-400 hover:text-slate-100'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );

  const sortSelect = (
    <label className="flex min-w-0 shrink-0 items-center gap-2 text-xs text-slate-400">
      <span className="shrink-0">Sortuj</span>
      <select
        value={sort}
        onChange={(e) => onSortChange(e.target.value as CatalogSort)}
        disabled={searching}
        title={
          searching
            ? 'Przy wyszukiwaniu kolejność = trafność'
            : 'Kolejność listy'
        }
        className="max-w-[11rem] rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200 focus:border-brand-500 focus:outline-none disabled:opacity-50 sm:max-w-none"
      >
        {CATALOG_SORT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );

  const densityToggle = onGridDensityChange ? (
    <div
      className="flex shrink-0 items-center rounded-lg border border-slate-700 p-0.5"
      title="Rozmiar kafelków"
    >
      {(
        [
          { id: 'sm' as const, icon: LayoutGrid, label: 'Małe' },
          { id: 'md' as const, icon: Rows2, label: 'Średnie' },
          { id: 'lg' as const, icon: Square, label: 'Duże' },
        ] as const
      ).map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onGridDensityChange(opt.id)}
          className={`rounded-md p-1.5 transition ${
            gridDensity === opt.id
              ? 'bg-brand-600 text-white'
              : 'text-slate-400 hover:text-slate-100'
          }`}
          title={opt.label}
          aria-label={`Widok: ${opt.label}`}
        >
          <opt.icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  ) : null;

  return (
    <div className="space-y-3 sm:space-y-4">
      {editMode && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-100">
          Tryb edycji: zmieniaj stan przyciskami <strong>±1</strong> na kartach (zapis od razu).
        </div>
      )}

      {/* Mobile: kategorie + jeden rząd Filtry / gęstość */}
      <div className="space-y-2 lg:hidden">
        {categoryChips}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFiltersOpen(true)}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium ${
              activeFilterCount > 0
                ? 'border-brand-500/50 bg-brand-500/15 text-brand-200'
                : 'border-slate-700 text-slate-300'
            }`}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filtry
            {activeFilterCount > 0 && (
              <span className="rounded-full bg-brand-600 px-1.5 text-[10px] font-bold text-white">
                {activeFilterCount}
              </span>
            )}
          </button>
          {densityToggle}
          <p className="ml-auto truncate text-xs text-slate-500">
            {filtered.length} prod.
            {searching && ' · trafność'}
          </p>
        </div>
      </div>

      {/* Desktop: pełne filtry */}
      <div className="hidden space-y-4 lg:block">
        {categoryChips}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          {stockImageFilters}
          <div className="flex flex-wrap items-center gap-2">
            {sortSelect}
            {densityToggle}
          </div>
        </div>
        <p className="text-sm text-slate-500">
          {filtered.length} {filtered.length === 1 ? 'produkt' : 'produktów'}
          {search && ` dla „${search}"`}
          {searching && ' · wg trafności'}
        </p>
      </div>

      {filtersOpen && (
        <div className="fixed inset-0 z-[55] lg:hidden" role="dialog" aria-label="Filtry">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Zamknij"
            onClick={() => setFiltersOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[80dvh] overflow-y-auto rounded-t-3xl border border-slate-700 bg-slate-900 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-slate-800 bg-slate-900 px-4 py-3">
              <p className="font-semibold text-slate-100">Filtry</p>
              <button
                type="button"
                onClick={() => setFiltersOpen(false)}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-800"
                aria-label="Zamknij"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 px-4 py-4">
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Stan magazynowy
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {(
                    [
                      { id: 'all' as const, label: 'Wszystkie' },
                      { id: 'in-stock' as const, label: 'Na stanie' },
                      { id: 'low' as const, label: `Niski (≤${LOW_STOCK_MAX})` },
                      { id: 'out' as const, label: 'Brak' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => onStockFilterChange(opt.id)}
                      className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                        stockFilter === opt.id
                          ? 'bg-brand-500 text-white'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Zdjęcia
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {(
                    [
                      { id: 'all' as const, label: 'Wszystkie' },
                      { id: 'with' as const, label: 'Ze zdjęciem' },
                      { id: 'without' as const, label: 'Bez zdjęcia' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={`img-${opt.id}`}
                      type="button"
                      onClick={() => onImageFilterChange(opt.id)}
                      className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                        imageFilter === opt.id
                          ? 'bg-brand-500 text-white'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Sortowanie
                </p>
                {sortSelect}
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={resetFilters}
                  className="flex-1 rounded-xl border border-slate-700 py-2.5 text-sm text-slate-300"
                >
                  Wyczyść
                </button>
                <button
                  type="button"
                  onClick={() => setFiltersOpen(false)}
                  className="flex-1 rounded-xl bg-brand-600 py-2.5 text-sm font-medium text-white"
                >
                  Gotowe
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="py-16 text-center text-slate-500">
          <Search className="mx-auto h-10 w-10 opacity-40" />
          <p className="mt-3">Nic nie znaleziono</p>
          <p className="mt-1 text-sm">Spróbuj innego SKU, nazwy albo filtrów</p>
        </div>
      ) : (
        <ProductGrid
          products={filtered}
          className={GRID_CLASS[gridDensity]}
          resetKey={`${gridDensity}|${category}|${stockFilter}|${imageFilter}|${sort}|${search}|${filtered.length}`}
          renderItem={(product) => (
            <ProductCard
              product={product}
              onClick={() => onProductClick(product)}
              editMode={editMode}
              isFavorite={favoriteSet.has(product.id)}
              onToggleFavorite={onToggleFavorite}
              onStockDelta={onStockDelta}
              stockBusy={stockBusyId === product.id}
              density={gridDensity}
              orderQty={orderQtys[product.id] ?? 0}
              onOrderDelta={onOrderDelta}
              hideImages={hideImages}
              showPrices={showPrices}
            />
          )}
        />
      )}
    </div>
  );
}

function LabelsView({
  queue,
  onRefresh,
  onRemove,
  onClear,
  onPrintAll,
  onPrintOne,
}: {
  queue: LabelQueueItem[];
  onRefresh: () => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  onPrintAll: () => void;
  onPrintOne: (item: LabelQueueItem) => void;
}) {
  useEffect(() => {
    onRefresh();
  }, [onRefresh]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Etykiety półkowe</h2>
          <p className="text-sm text-slate-500">
            Kolejka do druku kodów kreskowych (EAN / SKU)
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!queue.length}
            onClick={onPrintAll}
            className="flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-50"
          >
            <Printer className="h-4 w-4" />
            Drukuj wszystkie ({queue.length})
          </button>
          <button
            type="button"
            disabled={!queue.length}
            onClick={onClear}
            className="flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            Wyczyść
          </button>
        </div>
      </div>

      {!queue.length ? (
        <div className="rounded-2xl border border-dashed border-slate-700 py-16 text-center">
          <Printer className="mx-auto h-12 w-12 text-slate-600" />
          <p className="mt-3 text-slate-400">Kolejka pusta</p>
          <p className="mt-1 text-sm text-slate-500">
            Otwórz produkt → „Do kolejki druku”, potem wróć tutaj.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {queue.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-100">{item.displayName}</p>
                <p className="font-mono text-xs text-brand-400">
                  {item.sku}
                  {item.ean && item.ean !== item.sku ? ` · ${item.ean}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onPrintOne(item)}
                className="rounded-lg border border-brand-500/40 bg-brand-500/10 px-3 py-1.5 text-xs font-medium text-brand-300 hover:bg-brand-500/20"
              >
                Drukuj
              </button>
              <button
                type="button"
                onClick={() => onRemove(item.id)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-red-400"
                aria-label="Usuń z kolejki"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MissingImagesView({
  products,
  categoryList,
  initialCategory = 'Wszystkie',
  onProductClick,
  onImageUpdated,
  canUpload = false,
}: {
  products: Product[];
  categoryList: string[];
  initialCategory?: string;
  onProductClick: (p: Product) => void;
  onImageUpdated: (id: string, url: string) => void;
  canUpload?: boolean;
}) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState(initialCategory);
  const [showScanner, setShowScanner] = useState(false);

  useEffect(() => {
    setCategory(initialCategory);
  }, [initialCategory]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { Wszystkie: products.length };
    for (const p of products) {
      counts[p.category] = (counts[p.category] || 0) + 1;
    }
    return counts;
  }, [products]);

  const filtered = useMemo(
    () =>
      filterProducts(products, search, category).sort((a, b) =>
        a.displayName.localeCompare(b.displayName, 'pl'),
      ),
    [products, search, category],
  );

  const topCategories = useMemo(
    () =>
      Object.entries(categoryCounts)
        .filter(([cat, count]) => cat !== 'Wszystkie' && count > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5),
    [categoryCounts],
  );

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-amber-500/40 bg-amber-500/15 px-4 py-3">
        <p className="text-sm text-amber-950 dark:text-amber-100">
          <strong>{products.length}</strong> produktów bez zdjęcia.
          Zrób zdjęcie telefonem lub wgraj plik — od razu trafi do katalogu.
        </p>
        {topCategories.length > 0 && (
          <p className="mt-2 text-xs text-amber-900/80 dark:text-amber-200/80">
            Najwięcej braków:{' '}
            {topCategories.map(([cat, count], i) => (
              <span key={cat}>
                {i > 0 ? ' · ' : ''}
                {cat} ({count})
              </span>
            ))}
          </p>
        )}
      </div>

      <SearchBar
        value={search}
        onChange={setSearch}
        placeholder="Szukaj brakujących zdjęć po SKU, nazwie lub EAN..."
        onScanClick={() => setShowScanner(true)}
      />

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {categoryList.filter(
          (c) => c === 'Wszystkie' || (categoryCounts[c] ?? 0) > 0,
        ).map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategory(cat)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition ${
              category === cat
                ? 'bg-amber-500 text-amber-950'
                : 'bg-slate-800 text-slate-400 hover:text-slate-100'
            }`}
          >
            {cat}
            {(categoryCounts[cat] ?? 0) > 0 && (
              <span className="ml-1 opacity-60">{categoryCounts[cat]}</span>
            )}
          </button>
        ))}
      </div>

      <p className="text-sm text-slate-500">
        {filtered.length} {filtered.length === 1 ? 'produkt' : 'produktów'}
        {search && ` dla „${search}"`}
      </p>

      {filtered.length === 0 ? (
        <div className="py-16 text-center text-slate-500">
          <ImageOff className="mx-auto h-10 w-10 opacity-40" />
          <p className="mt-3">Brak produktów w tym filtrze</p>
        </div>
      ) : (
        <ProductGrid
          products={filtered}
          className="grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
          resetKey={`missing|${category}|${search}|${filtered.length}`}
          renderItem={(product) => (
            <ProductCard
              product={product}
              onClick={() => onProductClick(product)}
              showUpload={canUpload}
              onImageUpdated={onImageUpdated}
            />
          )}
        />
      )}

      {showScanner && (
        <Suspense fallback={null}>
          <BarcodeScanner
            onScan={(code) => {
              setSearch(code);
              setCategory('Wszystkie');
              setShowScanner(false);
            }}
            onClose={() => setShowScanner(false)}
          />
        </Suspense>
      )}
    </div>
  );
}
