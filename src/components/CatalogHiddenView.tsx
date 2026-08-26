import { Eye, ImageOff, RotateCcw, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Product } from '../types';
import { getProductImage } from '../lib/products';
import { getProductDisplayCategory } from '../lib/catalogCategory';
import { effectiveManufacturer } from '../lib/waproManufacturers';

export function CatalogHiddenView({
  products,
  restoringId,
  onOpenProduct,
  onRestoreProduct,
}: {
  products: Product[];
  restoringId?: string | null;
  onOpenProduct: (product: Product) => void;
  onRestoreProduct: (product: Product) => void;
}) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('pl');
    if (!q) return products;
    return products.filter((p) =>
      [p.sku, p.displayName, p.name, effectiveManufacturer(p), getProductDisplayCategory(p), p.meta?.catalogHiddenReason]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('pl')
        .includes(q),
    );
  }, [products, query]);

  const byReason = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of products) {
      const reason = p.meta?.catalogHiddenReason?.trim() || 'Bez powodu';
      map.set(reason, (map.get(reason) || 0) + 1);
    }
    return [...map.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason, 'pl'))
      .slice(0, 5);
  }, [products]);

  return (
    <div className="catalog-readable-light mx-auto max-w-6xl space-y-4 pb-10">
      <section className="surface-panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-300">
              Kontrola widoczności
            </p>
            <h2 className="mt-1 text-xl font-bold text-slate-950 dark:text-slate-50">
              Ukryte towary
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-700 dark:text-slate-400">
              Produkty zostają w bazie i synchronizacji, ale nie pokazują się domyślnie w katalogu.
              Tutaj możesz sprawdzić powód i przywrócić pozycję, jeśli została schowana omyłkowo.
            </p>
          </div>
          <span className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-950 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
            {products.length.toLocaleString('pl-PL')} ukrytych
          </span>
        </div>
      </section>

      <div className="grid gap-3 md:grid-cols-[1fr_2fr]">
        <section className="surface-panel p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
            Najczęstsze powody
          </p>
          <div className="mt-3 space-y-2">
            {byReason.length ? (
              byReason.map((row) => (
                <div
                  key={row.reason}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950"
                >
                  <span className="min-w-0 truncate text-slate-800 dark:text-slate-200">{row.reason}</span>
                  <span className="shrink-0 font-semibold tabular-nums text-slate-950 dark:text-slate-50">
                    {row.count}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-600 dark:text-slate-400">Brak ukrytych produktów.</p>
            )}
          </div>
        </section>

        <section className="surface-panel p-4">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Szukaj po SKU, nazwie, producencie, kategorii lub powodzie..."
              className="input-field pl-9"
            />
          </label>
          <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
            Pokazuje {filtered.length.toLocaleString('pl-PL')} z {products.length.toLocaleString('pl-PL')}.
          </p>
        </section>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950/30 dark:shadow-none">
        <div className="grid grid-cols-[4.5rem_1fr_auto] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-400">
          <span>Foto</span>
          <span>Produkt</span>
          <span>Akcja</span>
        </div>
        {filtered.length ? (
          <ul className="divide-y divide-slate-200 dark:divide-slate-800">
            {filtered.slice(0, 500).map((product) => {
              const image = getProductImage(product);
              const busy = restoringId === product.id;
              return (
                <li key={product.id} className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-3 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => onOpenProduct(product)}
                    className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 transition hover:border-brand-400 dark:border-slate-700 dark:bg-slate-900"
                    title="Otwórz produkt"
                  >
                    {image ? (
                      <img src={image} alt="" className="h-full w-full object-contain p-1" />
                    ) : (
                      <ImageOff className="h-6 w-6 text-slate-500" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenProduct(product)}
                    className="min-w-0 text-left"
                  >
                    <span className="block truncate font-semibold text-slate-950 dark:text-slate-50">
                      {product.displayName}
                    </span>
                    <span className="mt-0.5 block font-mono text-xs text-slate-600 dark:text-slate-400">
                      {product.sku} · {effectiveManufacturer(product)} · stan {product.stock ?? 0}
                    </span>
                    <span className="mt-1 block text-xs text-slate-700 dark:text-slate-300">
                      {getProductDisplayCategory(product)}
                      {product.meta?.catalogHiddenReason ? ` · ${product.meta.catalogHiddenReason}` : ''}
                    </span>
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onOpenProduct(product)}
                      className="hidden rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 sm:inline-flex"
                    >
                      <Eye className="mr-1.5 h-4 w-4" />
                      Podgląd
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onRestoreProduct(product)}
                      className="inline-flex items-center rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-500 disabled:cursor-wait disabled:opacity-60"
                    >
                      <RotateCcw className="mr-1.5 h-4 w-4" />
                      {busy ? 'Przywracam' : 'Przywróć'}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="px-4 py-12 text-center text-sm text-slate-600 dark:text-slate-400">
            Brak ukrytych produktów pasujących do wyszukiwania.
          </div>
        )}
      </section>
    </div>
  );
}
