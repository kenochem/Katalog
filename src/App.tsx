import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Search,
  Layers,
  ImageOff,
  Loader2,
  RefreshCw,
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
  Download,
} from 'lucide-react';
import type { Product, Kit, View, CatalogType } from './types';
import {
  CATALOG_LABELS,
  CATALOG_SUBTITLES,
  deriveCategories,
} from './types';
import { fetchProducts, fetchKits, getProductImage, updateProduct } from './lib/products';
import {
  applyCatalogFilters,
  filterProducts,
  CATALOG_SORT_OPTIONS,
  type CatalogSort,
  type StockFilter,
  type ImageFilter,
} from './lib/search';
import { useTheme } from './lib/theme';
import { getFavoriteIds, toggleFavorite } from './lib/favorites';
import {
  getLabelQueue,
  removeFromLabelQueue,
  clearLabelQueue,
  type LabelQueueItem,
} from './lib/labelQueue';
import { printShelfLabels } from './lib/printLabel';
import { ProductCard, ProductDetail, SearchBar } from './components/ProductCard';
import { KitsView } from './components/KitsView';
import { AddProductModal } from './components/AddProductModal';
import { BarcodeScanner } from './components/BarcodeScanner';
import { PhotoProgressView } from './components/PhotoProgressView';
import { VisualSearchModal } from './components/VisualSearchModal';
import { InstallAppHint, resetInstallHint } from './components/InstallAppHint';
import { LoginGate } from './components/LoginGate';
import { AdminUsersPanel } from './components/AdminUsersPanel';
import {
  getDeferredInstall,
} from './lib/pwaInstall';
import { useAuth } from './lib/auth';
import { roleCan, ROLE_LABELS } from './lib/roles';

