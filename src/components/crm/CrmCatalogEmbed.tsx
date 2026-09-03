import { lazy, Suspense, useMemo, useRef, useState } from 'react';
import { LayoutGrid, Rows2, Search, SlidersHorizontal, Square } from 'lucide-react';
import {
  GRID_DENSITY_CLASS,
  loadGridDensity,
  saveGridDensity,
  type GridDensity,
} from '../../lib/catalogGrid';
import type { Product, CatalogListFilter } from '../../types';
import { CATALOG_LABELS } from '../../types';
import { ProductCard } from '../ProductCard';
import { ProductGrid } from '../ProductGrid';
import {
  applyCatalogFilters,
  CATALOG_SORT_OPTIONS,
  type CatalogSort,
  type StockFilter,
} from '../../lib/search';
import { resolveProductCatalogKind } from '../../lib/catalogKind';
import { getProductDisplayCategory } from '../../lib/catalogCategory';

const ProductDetail = lazy(() =>
  import('../ProductDetail').then((m) => ({ default: m.ProductDetail })),
);

const CATALOG_KINDS: { id: CatalogListFilter; label: string }[] = [
  { id: 'all', label: 'Wszystkie' },
  { id: 'accessories', label: CATALOG_LABELS.accessories },
  { id: 'shop', label: CATALOG_LABELS.shop },
];

interface CrmCatalogEmbedProps {
  products: Product[];
  orderQtys: Record<string, number>;
  onOrderDelta: (product: Product, delta: number) => void;
  onOrderDraftChange?: () => void;
  showPrices?: boolean;
  className?: string;
}

