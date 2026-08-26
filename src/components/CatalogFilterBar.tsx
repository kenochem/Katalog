import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import {
  ChevronDown,
  LayoutGrid,
  Plus,
  Rows2,
  SlidersHorizontal,
  Square,
  X,
} from 'lucide-react';
import {
  CATALOG_SORT_OPTIONS,
  LOW_STOCK_MAX,
  type CatalogSort,
  type ImageFilter,
  type StockFilter,
  type KnowledgeFilter,
  type BaselinkerFilter,
  type WaproMagFilter,
  type CatalogVisibilityFilter,
} from '../lib/search';
import { CATALOG_LABELS, type CatalogListFilter } from '../types';

export type GridDensity = 'sm' | 'md' | 'lg';

type MenuId =
  | 'category'
  | 'manufacturer'
  | 'stock'
  | 'image'
  | 'knowledge'
  | 'baselinker'
  | 'waproMag'
  | 'visibility'
  | null;

const STOCK_OPTS = [
  { id: 'all' as const, label: 'Wszystkie' },
  { id: 'in-stock' as const, label: 'Na stanie' },
  { id: 'low' as const, label: `Niski stan (≤${LOW_STOCK_MAX})` },
  { id: 'out' as const, label: 'Brak na stanie' },
];

const IMAGE_OPTS = [
  { id: 'all' as const, label: 'Wszystkie' },
  { id: 'with' as const, label: 'Ze zdjęciem' },
  { id: 'without' as const, label: 'Bez zdjęcia' },
];

const KNOWLEDGE_OPTS = [
  { id: 'all' as const, label: 'Wszystkie' },
  { id: 'weak' as const, label: 'Słaby opis (<55%)' },
  { id: 'good' as const, label: 'Dobry opis (≥65%)' },
];

const BASELINKER_OPTS = [
  { id: 'all' as const, label: 'Wszystkie' },
  { id: 'linked' as const, label: 'Na BaseLinkerze' },
  { id: 'not-linked' as const, label: 'Poza BaseLinkerem' },
];

const WAPRO_MAG_OPTS = [
  { id: 'all' as const, label: 'Wszystkie' },
  { id: 'needs-media' as const, label: 'Mag WAPRO — bez zdjęcia' },
];

const VISIBILITY_OPTS = [
  { id: 'active' as const, label: 'Aktywne' },
  { id: 'hidden' as const, label: 'Ukryte' },
  { id: 'all' as const, label: 'Wszystkie' },
];

export type ShopCategoryGroup = { root: string; leaves: string[] };

interface CatalogFilterBarProps {
  categories: string[];
  categoryCounts: Record<string, number>;
  category: string;
  onCategoryChange: (cat: string) => void;
  manufacturers?: string[];
  manufacturerCounts?: Record<string, number>;
  manufacturer?: string;
  onManufacturerChange?: (m: string) => void;
  stockFilter: StockFilter;
  onStockFilterChange: (v: StockFilter) => void;
  imageFilter: ImageFilter;
  onImageFilterChange: (v: ImageFilter) => void;
  knowledgeFilter?: KnowledgeFilter;
  onKnowledgeFilterChange?: (v: KnowledgeFilter) => void;
  baselinkerFilter?: BaselinkerFilter;
  onBaselinkerFilterChange?: (v: BaselinkerFilter) => void;
  waproMagFilter?: WaproMagFilter;
  onWaproMagFilterChange?: (v: WaproMagFilter) => void;
  visibilityFilter?: CatalogVisibilityFilter;
  onVisibilityFilterChange?: (v: CatalogVisibilityFilter) => void;
  /** Grupowane liście kategorii sklepu (jak na kenochem.pl). */
  shopCategoryGroups?: ShopCategoryGroup[];
  sort: CatalogSort;
  onSortChange: (v: CatalogSort) => void;
  sortDisabled?: boolean;
  density: GridDensity;
  onDensityChange: (d: GridDensity) => void;
  filteredCount: number;
  searchHint?: string;
  searching?: boolean;
  canAddProduct?: boolean;
  onAddProduct?: () => void;
  onResetFilters: () => void;
  mobileFiltersOpen: boolean;
  onMobileFiltersOpenChange: (open: boolean) => void;
  activeFilterCount: number;
  trailing?: ReactNode;
  catalogFilter?: CatalogListFilter;
  onCatalogFilterChange?: (v: CatalogListFilter) => void;
  catalogKindCounts?: { all: number; accessories: number; shop: number };
}

