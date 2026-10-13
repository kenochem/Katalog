import { useState } from 'react';
import { Minus, Pencil, Plus, Trash2 } from 'lucide-react';
import {
  removeFromLabelQueue,
  setLabelQty,
  updateLabelItem,
  type LabelQueueItem,
} from '../lib/labelQueue';
import type { Product } from '../types';
import { formatMarginPercent, formatPricePln, marginPercent } from '../lib/format';
import { PACK_UNITS, formatPack, labelNameFor, parsePackFromText, type PackUnit } from '../lib/labelPack';

interface Props {
  item: LabelQueueItem;
  /** Czy na etykiecie jest włączona cena jednostkowa (wtedy brak pojemności jest ostrzeżeniem). */
  unitPriceEnabled: boolean;
  /** Stan dopasowania nazwy do etykiety (jedna linia): ucięta / bardzo drobna czcionka. */
  nameStatus?: { overflow: boolean; tiny: boolean; px: number };
  /** Produkt z katalogu — do pokazania cen sprzedaży, zakupu i marży przy ustalaniu ceny promocyjnej. */
  product?: Product;
  /** Pokaż cenę zakupu i marżę (uprawnienie „Ceny i marża”). */
  showMargins?: boolean;
  onChanged: () => void;
}

/** Jedna pozycja listy „Do wydruku”: ilość kopii + edycja nazwy, pojemności i ceny promocyjnej. */
export function LabelItemRow({ item, unitPriceEnabled, nameStatus, product, showMargins = false, onChanged }: Props) {
  const [editing, setEditing] = useState(false);
  const pack = item.pack ?? parsePackFromText(item.displayName);
  const sale =
    item.salePrice != null && item.priceGross != null && item.salePrice > 0 && item.salePrice < item.priceGross;
  const customName = (item.labelName || '').trim();

  // ceny wyjściowe i marża (przed i po promocji)
  const vat = item.vatRate ?? 23;
  const grossNow = item.priceGross ?? null;
  const netNow =
    product?.priceSaleNet != null && Number.isFinite(Number(product.priceSaleNet))
      ? Number(product.priceSaleNet)
      : item.priceNet != null
        ? item.priceNet
        : grossNow != null
          ? grossNow / (1 + vat / 100)
          : null;
  const purchaseNet =
    product?.pricePurchaseNet != null && Number.isFinite(Number(product.pricePurchaseNet))
      ? Number(product.pricePurchaseNet)
      : null;
  const marginNow = marginPercent(purchaseNet, netNow);
  const promoValid = item.salePrice != null && grossNow != null && item.salePrice > 0 && item.salePrice < grossNow;
  const promoNet = item.salePrice != null && item.salePrice > 0 ? item.salePrice / (1 + vat / 100) : null;
  const marginPromo = promoNet != null ? marginPercent(purchaseNet, promoNet) : null;
  const profitPromo = promoNet != null && purchaseNet != null ? promoNet - purchaseNet : null;
  const discountPct = promoValid && grossNow ? ((grossNow - (item.salePrice as number)) / grossNow) * 100 : null;
  const marginTone = (m: number | null) =>
    m == null ? 'text-slate-400' : m <= 0 ? 'text-red-400' : m < 10 ? 'text-amber-300' : 'text-emerald-300';

  function patch(p: Partial<LabelQueueItem>) {
    updateLabelItem(item.id, p);
    onChanged();
  }

  return (
    <li className="rounded-lg border border-slate-800 bg-slate-950/40 px-2.5 py-1.5">
      <div className="flex items-center gap-2.5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-slate-100">{labelNameFor(item)}</p>
          <p className="flex flex-wrap items-center gap-x-1.5 font-mono text-[11px] text-brand-400">
            <span>
              {item.sku}
              {item.ean && item.ean !== item.sku ? ` · ${item.ean}` : ''}
              {item.locationCode ? ` · ${item.locationCode}` : ''}
            </span>
            {sale && (
              <span className="rounded bg-red-600 px-1 font-sans text-[10px] font-bold text-white">promocja</span>
            )}
            {customName && (
              <span className="rounded bg-slate-700 px-1 font-sans text-[10px] text-slate-200">własna nazwa</span>
            )}
            {nameStatus?.overflow && (
              <span className="rounded bg-red-600/90 px-1 font-sans text-[10px] font-bold text-white">
                nazwa ucięta — skróć
              </span>
            )}
            {nameStatus && !nameStatus.overflow && nameStatus.tiny && (
              <span className="rounded bg-amber-500/20 px-1 font-sans text-[10px] text-amber-300">
                nazwa bardzo drobna — rozważ skrócenie
              </span>
            )}
            {unitPriceEnabled && !pack && (
              <span className="rounded bg-amber-500/20 px-1 font-sans text-[10px] text-amber-300">
                brak pojemności
              </span>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className={`rounded-lg p-1.5 hover:bg-slate-800 ${editing ? 'bg-slate-800 text-brand-300' : 'text-slate-400'}`}
          aria-label="Edytuj etykietę"
          title="Nazwa, pojemność, cena promocyjna"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={() => {
              setLabelQty(item.id, (item.qty ?? 1) - 1);
              onChanged();
            }}
            className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-800 text-slate-200 hover:bg-slate-700"
            aria-label="Mniej kopii"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <input
            type="number"
            min={1}
            max={999}
            value={item.qty ?? 1}
            onChange={(e) => {
              setLabelQty(item.id, Number(e.target.value));
              onChanged();
            }}
            className="h-7 w-12 rounded-md border border-slate-700 bg-slate-900 text-center text-sm tabular-nums text-slate-100"
            aria-label="Liczba etykiet"
          />
          <button
            type="button"
            onClick={() => {
              setLabelQty(item.id, (item.qty ?? 1) + 1);
              onChanged();
            }}
            className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-600 text-white hover:bg-brand-500"
            aria-label="Więcej kopii"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
        <button
          type="button"
          onClick={() => {
            removeFromLabelQueue(item.id);
            onChanged();
          }}
          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-800 hover:text-red-400"
          aria-label="Usuń z wydruku"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {editing && (
        <div className="mt-2 grid gap-2 border-t border-slate-800 pt-2 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className="mb-0.5 flex items-center justify-between text-[11px] text-slate-500">
              Nazwa na etykiecie
              {customName && (
                <button type="button" onClick={() => patch({ labelName: '' })} className="text-brand-300 hover:underline">
                  przywróć oryginalną
                </button>
              )}
            </span>
            <input
              value={item.labelName ?? ''}
              onChange={(e) => patch({ labelName: e.target.value })}
              placeholder={labelNameFor({ displayName: item.displayName })}
              maxLength={120}
              className="input-field text-sm"
            />
            <span className="mt-0.5 block text-[10px] text-slate-600">
              Oryginał: {item.displayName} (na etykiecie ucinamy wszystko od myślnika)
            </span>
          </label>

          <div>
            <span className="mb-0.5 block text-[11px] text-slate-500">
              Pojemność / waga opakowania
              {pack && !item.pack ? ` (rozpoznano: ${formatPack(pack)})` : ''}
            </span>
            <div className="flex gap-1.5">
              <input
                type="number"
                min={0}
                step="any"
                value={pack?.qty ?? ''}
                onChange={(e) => {
                  const q = Number(e.target.value);
                  patch({
                    pack:
                      e.target.value !== '' && Number.isFinite(q) && q > 0
                        ? { qty: q, unit: (pack?.unit ?? 'ml') as PackUnit }
                        : null,
                  });
                }}
                placeholder="np. 500"
                className="input-field w-24 text-sm"
              />
              <select
                value={pack?.unit ?? 'ml'}
                onChange={(e) => patch({ pack: { qty: pack?.qty ?? 1, unit: e.target.value as PackUnit } })}
                className="input-field w-20 text-sm"
              >
                {PACK_UNITS.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="sm:col-span-2">
            <div className="mb-2 grid grid-cols-2 gap-x-3 gap-y-1 rounded-lg border border-slate-800 bg-slate-900/60 p-2 text-[12px] sm:grid-cols-4">
              <div>
                <span className="block text-[10px] uppercase tracking-wide text-slate-500">Sprzedaż brutto</span>
                <span className="font-semibold tabular-nums text-slate-100">
                  {grossNow != null ? formatPricePln(grossNow) : '—'}
                </span>
              </div>
              <div>
                <span className="block text-[10px] uppercase tracking-wide text-slate-500">Sprzedaż netto</span>
                <span className="font-semibold tabular-nums text-slate-100">
                  {netNow != null ? formatPricePln(Math.round(netNow * 100) / 100) : '—'}
                </span>
              </div>
              {showMargins && (
                <>
                  <div>
                    <span className="block text-[10px] uppercase tracking-wide text-slate-500">Zakup netto</span>
                    <span className="font-semibold tabular-nums text-slate-100">
                      {purchaseNet != null ? formatPricePln(purchaseNet) : 'brak'}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase tracking-wide text-slate-500">Marża obecna</span>
                    <span className={`font-semibold tabular-nums ${marginTone(marginNow)}`}>
                      {formatMarginPercent(marginNow)}
                    </span>
                  </div>
                </>
              )}
            </div>
            <span className="mb-0.5 block text-[11px] text-slate-500">
              Cena promocyjna brutto (wariant wyprzedażowy)
            </span>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={0}
                step="0.01"
                value={item.salePrice ?? ''}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  patch({ salePrice: e.target.value !== '' && Number.isFinite(v) && v > 0 ? v : null });
                }}
                placeholder="puste = bez promocji"
                className="input-field w-40 text-sm"
              />
              {item.salePrice != null && (
                <button type="button" onClick={() => patch({ salePrice: null })} className="text-[11px] text-brand-300 hover:underline">
                  usuń
                </button>
              )}
            </div>
            {item.salePrice != null && item.priceGross != null && item.salePrice >= item.priceGross && (
              <span className="mt-0.5 block text-[10px] text-amber-300">
                Cena promocyjna musi być niższa od obecnej, inaczej etykieta jest bez promocji.
              </span>
            )}
            {promoValid && promoNet != null && (
              <div className="mt-1.5 rounded-lg border border-slate-800 bg-slate-900/60 p-2 text-[12px] text-slate-300">
                Po promocji: <b className="tabular-nums">{formatPricePln(item.salePrice as number)}</b> brutto ·{' '}
                <span className="tabular-nums">{formatPricePln(Math.round(promoNet * 100) / 100)}</span> netto
                {discountPct != null && (
                  <span className="text-slate-400"> (obniżka {discountPct.toFixed(1).replace('.', ',')}%)</span>
                )}
                {showMargins &&
                  (purchaseNet != null ? (
                    <div className="mt-0.5">
                      Marża po promocji:{' '}
                      <b className={`tabular-nums ${marginTone(marginPromo)}`}>{formatMarginPercent(marginPromo)}</b>
                      {profitPromo != null && (
                        <span className="text-slate-400">
                          {' '}
                          · zysk {formatPricePln(Math.round(profitPromo * 100) / 100)} / szt.
                        </span>
                      )}
                      {marginPromo != null && marginPromo <= 0 && (
                        <span className="ml-1 font-semibold text-red-400">— sprzedaż poniżej kosztu!</span>
                      )}
                      {marginPromo != null && marginPromo > 0 && marginPromo < 10 && (
                        <span className="ml-1 text-amber-300">— niska marża</span>
                      )}
                    </div>
                  ) : (
                    <div className="mt-0.5 text-amber-300">Brak ceny zakupu — nie da się policzyć marży.</div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}
    </li>
  );
}
