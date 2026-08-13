import { useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import type { Product } from '../../types';
import { formatPricePln } from '../../lib/format';
import { getProductImage } from '../../lib/products';
import type { OrderDraftItem } from '../../lib/orderDraft';

interface OrderProductPickerProps {
  products: Product[];
  draft: OrderDraftItem[];
  onAdd: (product: Product) => void;
  className?: string;
}

export function OrderProductPicker({
  products,
  draft,
  onAdd,
  className = '',
}: OrderProductPickerProps) {
  const [query, setQuery] = useState('');
  const draftIds = useMemo(() => new Set(draft.map((d) => d.productId)), [draft]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return products
      .filter((p) => {
        const hay = `${p.sku} ${p.name} ${p.displayName ?? ''} ${p.manufacturer ?? ''} ${p.ean ?? ''}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 10);
  }, [products, query]);

  return (
    <div className={`rounded-2xl border border-slate-800 bg-slate-900/60 p-3 ${className}`}>
      <label className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2">
        <Search className="h-4 w-4 shrink-0 text-slate-500" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Szukaj SKU, nazwy, EAN…"
          className="min-w-0 flex-1 bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-600"
        />
      </label>

      {query.trim().length >= 2 && (
        <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto">
          {results.length === 0 ? (
            <li className="px-2 py-3 text-center text-xs text-slate-500">Brak wyników</li>
          ) : (
            results.map((p) => {
              const inCart = draftIds.has(p.id);
              const img = getProductImage(p);
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => onAdd(p)}
                    className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left transition hover:bg-brand-500/10"
                  >
                    {img ? (
                      <img
                        src={img}
                        alt=""
                        className="h-10 w-10 shrink-0 rounded-lg bg-slate-800 object-contain"
                      />
                    ) : (
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-[10px] text-slate-600">
                        SKU
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-100">
                        {p.displayName ?? p.name}
                      </span>
                      <span className="font-mono text-[10px] text-slate-500">{p.sku}</span>
                      <span className="mt-0.5 block text-xs tabular-nums text-slate-400">
                        {formatPricePln(p.priceSaleNet ?? 0)} · stan {p.stock ?? '—'}
                      </span>
                    </span>
                    <span
                      className={`inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium ${
                        inCart ? 'bg-brand-600/20 text-brand-300' : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      {inCart ? '+1' : 'Dodaj'}
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      )}

      {query.trim().length > 0 && query.trim().length < 2 && (
        <p className="mt-2 text-center text-[11px] text-slate-600">Wpisz min. 2 znaki</p>
      )}
    </div>
  );
}