function useClickOutside(
  ref: RefObject<HTMLElement | null>,
  onClose: () => void,
  enabled: boolean,
) {
  useEffect(() => {
    if (!enabled) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [ref, onClose, enabled]);
}

function FilterTrigger({
  label,
  value,
  active,
  open,
  onClick,
}: {
  label: string;
  value: string;
  active?: boolean;
  open?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`catalog-filter-trigger inline-flex min-w-0 max-w-[min(100%,14rem)] items-center gap-1.5 rounded-xl border px-3 py-2 text-left text-xs font-medium transition sm:max-w-none ${
        open
          ? 'border-brand-500/50 bg-brand-50 text-brand-900 dark:bg-brand-500/15 dark:text-brand-100'
          : active
            ? 'border-brand-500/35 bg-brand-50 text-brand-900 dark:bg-brand-500/10 dark:text-brand-200'
            : 'border-slate-700 bg-slate-900/60 text-slate-300 hover:border-slate-600 hover:bg-slate-800/80'
      }`}
    >
      <span className="shrink-0 text-slate-500">{label}</span>
      <span className="truncate">{value}</span>
      <ChevronDown
        className={`h-3.5 w-3.5 shrink-0 text-slate-500 transition ${open ? 'rotate-180' : ''}`}
      />
    </button>
  );
}

function DensityToggle({
  density,
  onChange,
}: {
  density: GridDensity;
  onChange: (d: GridDensity) => void;
}) {
  return (
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
          onClick={() => onChange(opt.id)}
          className={`rounded-md p-1.5 transition ${
            density === opt.id ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-slate-100'
          }`}
          title={opt.label}
          aria-label={`Widok: ${opt.label}`}
        >
          <opt.icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  );
}

function SortSelect({
  sort,
  onChange,
  disabled,
}: {
  sort: CatalogSort;
  onChange: (v: CatalogSort) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex min-w-0 shrink-0 items-center gap-2 text-xs text-slate-400">
      <span className="shrink-0">Sortuj</span>
      <select
        value={sort}
        onChange={(e) => onChange(e.target.value as CatalogSort)}
        disabled={disabled}
        title={
          disabled ? 'Przy wyszukiwaniu kolejność = trafność' : 'Kolejność listy'
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
}

function ActiveChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button
      type="button"
      onClick={onRemove}
      className="inline-flex items-center gap-1 rounded-full border border-brand-500/30 bg-brand-500/10 px-2.5 py-1 text-[11px] font-medium text-brand-200 hover:bg-brand-500/20"
    >
      {label}
      <X className="h-3 w-3 opacity-70" />
    </button>
  );
}

function MobileFilterSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </p>
      {children}
    </div>
  );
}

