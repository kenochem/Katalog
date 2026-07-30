import { Minus, Plus, ShoppingCart, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  getOrderDraft,
  removeDraftItem,
  setDraftItemQty,
  type OrderDraft,
} from '../lib/orderDraft';
import { getProductImage } from '../lib/products';
import type { Product } from '../types';

interface CrmOrderSidePanelProps {
  products: Product[];
  revision: number;
  onOpenFull: () => void;
  onChanged?: () => void;
}

export function CrmOrderSidePanel({
  products,
  revision,
  onOpenFull,
  onChanged,
}: CrmOrderSidePanelProps) {
  const [draft, setDraft] = useState<OrderDraft>(() => getOrderDraft());

  useEffect(() => {
    setDraft(getOrderDraft());
  }, [revision]);

  function refresh() {
    setDraft(getOrderDraft());
    onChanged?.();
  }

  function bump(productId: string, delta: number) {
    const item = draft.items.find((i) => i.productId === productId);
    if (!item) return;
    const next = item.quantity + delta;
    if (next <= 0) removeDraftItem(productId);
    else setDraftItemQty(productId, next);
    refresh();
  }

  function itemImage(item: OrderDraft['items'][number]) {
    if (item.imageUrl) return item.imageUrl;
    const p =
      products.find((x) => x.id === item.productId) ||
      products.find((x) => x.sku === item.sku);
    return p ? getProductImage(p) || undefined : undefined;
  }

  if (!draft.items.length) return null;

  const totalQty = draft.items.reduce((s, i) => s + i.quantity, 0);
  const isQuote = draft.kind === 'quote';

  return (
    <aside className="fixed bottom-4 right-4 top-[5.5rem] z-40 hidden w-[22rem] flex-col overflow-hidden rounded-2xl border border-brand-500/35 bg-slate-950/95 shadow-2xl shadow-black/40 backdrop-blur-md xl:flex">
      <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-3.5 py-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[15px] font-semibold text-slate-50">
            <ShoppingCart className="h-5 w-5 shrink-0 text-brand-400" />
            {isQuote ? 'Prośba o ofertę' : 'Zamówienie'}
          </p>
          <p className="mt-0.5 truncate text-xs text-slate-400">
            {draft.clientName || 'Bez klienta'}
            <span className="text-slate-600"> · </span>
            {draft.items.length} poz.
            <span className="text-slate-600"> · </span>
            {totalQty} szt.
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenFull}
          className="shrink-0 rounded-xl bg-brand-600 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-500"
        >
          Otwórz
        </button>
      </div>

      <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2.5">
        {draft.items.map((item) => (
          <li
            key={item.productId}
            className="flex items-center gap-2.5 rounded-xl border border-slate-800 bg-slate-900/80 px-2 py-2"
          >
            {itemImage(item) ? (
              <img
                src={itemImage(item)}
                alt=""
                className="h-12 w-12 shrink-0 rounded-lg object-contain bg-slate-800"
              />
            ) : (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-[10px] text-slate-500">
                —
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-xs font-medium leading-snug text-slate-100">
                {item.displayName}
              </p>
              <p className="mt-0.5 font-mono text-[11px] text-brand-400">{item.sku}</p>
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  className="flex h-7 w-7 items-center justify-center rounded-md bg-red-600 text-white hover:bg-red-500"
                  onClick={() => bump(item.productId, -1)}
                  aria-label="Mniej"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="w-6 text-center text-sm font-semibold tabular-nums text-slate-100">
                  {item.quantity}
                </span>
                <button
                  type="button"
                  className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-600 text-white hover:bg-brand-500"
                  onClick={() => bump(item.productId, 1)}
                  aria-label="Więcej"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
              <button
                type="button"
                className="text-slate-500 hover:text-red-400"
                onClick={() => {
                  removeDraftItem(item.productId);
                  refresh();
                }}
                aria-label="Usuń"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </aside>
  );
}