export function CrmCatalogEmbed({
  products,
  orderQtys,
  onOrderDelta,
  onOrderDraftChange,
  showPrices = true,
  className = '',
}: CrmCatalogEmbedProps) {
  // Pole wyszukiwania trzyma wpisywany tekst lokalnie (natychmiast, bez lagow) —
  // do filtrowania ~3500 produktow idzie dopiero po krotkiej przerwie w pisaniu.
  // Sam useDeferredValue nie wystarczal na slabszych telefonach (zacinanie/zamrazanie).
  const [searchDraft, setSearchDraft] = useState('');
  const [deferredSearch, setDeferredSearch] = useState('');
  const searchCommitTimer = useRef<number | null>(null);

  function handleSearchInput(next: string) {
    setSearchDraft(next);
    if (searchCommitTimer.current != null) window.clearTimeout(searchCommitTimer.current);
    searchCommitTimer.current = window.setTimeout(() => setDeferredSearch(next), 220);
  }

  const [catalogKind, setCatalogKind] = useState<CatalogListFilter>('all');
  const [category, setCategory] = useState('Wszystkie');
  const [sort, setSort] = useState<CatalogSort>('category');
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [gridDensity, setGridDensity] = useState<GridDensity>(loadGridDensity);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  function changeGridDensity(next: GridDensity) {
    setGridDensity(next);
    saveGridDensity(next);
  }

  const scopedProducts = useMemo(() => {
    if (catalogKind === 'all') return products;
    return products.filter((p) => resolveProductCatalogKind(p) === catalogKind);
  }, [products, catalogKind]);

  const categoryList = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of scopedProducts) {
      const cat = getProductDisplayCategory(p);
      counts.set(cat, (counts.get(cat) ?? 0) + 1);
    }
    return ['Wszystkie', ...[...counts.keys()].sort((a, b) => a.localeCompare(b, 'pl'))];
  }, [scopedProducts]);

  const filtered = useMemo(
    () =>
      applyCatalogFilters(scopedProducts, {
        search: deferredSearch,
        category,
        sort,
        stockFilter,
        imageFilter: 'all',
        visibilityFilter: 'active',
      }),
    [scopedProducts, deferredSearch, category, sort, stockFilter],
  );

  const resetKey = `${catalogKind}|${category}|${deferredSearch}|${sort}|${stockFilter}|${gridDensity}`;

  return (
    <div
      className={`crm-catalog-embed flex min-h-[min(52vh,640px)] flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 ${className}`}
    >
      <div className="shrink-0 border-b border-slate-800 px-3 py-3">
        <div className="flex items-center gap-2">
          <LayoutGrid className="h-4 w-4 shrink-0 text-brand-400" />
          <p className="text-sm font-semibold text-slate-100">Katalog produktów</p>
          <span className="ml-auto text-xs tabular-nums text-slate-500">
            {filtered.length} poz.
          </span>
        </div>

        <label className="mt-2 flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-slate-500" />
          <input
            type="search"
            value={searchDraft}
            onChange={(e) => handleSearchInput(e.target.value)}
            placeholder="SKU, nazwa, EAN, producent…"
            className="min-w-0 flex-1 bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-600"
          />
        </label>

        <div className="mt-2 flex gap-1 overflow-x-auto pb-0.5 scrollbar-none">
          {CATALOG_KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              onClick={() => {
                setCatalogKind(k.id);
                setCategory('Wszystkie');
              }}
              className={`shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-semibold ${
                catalogKind === k.id
                  ? 'bg-brand-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {k.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            className={`ml-auto inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[11px] ${
              filtersOpen ? 'bg-slate-700 text-slate-100' : 'bg-slate-800 text-slate-400'
            }`}
          >
            <SlidersHorizontal className="h-3 w-3" />
            Filtry
          </button>
          <div className="flex shrink-0 items-center rounded-lg border border-slate-700 p-0.5">
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
                onClick={() => changeGridDensity(opt.id)}
                className={`rounded-md p-1 transition ${
                  gridDensity === opt.id
                    ? 'bg-brand-600 text-white'
                    : 'text-slate-500 hover:text-slate-200'
                }`}
                title={`Widok: ${opt.label}`}
                aria-label={`Widok: ${opt.label}`}
              >
                <opt.icon className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>
        </div>

        {filtersOpen && (
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <label className="block text-[10px] uppercase tracking-wide text-slate-500">
              Kategoria
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="input-field mt-1 text-xs"
              >
                {categoryList.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-[10px] uppercase tracking-wide text-slate-500">
              Sortowanie
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as CatalogSort)}
                className="input-field mt-1 text-xs"
              >
                {CATALOG_SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-[10px] uppercase tracking-wide text-slate-500 sm:col-span-2">
              Stan magazynowy
              <select
                value={stockFilter}
                onChange={(e) => setStockFilter(e.target.value as StockFilter)}
                className="input-field mt-1 text-xs"
              >
                <option value="all">Wszystkie</option>
                <option value="in-stock">Na stanie</option>
                <option value="low">Niski stan (≤5)</option>
                <option value="out">Brak</option>
              </select>
            </label>
          </div>
        )}

        <p className="mt-2 text-[11px] text-slate-500">
          Zielony <span className="font-semibold text-brand-400">+</span> na karcie dodaje do koszyka.
          Kliknij kartę, aby zobaczyć szczegóły.
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2 sm:px-3">
        {filtered.length === 0 ? (
          <div className="flex h-full min-h-[12rem] flex-col items-center justify-center px-4 text-center text-sm text-slate-500">
            Brak produktów dla wybranych filtrów.
          </div>
        ) : (
          <ProductGrid
            products={filtered}
            resetKey={resetKey}
            className={GRID_DENSITY_CLASS[gridDensity]}
            renderItem={(product) => (
              <ProductCard
                key={product.id}
                product={product}
                density={gridDensity}
                showPrices={showPrices}
                showCatalogKind={catalogKind === 'all'}
                orderQty={orderQtys[product.id] ?? 0}
                onOrderDelta={onOrderDelta}
                onClick={() => setSelectedProduct(product)}
              />
            )}
          />
        )}
      </div>

      {selectedProduct && (
        <Suspense fallback={null}>
          <ProductDetail
            product={selectedProduct}
            onClose={() => setSelectedProduct(null)}
            onOrderDraftChange={onOrderDraftChange}
            hubStyle
          />
        </Suspense>
      )}
    </div>
  );
}