export function CatalogFilterBar({
  categories,
  categoryCounts,
  category,
  onCategoryChange,
  manufacturers = [],
  manufacturerCounts = {},
  manufacturer = 'Wszyscy',
  onManufacturerChange,
  stockFilter,
  onStockFilterChange,
  imageFilter,
  onImageFilterChange,
  knowledgeFilter = 'all',
  onKnowledgeFilterChange,
  baselinkerFilter = 'all',
  onBaselinkerFilterChange,
  waproMagFilter = 'all',
  onWaproMagFilterChange,
  visibilityFilter = 'active',
  onVisibilityFilterChange,
  shopCategoryGroups,
  sort,
  onSortChange,
  sortDisabled,
  density,
  onDensityChange,
  filteredCount,
  searchHint,
  searching,
  canAddProduct,
  onAddProduct,
  onResetFilters,
  mobileFiltersOpen,
  onMobileFiltersOpenChange,
  activeFilterCount,
  trailing,
  catalogFilter,
  onCatalogFilterChange,
  catalogKindCounts,
}: CatalogFilterBarProps) {
  const [openMenu, setOpenMenu] = useState<MenuId>(null);
  const [mobileCategoryExpanded, setMobileCategoryExpanded] = useState(false);
  const [mobileManufacturerExpanded, setMobileManufacturerExpanded] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  useClickOutside(barRef, () => setOpenMenu(null), openMenu !== null);

  const stockLabel = STOCK_OPTS.find((o) => o.id === stockFilter)?.label ?? 'Wszystkie';
  const imageLabel = IMAGE_OPTS.find((o) => o.id === imageFilter)?.label ?? 'Wszystkie';
  const knowledgeLabel =
    KNOWLEDGE_OPTS.find((o) => o.id === knowledgeFilter)?.label ?? 'Wszystkie';
  const baselinkerLabel =
    BASELINKER_OPTS.find((o) => o.id === baselinkerFilter)?.label ?? 'Wszystkie';
  const waproMagLabel =
    WAPRO_MAG_OPTS.find((o) => o.id === waproMagFilter)?.label ?? 'Wszystkie';
  const visibilityLabel =
    VISIBILITY_OPTS.find((o) => o.id === visibilityFilter)?.label ?? 'Aktywne';
  const categoryLabel = category === 'Wszystkie' ? 'Wszystkie kategorie' : category;
  const manufacturerLabel =
    manufacturer === 'Wszyscy' ? 'Wszyscy producenci' : manufacturer;

  const visibleCategories = categories.filter(
    (c) => c === 'Wszystkie' || (categoryCounts[c] ?? 0) > 0,
  );
  const visibleManufacturers = manufacturers.filter(
    (m) => m === 'Wszyscy' || (manufacturerCounts[m] ?? 0) > 0,
  );
  const showManufacturerFilter =
    !!onManufacturerChange && visibleManufacturers.length > 1;

  function pickCategory(cat: string) {
    onCategoryChange(cat);
    setOpenMenu(null);
  }

  function pickManufacturer(m: string) {
    onManufacturerChange?.(m);
    setOpenMenu(null);
  }

  function manufacturerButton(name: string) {
    const count = manufacturerCounts[name] ?? 0;
    const selected = manufacturer === name;
    return (
      <button
        key={name}
        type="button"
        onClick={() => pickManufacturer(name)}
        className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition ${
          selected
            ? 'border-brand-500/50 bg-brand-50 font-semibold text-brand-900 ring-1 ring-brand-500/25 dark:bg-brand-500/15 dark:text-brand-100'
            : 'border-slate-700/80 bg-slate-800/40 text-slate-200 hover:border-slate-600 hover:bg-slate-800'
        }`}
      >
        <span className="min-w-0 truncate">{name}</span>
        {count > 0 && (
          <span
            className={`shrink-0 tabular-nums text-xs ${selected ? 'text-brand-800 dark:text-brand-300' : 'text-slate-500'}`}
          >
            {count}
          </span>
        )}
      </button>
    );
  }

  function manufacturerGrid(className: string) {
    return (
      <div className={`grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3 ${className}`}>
        {visibleManufacturers.map((m) => manufacturerButton(m))}
      </div>
    );
  }

  function categoryButton(cat: string) {
    const count = categoryCounts[cat] ?? 0;
    const selected = category === cat;
    return (
      <button
        key={cat}
        type="button"
        onClick={() => pickCategory(cat)}
        className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition ${
          selected
            ? 'border-brand-500/50 bg-brand-50 font-semibold text-brand-900 ring-1 ring-brand-500/25 dark:bg-brand-500/15 dark:text-brand-100'
            : 'border-slate-700/80 bg-slate-800/40 text-slate-200 hover:border-slate-600 hover:bg-slate-800'
        }`}
      >
        <span className="min-w-0 truncate">{cat}</span>
        {count > 0 && (
          <span
            className={`shrink-0 tabular-nums text-xs ${selected ? 'text-brand-800 dark:text-brand-300' : 'text-slate-500'}`}
          >
            {count}
          </span>
        )}
      </button>
    );
  }

  function categoryGrid(className: string) {
    if (shopCategoryGroups?.length) {
      const visibleSet = new Set(visibleCategories);
      const groupedLeaves = new Set<string>();
      const sections = shopCategoryGroups
        .map((g) => ({
          root: g.root,
          leaves: g.leaves.filter((leaf) => visibleSet.has(leaf) && (categoryCounts[leaf] ?? 0) > 0),
        }))
        .filter((g) => g.leaves.length > 0);
      for (const g of sections) {
        for (const leaf of g.leaves) groupedLeaves.add(leaf);
      }
      const ungrouped = visibleCategories.filter(
        (c) => c !== 'Wszystkie' && !groupedLeaves.has(c),
      );

      return (
        <div className={`space-y-4 ${className.includes('grid') ? '' : className}`}>
          {visibleCategories.includes('Wszystkie') && (
            <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">{categoryButton('Wszystkie')}</div>
          )}
          {sections.map((g) => (
            <div key={g.root}>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {g.root}
              </p>
              <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                {g.leaves.map((leaf) => categoryButton(leaf))}
              </div>
            </div>
          ))}
          {ungrouped.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Inne
              </p>
              <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                {ungrouped.map((cat) => categoryButton(cat))}
              </div>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className={className}>
        {visibleCategories.map((cat) => categoryButton(cat))}
      </div>
    );
  }

  function optionList<T extends string>(
    options: { id: T; label: string }[],
    current: T,
    onPick: (id: T) => void,
  ) {
    return (
      <ul className="py-1">
        {options.map((opt) => (
          <li key={opt.id}>
            <button
              type="button"
              onClick={() => {
                onPick(opt.id);
                setOpenMenu(null);
              }}
              className={`flex w-full items-center px-3 py-2 text-left text-sm transition ${
                current === opt.id
                  ? 'bg-brand-50 font-semibold text-brand-900 dark:bg-brand-500/15 dark:text-brand-100'
                  : 'text-slate-200 hover:bg-slate-800'
              }`}
            >
              {opt.label}
            </button>
          </li>
        ))}
      </ul>
    );
  }

  const activeChips = (
    <div className="flex flex-wrap items-center gap-1.5">
      {catalogFilter && catalogFilter !== 'all' && onCatalogFilterChange && (
        <ActiveChip
          label={CATALOG_LABELS[catalogFilter]}
          onRemove={() => onCatalogFilterChange('all')}
        />
      )}
      {category !== 'Wszystkie' && (
        <ActiveChip label={category} onRemove={() => onCategoryChange('Wszystkie')} />
      )}
      {showManufacturerFilter && manufacturer !== 'Wszyscy' && onManufacturerChange && (
        <ActiveChip label={manufacturer} onRemove={() => onManufacturerChange('Wszyscy')} />
      )}
      {stockFilter !== 'all' && (
        <ActiveChip label={stockLabel} onRemove={() => onStockFilterChange('all')} />
      )}
      {imageFilter !== 'all' && (
        <ActiveChip label={imageLabel} onRemove={() => onImageFilterChange('all')} />
      )}
      {knowledgeFilter !== 'all' && onKnowledgeFilterChange && (
        <ActiveChip label={knowledgeLabel} onRemove={() => onKnowledgeFilterChange('all')} />
      )}
      {baselinkerFilter !== 'all' && onBaselinkerFilterChange && (
        <ActiveChip label={baselinkerLabel} onRemove={() => onBaselinkerFilterChange('all')} />
      )}
      {waproMagFilter !== 'all' && onWaproMagFilterChange && (
        <ActiveChip label={waproMagLabel} onRemove={() => onWaproMagFilterChange('all')} />
      )}
      {visibilityFilter !== 'active' && onVisibilityFilterChange && (
        <ActiveChip
          label={`Status: ${visibilityLabel}`}
          onRemove={() => onVisibilityFilterChange('active')}
        />
      )}
      {activeFilterCount > 0 && (
        <button
          type="button"
          onClick={onResetFilters}
          className="text-[11px] font-medium text-slate-500 hover:text-slate-300"
        >
          Wyczyść
        </button>
      )}
    </div>
  );

  const catalogKindChips =
    onCatalogFilterChange && catalogFilter && catalogKindCounts ? (
      <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
        {(
          [
            { id: 'all' as const, label: 'Wszystkie', count: catalogKindCounts.all },
            {
              id: 'accessories' as const,
              label: CATALOG_LABELS.accessories,
              count: catalogKindCounts.accessories,
            },
            { id: 'shop' as const, label: CATALOG_LABELS.shop, count: catalogKindCounts.shop },
          ] as const
        ).map((opt) => {
          const selected = catalogFilter === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onCatalogFilterChange(opt.id)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                selected
                  ? 'bg-brand-50 text-brand-900 ring-1 ring-brand-500/35 dark:bg-brand-500/20 dark:text-brand-200'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-100'
              }`}
            >
              {opt.label}
              {opt.count > 0 && (
                <span className={`ml-1 tabular-nums ${selected ? 'opacity-80' : 'opacity-60'}`}>
                  {opt.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    ) : null;

  return (
    <>
      {catalogKindChips && <div className="mb-1">{catalogKindChips}</div>}
      <div className="space-y-2 lg:hidden">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onMobileFiltersOpenChange(true)}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium ${
              activeFilterCount > 0
                ? 'border-brand-500/50 bg-brand-50 text-brand-900 dark:bg-brand-500/15 dark:text-brand-200'
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
          <DensityToggle density={density} onChange={onDensityChange} />
          <p className="ml-auto truncate text-xs text-slate-500">
            {filteredCount} prod.
            {searching && ' · trafność'}
          </p>
        </div>
        {activeFilterCount > 0 && activeChips}
      </div>

      <div ref={barRef} className="relative hidden space-y-2 lg:block">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <FilterTrigger
              label="Kategoria"
              value={categoryLabel}
              active={category !== 'Wszystkie'}
              open={openMenu === 'category'}
              onClick={() => setOpenMenu((m) => (m === 'category' ? null : 'category'))}
            />
            {openMenu === 'category' && (
              <div className="catalog-filter-dropdown absolute left-0 top-full z-30 mt-1 w-[min(42rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl shadow-black/30">
                <div className="border-b border-slate-800 px-4 py-3">
                  <p className="text-sm font-semibold text-slate-100">Kategorie produktów</p>
                  <p className="text-xs text-slate-500">Wybierz dział katalogu</p>
                </div>
                <div className="max-h-[min(20rem,50vh)] overflow-y-auto p-3">
                  {categoryGrid('grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3')}
                </div>
              </div>
            )}
          </div>

          {showManufacturerFilter && (
            <div className="relative">
              <FilterTrigger
                label="Producent"
                value={manufacturerLabel}
                active={manufacturer !== 'Wszyscy'}
                open={openMenu === 'manufacturer'}
                onClick={() =>
                  setOpenMenu((m) => (m === 'manufacturer' ? null : 'manufacturer'))
                }
              />
              {openMenu === 'manufacturer' && (
                <div className="catalog-filter-dropdown absolute left-0 top-full z-30 mt-1 w-[min(36rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl shadow-black/30">
                  <div className="border-b border-slate-800 px-4 py-3">
                    <p className="text-sm font-semibold text-slate-100">Producenci / marki</p>
                    <p className="text-xs text-slate-500">Jak kategorie w WAPRO Mag i Baselinkerze</p>
                  </div>
                  <div className="max-h-[min(20rem,50vh)] overflow-y-auto p-3">
                    {manufacturerGrid('')}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="relative">
            <FilterTrigger
              label="Stan"
              value={stockLabel}
              active={stockFilter !== 'all'}
              open={openMenu === 'stock'}
              onClick={() => setOpenMenu((m) => (m === 'stock' ? null : 'stock'))}
            />
            {openMenu === 'stock' && (
              <div className="catalog-filter-dropdown absolute left-0 top-full z-30 mt-1 w-56 overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-xl">
                {optionList(STOCK_OPTS, stockFilter, onStockFilterChange)}
              </div>
            )}
          </div>

          <div className="relative">
            <FilterTrigger
              label="Zdjęcia"
              value={imageLabel}
              active={imageFilter !== 'all'}
              open={openMenu === 'image'}
              onClick={() => setOpenMenu((m) => (m === 'image' ? null : 'image'))}
            />
            {openMenu === 'image' && (
              <div className="catalog-filter-dropdown absolute left-0 top-full z-30 mt-1 w-52 overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-xl">
                {optionList(IMAGE_OPTS, imageFilter, onImageFilterChange)}
              </div>
            )}
          </div>

          {onKnowledgeFilterChange && (
            <div className="relative">
              <FilterTrigger
                label="Opis / AI"
                value={knowledgeLabel}
                active={knowledgeFilter !== 'all'}
                open={openMenu === 'knowledge'}
                onClick={() => setOpenMenu((m) => (m === 'knowledge' ? null : 'knowledge'))}
              />
              {openMenu === 'knowledge' && (
                <div className="catalog-filter-dropdown absolute left-0 top-full z-30 mt-1 w-56 overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-xl">
                  {optionList(KNOWLEDGE_OPTS, knowledgeFilter, onKnowledgeFilterChange)}
                </div>
              )}
            </div>
          )}

          {onBaselinkerFilterChange && (
            <div className="relative">
              <FilterTrigger
                label="BaseLinker"
                value={baselinkerLabel}
                active={baselinkerFilter !== 'all'}
                open={openMenu === 'baselinker'}
                onClick={() => setOpenMenu((m) => (m === 'baselinker' ? null : 'baselinker'))}
              />
              {openMenu === 'baselinker' && (
                <div className="catalog-filter-dropdown absolute left-0 top-full z-30 mt-1 w-56 overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-xl">
                  {optionList(BASELINKER_OPTS, baselinkerFilter, onBaselinkerFilterChange)}
                </div>
              )}
            </div>
          )}

          {onWaproMagFilterChange && (
            <div className="relative">
              <FilterTrigger
                label="Mag WAPRO"
                value={waproMagLabel}
                active={waproMagFilter !== 'all'}
                open={openMenu === 'waproMag'}
                onClick={() => setOpenMenu((m) => (m === 'waproMag' ? null : 'waproMag'))}
              />
              {openMenu === 'waproMag' && (
                <div className="catalog-filter-dropdown absolute left-0 top-full z-30 mt-1 min-w-[14rem] overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-xl">
                  {optionList(WAPRO_MAG_OPTS, waproMagFilter, onWaproMagFilterChange)}
                </div>
              )}
            </div>
          )}

          {onVisibilityFilterChange && (
            <div className="relative">
              <FilterTrigger
                label="Status"
                value={visibilityLabel}
                active={visibilityFilter !== 'active'}
                open={openMenu === 'visibility'}
                onClick={() => setOpenMenu((m) => (m === 'visibility' ? null : 'visibility'))}
              />
              {openMenu === 'visibility' && (
                <div className="catalog-filter-dropdown absolute left-0 top-full z-30 mt-1 w-48 overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-xl">
                  {optionList(VISIBILITY_OPTS, visibilityFilter, onVisibilityFilterChange)}
                </div>
              )}
            </div>
          )}

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <SortSelect sort={sort} onChange={onSortChange} disabled={sortDisabled} />
            <DensityToggle density={density} onChange={onDensityChange} />
            {canAddProduct && onAddProduct && (
              <button
                type="button"
                onClick={onAddProduct}
                className="inline-flex items-center gap-1.5 rounded-lg border border-brand-500/40 bg-brand-500/10 px-3 py-1.5 text-xs font-semibold text-brand-200 hover:bg-brand-500/20"
              >
                <Plus className="h-4 w-4" />
                Dodaj
              </button>
            )}
            {trailing}
          </div>
        </div>

        {activeFilterCount > 0 && activeChips}

        <p className="text-sm text-slate-500">
          {filteredCount} {filteredCount === 1 ? 'produkt' : 'produktów'}
          {searchHint}
          {searching && ' · wg trafności'}
        </p>
      </div>

      {mobileFiltersOpen && (
        <div className="fixed inset-0 z-[55] lg:hidden" role="dialog" aria-label="Filtry">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Zamknij"
            onClick={() => onMobileFiltersOpenChange(false)}
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-3xl border border-slate-700 bg-slate-900 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-slate-800 bg-slate-900 px-4 py-3">
              <p className="font-semibold text-slate-100">Filtry katalogu</p>
              <button
                type="button"
                onClick={() => onMobileFiltersOpenChange(false)}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-800"
                aria-label="Zamknij"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-5 px-4 py-4">
              <div>
                <button
                  type="button"
                  onClick={() => setMobileCategoryExpanded((v) => !v)}
                  className="mb-2 flex w-full items-center justify-between gap-2"
                >
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Kategoria
                  </span>
                  <span className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-slate-300">
                    <span className="max-w-[12rem] truncate">{categoryLabel}</span>
                    <ChevronDown
                      className={`h-3.5 w-3.5 shrink-0 transition-transform ${mobileCategoryExpanded ? 'rotate-180' : ''}`}
                    />
                  </span>
                </button>
                {mobileCategoryExpanded && categoryGrid('grid gap-1.5 sm:grid-cols-2')}
              </div>
              {showManufacturerFilter && (
                <div>
                  <button
                    type="button"
                    onClick={() => setMobileManufacturerExpanded((v) => !v)}
                    className="mb-2 flex w-full items-center justify-between gap-2"
                  >
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Producent / marka
                    </span>
                    <span className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-slate-300">
                      <span className="max-w-[12rem] truncate">{manufacturerLabel}</span>
                      <ChevronDown
                        className={`h-3.5 w-3.5 shrink-0 transition-transform ${mobileManufacturerExpanded ? 'rotate-180' : ''}`}
                      />
                    </span>
                  </button>
                  {mobileManufacturerExpanded && manufacturerGrid('grid gap-1.5 sm:grid-cols-2')}
                </div>
              )}
              <MobileFilterSection title="Stan magazynowy">
                <div className="flex flex-wrap gap-1.5">
                  {STOCK_OPTS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => onStockFilterChange(opt.id)}
                      className={`rounded-lg px-2.5 py-1.5 text-xs font-medium ${
                        stockFilter === opt.id ? 'bg-brand-500 text-white' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </MobileFilterSection>
              <MobileFilterSection title="Zdjęcia">
                <div className="flex flex-wrap gap-1.5">
                  {IMAGE_OPTS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => onImageFilterChange(opt.id)}
                      className={`rounded-lg px-2.5 py-1.5 text-xs font-medium ${
                        imageFilter === opt.id ? 'bg-brand-500 text-white' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </MobileFilterSection>
              {onKnowledgeFilterChange && (
                <MobileFilterSection title="Opis w katalogu / AI">
                  <div className="flex flex-wrap gap-1.5">
                    {KNOWLEDGE_OPTS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => onKnowledgeFilterChange(opt.id)}
                        className={`rounded-lg px-2.5 py-1.5 text-xs font-medium ${
                          knowledgeFilter === opt.id
                            ? 'bg-brand-500 text-white'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </MobileFilterSection>
              )}
              {onBaselinkerFilterChange && (
                <MobileFilterSection title="BaseLinker">
                  <div className="flex flex-wrap gap-1.5">
                    {BASELINKER_OPTS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => onBaselinkerFilterChange(opt.id)}
                        className={`rounded-lg px-2.5 py-1.5 text-xs font-medium ${
                          baselinkerFilter === opt.id
                            ? 'bg-brand-500 text-white'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </MobileFilterSection>
              )}
              {onWaproMagFilterChange && (
                <MobileFilterSection title="Import z Mag WAPRO">
                  <div className="flex flex-wrap gap-1.5">
                    {WAPRO_MAG_OPTS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => onWaproMagFilterChange(opt.id)}
                        className={`rounded-lg px-2.5 py-1.5 text-xs font-medium ${
                          waproMagFilter === opt.id
                            ? 'bg-brand-500 text-white'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </MobileFilterSection>
              )}
              {onVisibilityFilterChange && (
                <MobileFilterSection title="Status produktu">
                  <div className="flex flex-wrap gap-1.5">
                    {VISIBILITY_OPTS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => onVisibilityFilterChange(opt.id)}
                        className={`rounded-lg px-2.5 py-1.5 text-xs font-medium ${
                          visibilityFilter === opt.id
                            ? 'bg-brand-500 text-white'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </MobileFilterSection>
              )}
              <MobileFilterSection title="Sortowanie">
                <SortSelect sort={sort} onChange={onSortChange} disabled={sortDisabled} />
              </MobileFilterSection>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={onResetFilters}
                  className="flex-1 rounded-xl border border-slate-700 py-2.5 text-sm text-slate-300"
                >
                  Wyczyść
                </button>
                <button
                  type="button"
                  onClick={() => onMobileFiltersOpenChange(false)}
                  className="flex-1 rounded-xl bg-brand-600 py-2.5 text-sm font-medium text-white"
                >
                  Gotowe ({filteredCount})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
