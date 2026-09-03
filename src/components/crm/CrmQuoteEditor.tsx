import { ChevronLeft, Download, Eye, FileDown, Loader2, Minus, Plus, RotateCcw, Truck } from 'lucide-react';
import type { Product } from '../../types';
import type { CrmClient } from '../../lib/crm';
import type { OrderDraft } from '../../lib/orderDraft';
import { formatPricePln } from '../../lib/format';
import { getProductImage } from '../../lib/products';
import {
  QUOTE_DISCOUNT_PRESETS,
  computeQuoteLine,
  computeQuoteTotals,
} from '../../lib/quotePdf';

const DEFAULT_TRANSPORT_COST = 50;

interface CrmQuoteEditorProps {
  draft: OrderDraft;
  productBySku: Map<string, Product>;
  activeClient: CrmClient | null;
  authorLabel: string;
  onSync: (next: OrderDraft) => void;
  onBack: () => void;
  onGeneratePdf: () => void;
  generatingQuote?: boolean;
  generatedQuote?: { html: string; number: string } | null;
  onPreviewQuote?: () => void;
  onDownloadQuote?: () => void;
  onClear: () => void;
}

export function CrmQuoteEditor({
  draft,
  productBySku,
  activeClient,
  onSync,
  onBack,
  onGeneratePdf,
  generatingQuote,
  generatedQuote,
  onPreviewQuote,
  onDownloadQuote,
  onClear,
}: CrmQuoteEditorProps) {
  const catalogNetBySku = new Map<string, number>();
  for (const [k, p] of productBySku) {
    if (p.priceSaleNet != null) catalogNetBySku.set(k.toUpperCase(), p.priceSaleNet);
  }

  const discountPct = draft.discountPct ?? 0;
  const totals = computeQuoteTotals(draft.items, catalogNetBySku, discountPct, draft.transportCost);
  const transportEnabled = draft.transportCost != null;

  function toggleTransport() {
    onSync({
      ...draft,
      kind: 'quote',
      transportCost: transportEnabled ? undefined : DEFAULT_TRANSPORT_COST,
    });
  }

  function setTransportAmount(raw: string) {
    const parsed = Number(raw.replace(',', '.'));
    onSync({
      ...draft,
      kind: 'quote',
      transportCost: Number.isFinite(parsed) ? Math.max(0, parsed) : 0,
    });
  }

  function updateItemPrice(productId: string, raw: string) {
    const parsed = Number(raw.replace(',', '.'));
    const unitPriceNet = Number.isFinite(parsed) ? Math.max(0, parsed) : null;
    onSync({
      ...draft,
      kind: 'quote',
      items: draft.items.map((i) =>
        i.productId === productId ? { ...i, unitPriceNet } : i,
      ),
    });
  }

  function updateLineDiscount(productId: string, raw: string) {
    const parsed = Number(raw.replace(',', '.'));
    const lineDiscountPct = Number.isFinite(parsed)
      ? Math.min(100, Math.max(0, parsed))
      : undefined;
    onSync({
      ...draft,
      kind: 'quote',
      items: draft.items.map((i) =>
        i.productId === productId ? { ...i, lineDiscountPct } : i,
      ),
    });
  }

  function updateItemQty(productId: string, delta: number) {
    onSync({
      ...draft,
      items: draft.items
        .map((i) =>
          i.productId === productId ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i,
        )
        .filter((i) => i.quantity > 0),
    });
  }

  function resetItemPrice(productId: string) {
    onSync({
      ...draft,
      items: draft.items.map((i) =>
        i.productId === productId
          ? { ...i, unitPriceNet: undefined, lineDiscountPct: undefined }
          : i,
      ),
    });
  }

  function setGlobalDiscount(pct: number) {
    onSync({ ...draft, kind: 'quote', discountPct: pct });
  }

  return (
    <div className="crm-quote-editor space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="crm-link inline-flex items-center gap-1.5 text-sm"
          >
            <ChevronLeft className="h-4 w-4" />
            Wróć do katalogu
          </button>
          <h2 className="crm-heading mt-2 text-xl font-semibold">Tworzenie oferty</h2>
          <p className="crm-muted mt-1 text-sm">
            Ustaw ceny i rabaty per pozycja, opcjonalnie rabat globalny — na końcu generuj PDF.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" onClick={onClear} className="crm-btn-secondary text-xs">
              <RotateCcw className="h-3.5 w-3.5" />
              Wyczyść
            </button>
            <button
              type="button"
              onClick={onGeneratePdf}
              disabled={generatingQuote}
              className="crm-btn-offer text-sm disabled:opacity-60"
            >
              {generatingQuote ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileDown className="h-4 w-4" />
              )}
              {generatedQuote ? 'Generuj ponownie' : 'Generuj PDF oferty'}
            </button>
          </div>
          {generatedQuote && (
            <div className="flex items-center gap-2">
              <span className="crm-muted font-mono text-xs">Nr {generatedQuote.number}</span>
              <button
                type="button"
                onClick={onPreviewQuote}
                className="crm-btn-secondary text-xs"
              >
                <Eye className="h-3.5 w-3.5" />
                Podgląd
              </button>
              <button
                type="button"
                onClick={onDownloadQuote}
                className="crm-btn-secondary text-xs"
              >
                <Download className="h-3.5 w-3.5" />
                Pobierz
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_min(20rem,32%)]">
        <div className="crm-panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="crm-panel-head text-[10px] uppercase tracking-wide">
                  <th className="px-3 py-2.5">Produkt</th>
                  <th className="px-3 py-2.5 text-center">Ilość</th>
                  <th className="px-3 py-2.5 text-right">Cena netto</th>
                  <th className="px-3 py-2.5 text-center">Rabat %</th>
                  <th className="px-3 py-2.5 text-right">Wartość netto</th>
                </tr>
              </thead>
              <tbody>
                {draft.items.map((item) => {
                  const p = productBySku.get(item.sku.toUpperCase());
                  const catalogNet = p?.priceSaleNet ?? 0;
                  const line = computeQuoteLine(item, catalogNet);
                  const img = item.imageUrl ?? (p ? getProductImage(p) : null);
                  const edited =
                    item.unitPriceNet != null || (item.lineDiscountPct ?? 0) > 0;
                  return (
                    <tr key={item.productId} className="crm-panel-row">
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-3">
                          {img ? (
                            <img
                              src={img}
                              alt=""
                              className="h-12 w-12 shrink-0 rounded-lg bg-slate-100 object-contain dark:bg-slate-800"
                            />
                          ) : (
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[10px] text-slate-500 dark:bg-slate-800">
                              —
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="crm-heading line-clamp-2 text-sm font-medium">
                              {item.displayName}
                            </p>
                            <p className="font-mono text-xs text-brand-600 dark:text-brand-400">
                              {item.sku}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => updateItemQty(item.productId, -1)}
                            className="flex h-6 w-6 items-center justify-center rounded-md bg-red-600/90 text-white hover:bg-red-500"
                            aria-label="Mniej"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="crm-heading w-6 text-center text-sm font-semibold tabular-nums">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateItemQty(item.productId, 1)}
                            className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-600 text-white hover:bg-brand-500"
                            aria-label="Więcej"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                        {p && (
                          <p className="crm-muted mt-0.5 text-center text-[10px]">
                            dostępne: {p.stock ?? 0}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            value={line.unitNet}
                            onChange={(e) => updateItemPrice(item.productId, e.target.value)}
                            className="input-field w-24 text-right text-xs tabular-nums"
                          />
                          {edited && (
                            <button
                              type="button"
                              onClick={() => resetItemPrice(item.productId)}
                              className="crm-muted text-[10px] hover:text-brand-600 dark:hover:text-brand-400"
                              title="Przywróć cenę katalogową"
                            >
                              ↺
                            </button>
                          )}
                        </div>
                        {item.unitPriceNet != null && catalogNet > 0 && (
                          <p className="crm-muted mt-0.5 text-right text-[10px]">
                            katalog: {formatPricePln(catalogNet)}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <div className="text-center">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step={1}
                            value={item.lineDiscountPct ?? ''}
                            placeholder="0"
                            onChange={(e) => updateLineDiscount(item.productId, e.target.value)}
                            className="input-field mx-auto w-16 text-center text-xs tabular-nums"
                          />
                          {line.lineDiscountPct > 0 && (
                            <p className="mt-0.5 text-[10px] tabular-nums text-amber-800 dark:text-amber-300">
                              −{formatPricePln(line.lineDiscountAmount)}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="crm-heading px-3 py-3 text-right tabular-nums font-medium">
                        {formatPricePln(line.lineNet)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="space-y-3">
          <div className="crm-panel p-4">
            <p className="crm-label">Klient</p>
            <p className="crm-heading mt-1 text-base font-semibold">
              {activeClient?.displayName || draft.clientName.trim() || '— wpisz u góry ekranu —'}
            </p>
            {activeClient?.address && (
              <p className="crm-muted mt-1 text-xs">{activeClient.address}</p>
            )}
            {activeClient?.nip && (
              <p className="crm-muted text-xs">NIP {activeClient.nip}</p>
            )}
          </div>

          <div className="crm-panel p-4">
            <label className="flex cursor-pointer items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 crm-label">
                <Truck className="h-3.5 w-3.5" />
                Doliczyć transport
              </span>
              <input
                type="checkbox"
                checked={transportEnabled}
                onChange={toggleTransport}
                className="h-4 w-4 accent-brand-600"
              />
            </label>
            {transportEnabled && (
              <label className="crm-label mt-3 block">
                Koszt transportu netto
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={draft.transportCost ?? 0}
                  onChange={(e) => setTransportAmount(e.target.value)}
                  className="input-field mt-1 text-sm tabular-nums"
                />
              </label>
            )}
          </div>

          <div className="crm-panel p-4">
            <p className="crm-label">Rabat globalny (na całość)</p>
            <p className="crm-muted mt-1 text-[11px]">
              Nakłada się po rabatach poszczególnych pozycji. Indywidualna cena ma pierwszeństwo.
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setGlobalDiscount(0)}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
                  discountPct === 0
                    ? 'bg-brand-600 text-white'
                    : 'crm-chip-idle'
                }`}
              >
                0%
              </button>
              {QUOTE_DISCOUNT_PRESETS.map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => setGlobalDiscount(pct)}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
                    discountPct === pct ? 'crm-chip-warn-active' : 'crm-chip-idle'
                  }`}
                >
                  {pct}%
                </button>
              ))}
            </div>
            <label className="crm-label mt-3 block">
              Własny rabat globalny (%)
              <input
                type="number"
                min={0}
                max={100}
                step={1}
                value={discountPct}
                onChange={(e) => setGlobalDiscount(Number(e.target.value) || 0)}
                className="input-field mt-1 text-sm tabular-nums"
              />
            </label>
          </div>

          <div className="crm-panel p-4">
            <label className="crm-label block">
              Uwagi do oferty
              <textarea
                value={draft.note}
                onChange={(e) => onSync({ ...draft, note: e.target.value })}
                rows={4}
                className="input-field mt-2 resize-none text-sm"
                placeholder="Warunki dostawy, termin realizacji, płatność…"
              />
            </label>
            <label className="crm-label mt-3 block">
              Ważność (dni)
              <input
                type="number"
                min={1}
                max={90}
                value={draft.quoteValidDays ?? 14}
                onChange={(e) =>
                  onSync({
                    ...draft,
                    quoteValidDays: Math.min(90, Math.max(1, Number(e.target.value) || 14)),
                  })
                }
                className="input-field mt-1 text-sm tabular-nums"
              />
            </label>
          </div>

          <div className="crm-summary-box p-4">
            <div className="space-y-2 text-sm">
              <div className="crm-muted flex justify-between">
                <span>Suma netto</span>
                <span className="tabular-nums">{formatPricePln(totals.subtotalNet)}</span>
              </div>
              {totals.totalDiscountAmount > 0 && (
                <div className="flex justify-between text-amber-800 dark:text-amber-300">
                  <span>Rabat</span>
                  <span className="tabular-nums">−{formatPricePln(totals.totalDiscountAmount)}</span>
                </div>
              )}
              {totals.transportCost > 0 && (
                <div className="crm-muted flex justify-between">
                  <span>Transport</span>
                  <span className="tabular-nums">{formatPricePln(totals.transportCost)}</span>
                </div>
              )}
              <div className="crm-heading flex justify-between font-semibold">
                <span>Razem netto</span>
                <span className="tabular-nums">{formatPricePln(totals.totalNet)}</span>
              </div>
              <div className="flex justify-between border-t border-brand-500/25 pt-2 text-base font-bold text-brand-700 dark:text-brand-200">
                <span>Brutto (23%)</span>
                <span className="tabular-nums">{formatPricePln(totals.totalGross)}</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