const CATALOG_STORAGE_KEY = 'katalog-active-catalog';
const SORT_STORAGE_KEY = 'katalog-sort';

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
    role,
    displayLabel,
    signOut,
    exitGuest,
  } = useAuth();
  const [allProducts, setAllProducts] = useState<Product[]>([]);
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
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => getFavoriteIds());
  const [labelQueue, setLabelQueue] = useState<LabelQueueItem[]>(() => getLabelQueue());
  const [stockBusyId, setStockBusyId] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [showVisualSearch, setShowVisualSearch] = useState(false);
  const [showAdminUsers, setShowAdminUsers] = useState(false);
  const [missingCategory, setMissingCategory] = useState('Wszystkie');

  useEffect(() => {
    if (!roleCan(role, 'editStock')) setEditMode(false);
    if (!roleCan(role, 'printLabels') && view === 'labels') setView('catalog');
    if (!roleCan(role, 'viewProgress') && view === 'progress') setView('catalog');
    if (!roleCan(role, 'manageFavorites') && view === 'favorites') setView('catalog');
  }, [role, view]);

  const products = useMemo(
    () => allProducts.filter((p) => (p.catalog || 'accessories') === activeCatalog),
    [allProducts, activeCatalog],
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [prods, kitList] = await Promise.all([
        fetchProducts(),
        fetchKits(),
      ]);
      setAllProducts(prods);
      setKits(kitList);
    } catch (err) {
      console.error(err);
      try {
        const prods = await fetchProducts();
        setAllProducts(prods);
        const kitList = await fetchKits();
        setKits(kitList);
      } catch {
        setError(
          'Nie udało się załadować katalogu. Sprawdź połączenie z internetem.',
        );
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

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

  const filtered = useMemo(() => {
    const base =
      view === 'favorites'
        ? products.filter((p) => favoriteIds.includes(p.id))
        : products;
    return applyCatalogFilters(base, {
      search,
      category,
      sort,
      stockFilter,
      imageFilter,
    });
  }, [products, search, category, sort, stockFilter, imageFilter, view, favoriteIds]);

  const favoriteCount = useMemo(
    () => products.filter((p) => favoriteIds.includes(p.id)).length,
    [products, favoriteIds],
  );

  const handleSortChange = useCallback((next: CatalogSort) => {
    setSort(next);
    try {
      localStorage.setItem(SORT_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const handleToggleFavorite = useCallback((productId: string) => {
    toggleFavorite(productId);
    setFavoriteIds(getFavoriteIds());
  }, []);

  const refreshLabelQueue = useCallback(() => {
    setLabelQueue(getLabelQueue());
  }, []);

  const handleStockDelta = useCallback(
    async (product: Product, delta: number) => {
      const next = Math.max(0, Math.round((product.stock ?? 0) + delta));
      setStockBusyId(product.id);
      // optimistic
      setAllProducts((prev) =>
        prev.map((p) =>
          p.id === product.id ? { ...p, stock: next, stockManual: true } : p,
        ),
      );
      try {
        await updateProduct(product.id, { stock: next, stockManual: true });
      } catch (err) {
        console.error(err);
        setAllProducts((prev) =>
          prev.map((p) =>
            p.id === product.id
              ? { ...p, stock: product.stock, stockManual: product.stockManual }
              : p,
          ),
        );
        alert('Nie udało się zapisać stanu.');
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
      setAllProducts((prev) =>
        prev.map((p) =>
          p.id === productId ? { ...p, customImageUrl: url, hasImage: true } : p,
        ),
      );
      if (selectedProduct?.id === productId) {
        setSelectedProduct((prev) =>
          prev ? { ...prev, customImageUrl: url, hasImage: true } : null,
        );
      }
    },
    [selectedProduct],
  );

  const handleProductUpdated = useCallback((updated: Product) => {
    setAllProducts((prev) =>
      prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)),
    );
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
    <div className="mx-auto min-h-dvh w-full max-w-7xl">
      {/* Header przewija się — na mobile nie zabiera ekranu */}
      <header className="border-b border-slate-800/80 bg-slate-950 pt-[env(safe-area-inset-top)]">
        <div className="flex items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3">
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
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold tracking-tight text-slate-100 sm:text-lg">
              Katalog
            </h1>
            <p className="truncate text-[11px] text-slate-500 sm:text-xs">
              {CATALOG_SUBTITLES[activeCatalog]}
            </p>
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
            title={isDark ? 'Motyw jasny' : 'Motyw ciemny'}
            aria-label={isDark ? 'Włącz motyw jasny' : 'Włącz motyw ciemny'}
          >
            {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-100 disabled:opacity-50"
            title="Odśwież"
          >
            <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="flex gap-1.5 overflow-x-auto px-3 pb-2 scrollbar-none sm:px-4">
          <div
            className="flex shrink-0 items-center rounded-lg border border-slate-700 px-2.5 py-1.5"
            title={ROLE_LABELS[role]}
          >
            <span className="max-w-[7rem] truncate text-xs font-medium text-slate-200 sm:max-w-[10rem] sm:text-sm">
              {displayLabel}
            </span>
          </div>
          {roleCan(role, 'manageUsers') && (
            <button
              type="button"
              onClick={() => setShowAdminUsers(true)}
              className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800 sm:gap-1.5 sm:px-3 sm:py-2 sm:text-sm"
              title="Zarządzaj użytkownikami"
            >
              <Users className="h-4 w-4" />
              Konta
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (mode === 'guest') exitGuest();
              else void signOut();
            }}
            className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-400 hover:bg-slate-800 hover:text-slate-100 sm:px-3 sm:py-2"
            title={mode === 'guest' ? 'Wróć do logowania' : 'Wyloguj'}
          >
            <LogOut className="h-4 w-4" />
          </button>
          {roleCan(role, 'addProduct') && (
            <button
              type="button"
              onClick={() => setShowAddProduct(true)}
              className="flex shrink-0 items-center gap-1 rounded-lg bg-brand-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-brand-500 sm:gap-1.5 sm:px-3 sm:py-2 sm:text-sm"
              title="Dodaj produkt"
            >
              <Plus className="h-4 w-4" />
              Dodaj
            </button>
          )}
          {activeCatalog === 'shop' && roleCan(role, 'useLens') && (
            <button
              type="button"
              onClick={() => setShowVisualSearch(true)}
              className="flex shrink-0 items-center gap-1 rounded-lg border border-brand-500/40 bg-brand-500/10 px-2.5 py-1.5 text-xs font-medium text-brand-300 hover:bg-brand-500/20 sm:gap-1.5 sm:px-3 sm:py-2 sm:text-sm"
              title="Rozpoznaj produkt ze zdjęcia"
            >
              <Sparkles className="h-4 w-4" />
              Lens
            </button>
          )}
          {roleCan(role, 'editStock') && (
            <button
              type="button"
              onClick={() => setEditMode((v) => !v)}
              className={`flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition sm:gap-1.5 sm:px-3 sm:py-2 sm:text-sm ${
                editMode
                  ? 'bg-amber-500 text-amber-950'
                  : 'border border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-slate-100'
              }`}
              title="Tryb edycji stanów (±1)"
            >
              <Pencil className="h-4 w-4" />
              {editMode ? 'Edycja ON' : 'Edycja'}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              // przywróć banner / spróbuj natywnego promptu
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
            }}
            className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-slate-100 sm:gap-1.5 sm:px-3 sm:py-2 sm:text-sm"
            title="Dodaj Katalog do ekranu głównego"
          >
            <Download className="h-4 w-4" />
            <span className="hidden xs:inline sm:inline">Apka</span>
          </button>
        </div>

        <div className="px-3 pb-2 sm:px-4">
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

        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 scrollbar-none sm:px-4">
          <NavTab
            active={view === 'catalog'}
            onClick={() => setView('catalog')}
            icon={<Search className="h-4 w-4" />}
            label="Katalog"
            count={products.length}
          />
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
          {activeCatalog === 'accessories' && (
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
          <NavTab
            active={view === 'missing-images'}
            onClick={() => openMissingImages()}
            icon={<ImageOff className="h-4 w-4" />}
            label="Bez zdjęć"
            count={missingImages.length}
            highlight={missingImages.length > 0}
          />
        </nav>
      </header>

      {/* Wyszukiwarka zawsze przyklejona przy scrollu (mobile + desktop) */}
      {(view === 'catalog' || view === 'favorites') && (
        <div className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/95 px-3 py-2 shadow-md shadow-black/10 backdrop-blur-xl sm:px-4">
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
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-brand-500/40 bg-brand-500/10 text-brand-200 transition hover:bg-brand-500/20 sm:h-auto sm:w-auto sm:gap-2 sm:px-4"
              title="Lens — EAN, potem OCR etykiety"
              aria-label="Lens — EAN, potem OCR etykiety"
              >
                <Sparkles className="h-5 w-5" />
                <span className="hidden text-sm font-medium sm:inline">Lens</span>
              </button>
            )}
          </div>
        </div>
      )}

      <main className="px-3 py-3 sm:px-4 sm:py-4">
        {loading && allProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24">
            <Loader2 className="h-10 w-10 animate-spin text-brand-500" />
            <p className="mt-4 text-slate-400">Ładowanie katalogu...</p>
          </div>
        ) : error && allProducts.length === 0 ? (
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
          />
        ) : view === 'labels' ? (
          <LabelsView
            queue={labelQueue}
            onRefresh={refreshLabelQueue}
            onRemove={(id) => {
              removeFromLabelQueue(id);
              refreshLabelQueue();
            }}
            onClear={() => {
              clearLabelQueue();
              refreshLabelQueue();
            }}
            onPrintAll={() => printShelfLabels(labelQueue)}
            onPrintOne={(item) => printShelfLabels([item])}
          />
        ) : view === 'kits' && activeCatalog === 'accessories' ? (
          <KitsView
            kits={kits}
            products={products}
            onKitsChange={loadData}
          />
        ) : view === 'progress' ? (
          <PhotoProgressView
            products={products}
            onOpenMissing={(cat) => openMissingImages(cat ?? 'Wszystkie')}
          />
        ) : (
          <MissingImagesView
            products={missingImages}
            categoryList={categoryList}
            initialCategory={missingCategory}
            onProductClick={setSelectedProduct}
            onImageUpdated={handleImageUpdated}
          />
        )}
      </main>

      {selectedProduct && (
        <ProductDetail
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onImageUpdated={handleImageUpdated}
          onProductUpdated={handleProductUpdated}
          onLabelQueueChange={refreshLabelQueue}
        />
      )}

      {showAddProduct && (
        <AddProductModal
          catalog={activeCatalog}
          existingProducts={products}
          onClose={() => setShowAddProduct(false)}
          onSaved={(product) => {
            setAllProducts((prev) => [...prev, product]);
            setShowAddProduct(false);
          }}
        />
      )}

      {showScanner && (
        <BarcodeScanner
          onScan={handleBarcodeScan}
          onClose={() => setShowScanner(false)}
        />
      )}

      {showVisualSearch && activeCatalog === 'shop' && roleCan(role, 'useLens') && (
        <VisualSearchModal
          products={products}
          onClose={() => setShowVisualSearch(false)}
          onSelect={(product) => {
            setSelectedProduct(product);
            setView('catalog');
          }}
        />
      )}

      {showAdminUsers && roleCan(role, 'manageUsers') && (
        <AdminUsersPanel onClose={() => setShowAdminUsers(false)} />
      )}

      <InstallAppHint />
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
          : 'text-slate-400 hover:bg-slate-800 hover:text-white'
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
            ? 'bg-amber-500/15 text-amber-300 hover:bg-amber-500/25'
            : 'text-slate-400 hover:bg-slate-800 hover:text-white'
      }`}
    >
      {icon}
      <span>{label}</span>
      {count !== undefined && (
        <span
          className={`rounded-full px-1.5 py-0.5 text-[10px] sm:text-xs ${
            active ? 'bg-white/20' : 'bg-slate-700 text-slate-400'
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
}) {
  const searching = search.trim().length >= 2;

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

  return (
    <div className="space-y-4">
      {editMode && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-100">
          Tryb edycji: zmieniaj stan przyciskami <strong>±1</strong> na kartach (zapis od razu).
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {categoryList.filter(
          (c) => c === 'Wszystkie' || (categoryCounts[c] ?? 0) > 0,
        ).map((cat) => (
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

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              { id: 'all' as const, label: 'Wszystkie' },
              { id: 'in-stock' as const, label: 'Na stanie' },
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
              key={opt.id}
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
      </div>

      <p className="text-sm text-slate-500">
        {filtered.length} {filtered.length === 1 ? 'produkt' : 'produktów'}
        {search && ` dla „${search}"`}
        {searching && ' · wg trafności'}
      </p>

      {filtered.length === 0 ? (
        <div className="py-16 text-center text-slate-500">
          <Search className="mx-auto h-10 w-10 opacity-40" />
          <p className="mt-3">Nic nie znaleziono</p>
          <p className="mt-1 text-sm">Spróbuj innego SKU, nazwy albo filtrów</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filtered.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onClick={() => onProductClick(product)}
              editMode={editMode}
              isFavorite={favoriteIds.includes(product.id)}
              onToggleFavorite={onToggleFavorite}
              onStockDelta={onStockDelta}
              stockBusy={stockBusyId === product.id}
            />
          ))}
        </div>
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
}: {
  products: Product[];
  categoryList: string[];
  initialCategory?: string;
  onProductClick: (p: Product) => void;
  onImageUpdated: (id: string, url: string) => void;
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
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
        <p className="text-sm text-amber-200">
          <strong>{products.length}</strong> produktów bez zdjęcia.
          Zrób zdjęcie telefonem lub wgraj plik — od razu trafi do katalogu.
        </p>
        {topCategories.length > 0 && (
          <p className="mt-2 text-xs text-amber-200/70">
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
                ? 'bg-amber-500/20 text-amber-200 ring-1 ring-amber-500/40'
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onClick={() => onProductClick(product)}
              showUpload
              onImageUpdated={onImageUpdated}
            />
          ))}
        </div>
      )}

      {showScanner && (
        <BarcodeScanner
          onScan={(code) => {
            setSearch(code);
            setCategory('Wszystkie');
            setShowScanner(false);
          }}
          onClose={() => setShowScanner(false)}
        />
      )}
    </div>
  );
}
