import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import {
  BarChart3,
  ImageOff,
  Layers,
  Package,
  Printer,
  Search,
  Sparkles,
  Star,
  FolderOpen,
  X,
} from 'lucide-react';
import type { Product, View } from '../types';
import { getProductSearchIndex, searchIndexedProducts } from '../lib/productSearchIndex';
import { BaselinkerTag } from './BaselinkerTag';

export interface CatalogCommandAction {
  id: string;
  label: string;
  hint?: string;
  icon: ReactNode;
  run: () => void;
}

interface CatalogCommandPaletteProps {
  search: string;
  onSearchChange: (v: string) => void;
  products: Product[];
  onOpenProduct: (p: Product) => void;
  onNavigate: (view: View) => void;
  onOpenMissingImages?: () => void;
  onOpenLens?: () => void;
  onOpenScanner?: () => void;
  onSyncStock?: () => void;
  canSyncStock?: boolean;
  canFavorites?: boolean;
  canKits?: boolean;
  canCollections?: boolean;
  canLabels?: boolean;
  canProgress?: boolean;
  className?: string;
  /** Na desktopie: tylko filtr siatki — bez rozwijanej listy nad produktami. */
  overlaySuggestions?: boolean;
}

export function CatalogCommandPalette({
  search,
  onSearchChange,
  products,
  onOpenProduct,
  onNavigate,
  onOpenMissingImages,
  onOpenLens,
  onOpenScanner,
  onSyncStock,
  canSyncStock,
  canFavorites,
  canKits,
  canCollections,
  canLabels,
  canProgress,
  className = '',
  overlaySuggestions = true,
}: CatalogCommandPaletteProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const query = search;

  const trimmedQuery = query.trim();

  const productHits = useMemo(() => {
    if (trimmedQuery.length < 2) return [];
    const index = getProductSearchIndex(products);
    return searchIndexedProducts(index, trimmedQuery, {
      limit: overlaySuggestions ? 8 : 12,
    });
  }, [products, trimmedQuery, overlaySuggestions]);

  const close = () => {
    setOpen(false);
    setActiveIndex(0);
  };

  const staticActions = useMemo((): CatalogCommandAction[] => {
    const wrap = (run: () => void) => () => {
      run();
      close();
      onSearchChange('');
    };
    const items: CatalogCommandAction[] = [
      {
        id: 'nav-catalog',
        label: 'Widok: Katalog',
        icon: <Search className="h-4 w-4" />,
        run: wrap(() => onNavigate('catalog')),
      },
    ];
    if (canFavorites) {
      items.push({
        id: 'nav-fav',
        label: 'Widok: Ulubione',
        icon: <Star className="h-4 w-4" />,
        run: wrap(() => onNavigate('favorites')),
      });
    }
    if (canKits) {
      items.push({
        id: 'nav-kits',
        label: 'Widok: Zestawy',
        icon: <Layers className="h-4 w-4" />,
        run: wrap(() => onNavigate('kits')),
      });
    }
    if (canCollections) {
      items.push({
        id: 'nav-collections',
        label: 'Widok: Foldery robocze',
        icon: <FolderOpen className="h-4 w-4" />,
        run: wrap(() => onNavigate('collections')),
      });
    }
    if (canProgress) {
      items.push({
        id: 'nav-progress',
        label: 'Widok: Postęp zdjęć',
        icon: <BarChart3 className="h-4 w-4" />,
        run: wrap(() => onNavigate('progress')),
      });
      items.push({
        id: 'nav-missing',
        label: 'Widok: Bez zdjęć',
        icon: <ImageOff className="h-4 w-4" />,
        run: wrap(() => {
          onOpenMissingImages?.();
          onNavigate('missing-images');
        }),
      });
    }
    if (canLabels) {
      items.push({
        id: 'nav-labels',
        label: 'Widok: Etykiety',
        icon: <Printer className="h-4 w-4" />,
        run: wrap(() => onNavigate('labels')),
      });
    }
    if (onOpenLens) {
      items.push({
        id: 'lens',
        label: 'Lens — szukaj po zdjęciu',
        icon: <Sparkles className="h-4 w-4" />,
        run: wrap(onOpenLens),
      });
    }
    if (onOpenScanner) {
      items.push({
        id: 'scan',
        label: 'Skaner EAN',
        hint: 'Kamera',
        icon: <Package className="h-4 w-4" />,
        run: wrap(onOpenScanner),
      });
    }
    if (canSyncStock && onSyncStock) {
      items.push({
        id: 'sync',
        label: 'Zleć sync stanów WAPRO',
        icon: <Package className="h-4 w-4" />,
        run: wrap(onSyncStock),
      });
    }
    return items;
  }, [
    onNavigate,
    onOpenMissingImages,
    onOpenLens,
    onOpenScanner,
    onSyncStock,
    canSyncStock,
    canFavorites,
    canKits,
    canLabels,
    canProgress,
    onSearchChange,
  ]);

  const filteredActions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return staticActions;
    return staticActions.filter(
      (a) =>
        a.label.toLowerCase().includes(q) ||
        (a.hint && a.hint.toLowerCase().includes(q)),
    );
  }, [staticActions, query]);

  type Row =
    | { kind: 'product'; product: Product }
    | { kind: 'action'; action: CatalogCommandAction };

  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    for (const p of productHits) out.push({ kind: 'product', product: p });
    for (const a of filteredActions) out.push({ kind: 'action', action: a });
    return out;
  }, [productHits, filteredActions]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, rows.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        if (overlaySuggestions) setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [overlaySuggestions]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) close();
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  function runRow(index: number) {
    const row = rows[index];
    if (!row) return;
    if (row.kind === 'product') {
      onOpenProduct(row.product);
      close();
      onSearchChange('');
    } else {
      row.action.run();
    }
  }

  function onInputKeyDown(e: ReactKeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      inputRef.current?.blur();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActiveIndex((i) => Math.min(i + 1, rows.length - 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (overlaySuggestions) {
        const row = rows[activeIndex];
        if (row?.kind === 'action') {
          row.action.run();
          return;
        }
      }
      close();
      inputRef.current?.blur();
    }
  }

  const showOverlay = overlaySuggestions && open;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2">
        <Search className="h-4 w-4 shrink-0 text-slate-500" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => {
            onSearchChange(e.target.value);
            if (overlaySuggestions) setOpen(true);
          }}
          onFocus={() => {
            if (overlaySuggestions) setOpen(true);
          }}
          onKeyDown={onInputKeyDown}
          placeholder="Szukaj SKU, EAN, nazwy…"
          className="min-w-0 flex-1 bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
          autoComplete="off"
        />
        {query ? (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onSearchChange('');
              close();
              inputRef.current?.focus();
            }}
            className="shrink-0 rounded-full p-1 text-slate-500 hover:bg-slate-800 hover:text-slate-200"
            aria-label="Wyczyść wyszukiwanie"
            title="Wyczyść"
          >
            <X className="h-4 w-4" />
          </button>
        ) : (
          <kbd className="hidden shrink-0 rounded-md border border-slate-600 px-1.5 py-0.5 text-[10px] text-slate-500 xl:inline">
            Ctrl+K
          </kbd>
        )}
      </div>

      {showOverlay && rows.length > 0 && (
        <ul
          className="absolute right-0 top-[calc(100%+6px)] z-[60] max-h-[min(280px,42vh)] w-[min(100vw-1.5rem,20rem)] overflow-y-auto rounded-xl border border-slate-700 bg-slate-950 py-1 shadow-xl sm:w-80"
          role="listbox"
        >
          {rows.map((row, i) =>
            row.kind === 'product' ? (
              <li key={`p-${row.product.id}`}>
                <button
                  type="button"
                  role="option"
                  aria-selected={i === activeIndex}
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => runRow(i)}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${
                    i === activeIndex
                      ? 'bg-brand-500/15 text-slate-50'
                      : 'text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  <Package className="h-4 w-4 shrink-0 text-brand-400" />
                  <span className="min-w-0 flex-1 truncate">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="font-mono text-xs text-brand-300">{row.product.sku}</span>
                      <BaselinkerTag product={row.product} />
                    </span>{' '}
                    {row.product.displayName}
                  </span>
                </button>
              </li>
            ) : (
              <li key={row.action.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={i === activeIndex}
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => runRow(i)}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${
                    i === activeIndex
                      ? 'bg-brand-500/15 text-slate-50'
                      : 'text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  <span className="text-brand-400">{row.action.icon}</span>
                  <span className="min-w-0 flex-1 truncate">{row.action.label}</span>
                  {row.action.hint && (
                    <span className="text-[10px] text-slate-500">
                      {row.action.hint}
                    </span>
                  )}
                </button>
              </li>
            ),
          )}
        </ul>
      )}

      {showOverlay && query.trim().length >= 2 && rows.length === 0 && (
        <p className="absolute right-0 top-[calc(100%+6px)] z-[60] w-[min(100vw-1.5rem,20rem)] rounded-xl border border-slate-700 bg-slate-950 px-3 py-4 text-center text-xs text-slate-500 sm:w-80">
          Brak wyników — spróbuj SKU lub skrótu widoku
        </p>
      )}
    </div>
  );
}
