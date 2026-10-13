import { useState } from 'react';
import { Minus, Pencil, Plus, Trash2 } from 'lucide-react';
import {
  removeFromLabelQueue,
  setLabelQty,
  updateLabelItem,
  type LabelQueueItem,
} from '../lib/labelQueue';
import { PACK_UNITS, formatPack, parsePackFromText, type PackUnit } from '../lib/labelPack';

interface Props {
  item: LabelQueueItem;
  /** Czy na etykiecie jest włączona cena jednostkowa (wtedy brak pojemności jest ostrzeżeniem). */
  unitPriceEnabled: boolean;
  onChanged: () => void;
}

/** Jedna pozycja listy „Do wydruku”: ilość kopii + edycja nazwy, pojemności i ceny promocyjnej. */
export function LabelItemRow({ item, unitPriceEnabled, onChanged }: Props) {
  const [editing, setEditing] = useState(false);
  const pack = item.pack ?? parsePackFromText(item.displayName);
  const sale =
    item.salePrice != null && item.priceGross != null && item.salePrice > 0 && item.salePrice < item.priceGross;
  const customName = (item.labelName || '').trim();

  function patch(p: Partial<LabelQueueItem>) {
    updateLabelItem(item.id, p);
    onChanged();
  }

  return (
    <li className="rounded-lg border border-slate-800 bg-slate-950/40 px-2.5 py-1.5">
      <div className="flex items-center gap-2.5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-slate-100">{customName || item.displayName}</p>
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
              placeholder={item.displayName}
              maxLength={120}
              className="input-field text-sm"
            />
            <span className="mt-0.5 block text-[10px] text-slate-600">Oryginał: {item.displayName}</span>
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

          <div>
            <span className="mb-0.5 block text-[11px] text-slate-500">
              Cena promocyjna brutto (wariant wyprzedażowy)
              {item.priceGross != null ? ` · obecna ${item.priceGross.toFixed(2).replace('.', ',')} zł` : ''}
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
          </div>
        </div>
      )}
    </li>
  );
}
