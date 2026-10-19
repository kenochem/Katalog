import { Loader2, Save, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Product } from '../types';
import { getAssignableCategories, useCategoryRegistry } from '../lib/categoryRegistry';
import { getProductDisplayCategory } from '../lib/catalogCategory';
import { effectiveManufacturer } from '../lib/waproManufacturers';
import { ManufacturerSelect } from './ManufacturerSelect';

export type QuickPatch = Partial<Pick<Product, 'ean' | 'manufacturer' | 'category' | 'priceSaleGross'>>;

/** Szybka edycja w wierszu listy: EAN, producent, kategoria i cena sprzedaży brutto bez otwierania karty. */
export function QuickEditRow({
  product,
  canEditPrices,
  onSave,
  onCancel,
}: {
  product: Product;
  canEditPrices: boolean;
  onSave: (patch: QuickPatch) => Promise<void>;
  onCancel: () => void;
}) {
  useCategoryRegistry();
  const currentMfr = effectiveManufacturer(product);
  const currentCat = getProductDisplayCategory(product);
  const [ean, setEan] = useState(product.ean ?? '');
  const [mfr, setMfr] = useState(currentMfr);
  const [cat, setCat] = useState(currentCat === 'Do decyzji' ? '' : currentCat);
  const [price, setPrice] = useState(product.priceSaleGross != null ? String(product.priceSaleGross).replace('.', ',') : '');
  const [saving, setSaving] = useState(false);
  const categories = useMemo(
    () => getAssignableCategories().sort((a, b) => a.localeCompare(b, 'pl')),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const priceNum = price.trim() ? Number(price.replace(',', '.')) : null;
  const eanClean = ean.replace(/\D/g, '');
  const patch: QuickPatch = {};
  if (eanClean !== (product.ean ?? '')) patch.ean = eanClean;
  if (mfr && mfr !== currentMfr) patch.manufacturer = mfr;
  if (cat && cat !== currentCat) patch.category = cat;
  if (canEditPrices && priceNum != null && Number.isFinite(priceNum) && priceNum !== (product.priceSaleGross ?? null)) patch.priceSaleGross = Math.round(priceNum * 100) / 100;
  const dirty = Object.keys(patch).length > 0;
  const eanBad = eanClean.length > 0 && ![8, 12, 13, 14].includes(eanClean.length);

  async function save() {
    setSaving(true);
    try {
      await onSave(patch);
    } finally {
      setSaving(false);
    }
  }

  const label = 'mb-1 block text-[11px] font-medium text-slate-600 dark:text-slate-400';

  return (
    <div className="col-span-full rounded-xl border border-brand-500/30 bg-brand-500/5 p-3">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <label className="block">
          <span className={label}>EAN {eanBad && <span className="text-amber-500">(zwykle 8 / 13 cyfr)</span>}</span>
          <input value={ean} onChange={(e) => setEan(e.target.value)} inputMode="numeric" className="input-field font-mono text-sm" placeholder="np. 5901234567890" />
        </label>
        <label className="block">
          <span className={label}>Producent</span>
          <ManufacturerSelect value={mfr} onChange={setMfr} />
        </label>
        <label className="block">
          <span className={label}>Kategoria</span>
          <select value={cat} onChange={(e) => setCat(e.target.value)} className="input-field text-sm">
            <option value="">— bez zmiany —</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        {canEditPrices && (
          <label className="block">
            <span className={label}>Cena sprzedaży brutto (zł)</span>
            <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" className="input-field text-sm tabular-nums" placeholder="np. 19,99" />
          </label>
        )}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          disabled={!dirty || saving}
          onClick={() => void save()}
          className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Zapisz
        </button>
        <button type="button" onClick={onCancel} className="inline-flex items-center gap-1 rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
          <X className="h-4 w-4" /> Anuluj
        </button>
        {dirty && <span className="text-xs text-slate-500">Zmieniono: {Object.keys(patch).length}</span>}
      </div>
    </div>
  );
}
