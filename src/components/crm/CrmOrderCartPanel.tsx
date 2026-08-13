import {
  ChevronDown,
  ChevronUp,
  ClipboardCopy,
  FileDown,
  History,
  Loader2,
  Minus,
  Plus,
  Send,
  ShoppingCart,
  Trash2,
  X,
} from 'lucide-react';
import type { Product } from '../../types';
import { formatPricePln } from '../../lib/format';
import { getProductImage } from '../../lib/products';
import type { CrmClient } from '../../lib/crm';
import type { OrderDraft } from '../../lib/orderDraft';

export interface CrmOrderCartPanelProps {
  draft: OrderDraft;
  draftTotal: number;
  productBySku: Map<string, Product>;
  activeClient: CrmClient | null;
  onSync: (next: OrderDraft) => void;
  onCopy: () => void;
  onCopySku: () => void;
  onPdf: () => void;
  onSaveHistory: () => void;
  onSendDiscord: () => void;
  saving?: boolean;
  sending?: boolean;
  onClose?: () => void;
  className?: string;
}

export function CrmOrderCartPanel({
  draft,
  draftTotal,
  productBySku,
  activeClient,
  onSync,
  onCopy,
  onCopySku,
  onPdf,
  onSaveHistory,
  onSendDiscord,
  saving,
  sending,
  onClose,
  className = '',
}: CrmOrderCartPanelProps) {
  const items = draft.items;
  const totalQty = items.reduce((s, d) => s + d.quantity, 0);
  const grossTotal = draftTotal * 1.23;
  const hasItems = items.length > 0;
  const isQuote = draft.kind === 'quote';

  function bump(productId: string, delta: number) {
    const nextItems = items
      .map((d) =>
        d.productId === productId ? { ...d, quantity: Math.max(0, d.quantity + delta) } : d,
      )
      .filter((d) => d.quantity > 0);
    onSync({ ...draft, items: nextItems });
  }

  function updateNote(note: string) {
    onSync({ ...draft, note });
  }

  function setKind(kind: 'order' | 'quote') {
    onSync({ ...draft, kind });
  }

  return (
    <div
      className={`crm-order-cart flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-xl shadow-black/25 ${className}`}
    >
      <div className="flex shrink-0 items-start justify-between gap-2 border-b border-slate-800 px-4 py-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-base font-semibold text-slate-50">
            <ShoppingCart className="h-5 w-5 shrink-0 text-brand-400" />
            {isQuote ? 'Oferta' : 'Koszyk'}
            {hasItems && (
              <span className="rounded-full bg-amber-500/90 px-2 py-0.5 text-[10px] font-bold text-slate-950">
                {totalQty}
              </span>
            )}
          </p>
          {hasItems ? (
            <p className="mt-0.5 text-xs text-slate-400">
              {items.length} poz. · {totalQty} szt.
              {activeClient ? ` · ${activeClient.displayName}` : ''}
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-slate-500">Dodaj produkty z wyszukiwarki</p>
          )}
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800"
            aria-label="Zwiń koszyk"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="shrink-0 border-b border-slate-800 px-3 py-2">
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-950/80 p-0.5">
          <button
            type="button"
            onClick={() => setKind('order')}
            className={`rounded-md py-1.5 text-[11px] font-semibold ${
              draft.kind !== 'quote' ? 'bg-brand-600 text-white' : 'text-slate-500'
            }`}
          >
            Zamówienie
          </button>
          <button
            type="button"
            onClick={() => setKind('quote')}
            className={`rounded-md py-1.5 text-[11px] font-semibold ${
              draft.kind === 'quote' ? 'bg-amber-400 text-amber-950' : 'text-slate-500'
            }`}
          >
            Prośba o ofertę
          </button>
        </div>
      </div>

      {!hasItems ? (
        <div className="flex flex-1 flex-col items-center justify-center px-4 py-10 text-center">
          <ShoppingCart className="h-10 w-10 text-slate-600" />
          <p className="mt-3 text-sm text-slate-400">Koszyk jest pusty</p>
        </div>
      ) : (
        <>
          <ul className="crm-order-cart-list min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain p-3">
            {items.map((item) => {
              const p = productBySku.get(item.sku.toUpperCase());
              const unit = item.unitPriceNet ?? p?.priceSaleNet ?? 0;
              const line = unit * item.quantity;
              const img = item.imageUrl ?? (p ? getProductImage(p) : null);
              return (
                <li
                  key={item.productId}
                  className="flex items-center gap-2.5 rounded-xl border border-slate-800 bg-slate-950/60 px-2.5 py-2"
                >
                  {img ? (
                    <img
                      src={img}
                      alt=""
                      className="h-11 w-11 shrink-0 rounded-lg bg-slate-800 object-contain"
                    />
                  ) : (
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-[10px] text-slate-500">
                      —
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-xs font-medium leading-snug text-slate-100">
                      {item.displayName}
                    </p>
                    <p className="mt-0.5 font-mono text-[11px] text-brand-400">{item.sku}</p>
                    <p className="mt-0.5 text-[10px] tabular-nums text-slate-500">
                      {formatPricePln(line)}
                    </p>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <div className="flex items-center gap-0.5">
                      <button
                        type="button"
                        className="flex h-7 w-7 items-center justify-center rounded-md bg-red-600/90 text-white hover:bg-red-500"
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
                      onClick={() =>
                        onSync({
                          ...draft,
                          items: items.filter((d) => d.productId !== item.productId),
                        })
                      }
                      aria-label="Usuń"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="shrink-0 space-y-2.5 border-t border-slate-800 bg-slate-950/40 px-4 py-3">
            <label className="block">
              <span className="text-[10px] uppercase tracking-wide text-slate-500">Notatka</span>
              <textarea
                value={draft.note}
                onChange={(e) => updateNote(e.target.value)}
                rows={2}
                className="input-field mt-1 resize-none text-xs"
                placeholder="Termin, dostawa…"
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wide text-slate-500">Netto</p>
                <p className="text-lg font-semibold tabular-nums text-slate-100">
                  {formatPricePln(draftTotal)}
                </p>
              </div>
              <div className="rounded-xl border border-brand-500/30 bg-brand-500/10 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wide text-brand-300/70">Brutto</p>
                <p className="text-lg font-semibold tabular-nums text-brand-200">
                  {formatPricePln(grossTotal)}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={onCopy}
                className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl border border-slate-700 px-2 py-2 text-xs text-slate-300 hover:bg-slate-800"
              >
                <ClipboardCopy className="h-3.5 w-3.5" />
                Kopiuj
              </button>
              <button
                type="button"
                onClick={onCopySku}
                className="rounded-xl border border-slate-700 px-2.5 py-2 text-xs text-slate-300 hover:bg-slate-800"
              >
                SKU
              </button>
              <button
                type="button"
                onClick={onPdf}
                className="rounded-xl border border-slate-700 px-2.5 py-2 text-xs text-slate-300 hover:bg-slate-800"
              >
                <FileDown className="h-3.5 w-3.5 inline" /> PDF
              </button>
              <button
                type="button"
                onClick={onSaveHistory}
                disabled={saving}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-700 px-2.5 py-2 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <History className="h-3.5 w-3.5" />
                )}
                Zapisz
              </button>
              <button
                type="button"
                onClick={onSendDiscord}
                disabled={sending}
                className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl bg-brand-600 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
              >
                {sending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                Discord
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function CrmOrderCartMobileBar({
  qty,
  total,
  open,
  onToggle,
}: {
  qty: number;
  total: number;
  open: boolean;
  onToggle: () => void;
}) {
  if (qty <= 0) return null;
  return (
    <button
      type="button"
      onClick={onToggle}
      className="crm-order-cart-bar fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-[55] flex items-center justify-between gap-3 border-t border-slate-700 bg-slate-950/95 px-4 py-3 backdrop-blur-md lg:hidden"
    >
      <span className="inline-flex items-center gap-2 text-sm font-semibold text-white">
        <ShoppingCart className="h-4 w-4 text-brand-400" />
        Koszyk · {qty} szt.
      </span>
      <span className="inline-flex items-center gap-2 tabular-nums text-sm font-semibold text-brand-200">
        {formatPricePln(total)}
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
      </span>
    </button>
  );
}
