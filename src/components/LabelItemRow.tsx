import { useState } from 'react';
import { Minus, Pencil, Plus, Trash2 } from 'lucide-react';
import type { Product } from '../types';
import { formatMarginPercent, formatPricePln, marginPercent } from '../lib/format';
import {
  removeFromLabelQueue,
  setLabelPrice,
  setLabelQty,
  updateLabelItem,
  type LabelQueueItem,
} from '../lib/labelQueue';
import { PACK_UNITS, formatPack, labelNameFor, parsePackFromText, type PackUnit } from '../lib/labelPack';
import { PRICE_ROUND_OPTIONS, roundToEnding } from '../lib/priceRounding';

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

const QUICK_DISCOUNTS = [10, 15, 20, 25, 30];

function money(v: number | null | undefined): string {
  return v == null || !Number.isFinite(v) ? '—' : formatPricePln(Math.round(v * 100) / 100);
}

function marginClass(m: number | null): string {
  if (m == null) return 'text-slate-300';
  if (m <= 0) return 'text-red-400';
  if (m < 10) return 'text-amber-300';
  return 'text-emerald-300';
}

/** Jedna pozycja listy „Do wydruku”: ilość kopii + edycja nazwy, pojemności i ceny promocyjnej. */
export function LabelItemRow({
  item,
  unitPriceEnabled,
  nameStatus,
  product,
  showMargins = false,
  onChanged,
}: Props) {
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
  const promoNet = item.salePrice != null && item.salePrice > 0 ? item.salePrice / (1 + vat / 100) : null;
  const marginPromo = promoNet != null ? marginPercent(purchaseNet, promoNet) : null;
  const profitPromo = promoNet != null && purchaseNet != null ? promoNet - purchaseNet : null;
  const discountPct = sale && grossNow ? ((grossNow - (item.salePrice as number)) / grossNow) * 100 : null;
  // progi: cena brutto, poniżej której tracimy (marża 0%) i przy marży 10%
  const breakEvenGross = purchaseNet != null ? purchaseNet * (1 + vat / 100) : null;
  const tenPctGross = purchaseNet != null ? (purchaseNet / 0.9) * (1 + vat / 100) : null;

  function patch(p: Partial<LabelQueueItem>) {
    updateLabelItem(item.id, p);
    onChanged();
  }

  const catalogGross = item.priceGrossCatalog ?? (product ? product.priceSaleGross ?? null : null);
  const priceChanged = grossNow != null && catalogGross != null && Math.abs(grossNow - catalogGross) > 0.004;

  function priceTo(value: number | null) {
    setLabelPrice(item.id, value);
    onChanged();
  }

  function setPromoFromDiscount(pct: number) {
    if (grossNow == null) return;
    patch({ salePrice: Math.round(grossNow * (1 - pct / 100) * 100) / 100 });
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
            {grossNow != null && (
              <span
                className={`rounded px-1 font-sans text-[10px] font-bold ${priceChanged ? 'bg-sky-500/20 text-sky-300' : 'bg-slate-800 text-slate-300'}`}
                title={priceChanged ? `Cena z katalogu: ${money(catalogGross)}` : 'Cena z katalogu'}
              >
                {money(grossNow)}
                {priceChanged ? ' (zmieniona)' : ''}
              </span>
            )}
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
        <div className="mt-2 grid gap-3 border-t border-slate-800 pt-3 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className="mb-0.5 flex items-center justify-between text-xs text-slate-400">
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
            <span className="mt-0.5 block text-[11px] text-slate-500">
              Oryginał: {item.displayName} (na etykiecie ucinamy wszystko od myślnika)
            </span>
          </label>

          <div className="sm:col-span-2">
            <span className="mb-0.5 block text-xs text-slate-400">
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
                className="input-field w-28 text-sm"
              />
              <select
                value={pack?.unit ?? 'ml'}
                onChange={(e) => patch({ pack: { qty: pack?.qty ?? 1, unit: e.target.value as PackUnit } })}
                className="input-field w-24 text-sm"
              >
                {PACK_UNITS.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* ---- cena brutto na etykiecie: ręczna zmiana i wyrównanie końcówek ---- */}
          <div className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-3 sm:col-span-2">
            <p className="mb-1 text-sm font-semibold text-slate-100">Cena brutto na etykiecie</p>
            <p className="mb-2 text-[11px] text-slate-400">
              Zmiana dotyczy tylko etykiety — cena w katalogu zostaje bez zmian
              {catalogGross != null ? ` (katalog: ${money(catalogGross)})` : ''}.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="number"
                min={0}
                step="0.01"
                value={grossNow ?? ''}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (e.target.value !== '' && Number.isFinite(v) && v > 0) priceTo(v);
                }}
                className="input-field w-36 text-base font-semibold"
                placeholder="np. 31,90"
              />
              <span className="text-sm text-slate-400">zł brutto</span>
              {priceChanged && (
                <button type="button" onClick={() => priceTo(null)} className="text-xs text-brand-300 hover:underline">
                  przywróć z katalogu
                </button>
              )}
            </div>
            {grossNow != null && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-slate-400">Wyrównaj:</span>
                {PRICE_ROUND_OPTIONS.map((o) => {
                  const target = roundToEnding(grossNow, o.mode);
                  return (
                    <button
                      key={o.mode}
                      type="button"
                      disabled={Math.abs(target - grossNow) < 0.004}
                      onClick={() => priceTo(target)}
                      title={`${o.hint} — dla tej ceny: ${money(grossNow)} → ${money(target)}`}
                      className="rounded-md border border-slate-700 bg-slate-900 px-2 py-0.5 text-xs font-semibold text-slate-200 hover:border-sky-400 hover:text-sky-300 disabled:opacity-30"
                    >
                      {o.label} <span className="font-normal text-slate-400">→ {money(target)}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* ---- cena promocyjna: ceny wyjściowe + marża ---- */}

          <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-3 sm:col-span-2">
            <p className="mb-2 text-sm font-semibold text-slate-100">Cena promocyjna</p>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-lg bg-slate-900/80 p-2">
                <span className="block text-[11px] uppercase tracking-wide text-slate-400">Sprzedaż brutto</span>
                <span className="text-base font-bold tabular-nums text-slate-50">{money(grossNow)}</span>
              </div>
              <div className="rounded-lg bg-slate-900/80 p-2">
                <span className="block text-[11px] uppercase tracking-wide text-slate-400">Sprzedaż netto</span>
                <span className="text-base font-bold tabular-nums text-slate-50">{money(netNow)}</span>
              </div>
              {showMargins ? (
                <>
                  <div className="rounded-lg bg-slate-900/80 p-2">
                    <span className="block text-[11px] uppercase tracking-wide text-slate-400">Zakup netto</span>
                    <span className="text-base font-bold tabular-nums text-slate-50">
                      {purchaseNet != null ? money(purchaseNet) : 'brak'}
                    </span>
                  </div>
                  <div className="rounded-lg bg-slate-900/80 p-2">
                    <span className="block text-[11px] uppercase tracking-wide text-slate-400">Marża obecna</span>
                    <span className={`text-base font-bold tabular-nums ${marginClass(marginNow)}`}>
                      {formatMarginPercent(marginNow)}
                    </span>
                  </div>
                </>
              ) : (
                <div className="col-span-2 flex items-center rounded-lg bg-slate-900/80 p-2 text-xs text-slate-400">
                  Cena zakupu i marża są widoczne dla ról z uprawnieniem „Ceny i marża”.
                </div>
              )}
            </div>

            {showMargins && purchaseNet != null && (
              <p className="mt-2 text-xs text-slate-300">
                Progi (brutto):{' '}
                <span className="text-red-300">
                  bez straty ≥ <b className="tabular-nums">{money(breakEvenGross)}</b>
                </span>
                {' · '}
                <span className="text-amber-200">
                  marża 10% ≥ <b className="tabular-nums">{money(tenPctGross)}</b>
                </span>
              </p>
            )}

            <div className="mt-3">
              <span className="mb-1 block text-xs font-medium text-slate-300">Wpisz cenę promocyjną brutto</span>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={item.salePrice ?? ''}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    patch({ salePrice: e.target.value !== '' && Number.isFinite(v) && v > 0 ? v : null });
                  }}
                  placeholder="np. 29,90"
                  className="input-field w-36 text-base font-semibold"
                />
                <span className="text-sm text-slate-400">zł brutto</span>
                {item.salePrice != null && (
                  <button
                    type="button"
                    onClick={() => patch({ salePrice: null })}
                    className="text-xs text-brand-300 hover:underline"
                  >
                    usuń promocję
                  </button>
                )}
              </div>
              {grossNow != null && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-slate-400">Szybka obniżka:</span>
                  {QUICK_DISCOUNTS.map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setPromoFromDiscount(pct)}
                      className="rounded-md border border-slate-700 bg-slate-900 px-2 py-0.5 text-xs font-semibold text-slate-200 hover:border-red-400 hover:text-red-300"
                    >
                      −{pct}%
                    </button>
                  ))}
                </div>
              )}
            </div>

            {item.salePrice != null && item.priceGross != null && item.salePrice >= item.priceGross && (
              <p className="mt-2 text-xs text-amber-300">
                Cena promocyjna musi być niższa od obecnej ({money(grossNow)}), inaczej etykieta jest bez promocji.
              </p>
            )}

            {sale && promoNet != null && (
              <div className="mt-3 rounded-lg border border-slate-700 bg-slate-900/90 p-3">
                <p className="text-sm text-slate-200">
                  Po promocji: <b className="text-base tabular-nums text-red-300">{money(item.salePrice)}</b> brutto ·{' '}
                  <b className="tabular-nums">{money(promoNet)}</b> netto
                  {discountPct != null && (
                    <span className="ml-1 rounded bg-red-600 px-1.5 py-0.5 text-xs font-bold text-white">
                      −{discountPct.toFixed(1).replace('.', ',')}%
                    </span>
                  )}
                </p>
                {showMargins &&
                  (purchaseNet != null ? (
                    <p className="mt-1.5 text-sm text-slate-200">
                      Marża po promocji:{' '}
                      <b className={`text-lg tabular-nums ${marginClass(marginPromo)}`}>
                        {formatMarginPercent(marginPromo)}
                      </b>
                      {profitPromo != null && (
                        <span className="text-slate-300">
                          {' '}
                          · zysk <b className="tabular-nums">{money(profitPromo)}</b> / szt.
                        </span>
                      )}
                      {marginNow != null && marginPromo != null && (
                        <span className="text-slate-400"> (było {formatMarginPercent(marginNow)})</span>
                      )}
                    </p>
                  ) : (
                    <p className="mt-1.5 text-sm text-amber-300">
                      Brak ceny zakupu w katalogu — nie da się policzyć marży.
                    </p>
                  ))}
                {showMargins && marginPromo != null && marginPromo <= 0 && (
                  <p className="mt-1 text-sm font-bold text-red-400">Uwaga: sprzedaż poniżej kosztu!</p>
                )}
                {showMargins && marginPromo != null && marginPromo > 0 && marginPromo < 10 && (
                  <p className="mt-1 text-sm font-semibold text-amber-300">Niska marża (poniżej 10%).</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </li>
  );
}
