import { Layers, Loader2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Product } from '../types';
import {
  PRICE_FIELD_LABEL,
  computeChanges,
  runBulkEdit,
  sourceFromProduct,
  type BulkEditSpec,
  type BulkRunResult,
  type PriceField,
  type PriceMode,
  type PriceRound,
} from '../lib/bulkEdit';
import { getAssignableCategories, useCategoryRegistry } from '../lib/categoryRegistry';
import { confirmDialog } from '../lib/dialog';
import { showToast } from '../lib/toast';
import { ManufacturerSelect } from './ManufacturerSelect';
import { coerceAttrValue, getAttributes, useAttributesVersion } from '../lib/attributes';

const splitTags = (s: string) =>
  s
    .split(/[,;\n]/)
    .map((t) => t.trim())
    .filter(Boolean);

function Section({
  title,
  enabled,
  onToggle,
  children,
}: {
  title: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <section className={`rounded-xl border p-3 transition ${enabled ? 'border-brand-500/50 bg-brand-500/5' : 'border-slate-800 bg-slate-950/40'}`}>
      <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-100">
        <input type="checkbox" checked={enabled} onChange={(e) => onToggle(e.target.checked)} className="h-4 w-4 accent-brand-500" />
        {title}
      </label>
      {enabled && <div className="mt-3 space-y-2">{children}</div>}
    </section>
  );
}

/** Edycja masowa zaznaczonych produktów z podglądem zmian i zapisem w historii (do cofnięcia). */
export function BulkEditDialog({
  products,
  canEditPrices,
  onClose,
  onDone,
}: {
  products: Product[];
  canEditPrices: boolean;
  onClose: () => void;
  onDone: (result: BulkRunResult) => void;
}) {
  useCategoryRegistry();
  useAttributesVersion();
  const attrDefs = getAttributes();
  const [useAttr, setUseAttr] = useState(false);
  const [attrKey, setAttrKey] = useState('');
  const [attrValue, setAttrValue] = useState('');
  const [useMfr, setUseMfr] = useState(false);
  const [mfr, setMfr] = useState('');
  const [useCat, setUseCat] = useState(false);
  const [cat, setCat] = useState('');
  const [useVat, setUseVat] = useState(false);
  const [vat, setVat] = useState(23);
  const [useUnit, setUseUnit] = useState(false);
  const [unit, setUnit] = useState('szt.');
  const [useTags, setUseTags] = useState(false);
  const [tagsAdd, setTagsAdd] = useState('');
  const [tagsRemove, setTagsRemove] = useState('');
  const [usePrice, setUsePrice] = useState(false);
  const [priceField, setPriceField] = useState<PriceField>('priceSaleGross');
  const [priceMode, setPriceMode] = useState<PriceMode>('percent');
  const [priceValue, setPriceValue] = useState('');
  const [priceRound, setPriceRound] = useState<PriceRound>('0.01');
  const [recompute, setRecompute] = useState(true);
  const [busy, setBusy] = useState<{ done: number; total: number } | null>(null);

  const categories = useMemo(
    () => getAssignableCategories().sort((a, b) => a.localeCompare(b, 'pl')),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const priceNum = Number(priceValue.replace(',', '.'));
  const spec: BulkEditSpec = useMemo(() => {
    const s: BulkEditSpec = {};
    if (useMfr && mfr) s.manufacturer = mfr;
    if (useCat && cat) s.category = cat;
    if (useVat) s.vatRate = vat;
    if (useUnit && unit.trim()) s.unit = unit.trim();
    if (useTags) {
      const add = splitTags(tagsAdd);
      const remove = splitTags(tagsRemove);
      if (add.length) s.tagsAdd = add;
      if (remove.length) s.tagsRemove = remove;
    }
    if (useAttr && attrKey) {
      const def = attrDefs.find((d) => d.key === attrKey);
      const v = def ? coerceAttrValue(def, attrValue) : undefined;
      if (v !== undefined) s.attr = { key: attrKey, value: v };
    }
    if (usePrice && canEditPrices && priceValue.trim() && Number.isFinite(priceNum)) {
      s.price = { field: priceField, mode: priceMode, value: priceNum, round: priceRound, recompute };
    }
    return s;
  }, [useAttr, attrKey, attrValue, attrDefs, useMfr, mfr, useCat, cat, useVat, vat, useUnit, unit, useTags, tagsAdd, tagsRemove, usePrice, canEditPrices, priceValue, priceNum, priceField, priceMode, priceRound, recompute]);

  const hasSpec = Object.keys(spec).length > 0;

  const preview = useMemo(
    () => products.map((p) => ({ p, changes: hasSpec ? computeChanges(sourceFromProduct(p), spec) : [] })),
    [products, spec, hasSpec],
  );
  const changedCount = preview.filter((x) => x.changes.length > 0).length;

  const specLabel = [
    spec.manufacturer && `producent → ${spec.manufacturer}`,
    spec.category && `kategoria → ${spec.category}`,
    spec.vatRate !== undefined && `VAT → ${spec.vatRate}%`,
    spec.unit && `jednostka → ${spec.unit}`,
    (spec.tagsAdd || spec.tagsRemove) && 'tagi',
    spec.price && `${PRICE_FIELD_LABEL[spec.price.field].toLowerCase()} ${spec.price.mode === 'set' ? '=' : spec.price.mode === 'percent' ? `${spec.price.value > 0 ? '+' : ''}${spec.price.value}%` : `${spec.price.value > 0 ? '+' : ''}${spec.price.value} zł`}`,
  ]
    .filter(Boolean)
    .join(', ');

  async function apply() {
    if (!hasSpec || changedCount === 0) return;
    const ok = await confirmDialog({
      title: 'Edycja masowa',
      message: `Zmiany (${specLabel}) zostaną zapisane w ${changedCount} z ${products.length} produktów.\nCałą operację możesz cofnąć w Logi → Operacje masowe.`,
      confirmLabel: `Zapisz ${changedCount} zmian`,
      tone: 'warn',
    });
    if (!ok) return;
    setBusy({ done: 0, total: products.length });
    try {
      const res = await runBulkEdit(
        products.map((p) => p.id),
        spec,
        `Edycja masowa: ${specLabel}`,
        (done, total) => setBusy({ done, total }),
      );
      showToast(
        res.failed.length
          ? `Zapisano ${res.updated}, błędy: ${res.failed.length} (${res.failed[0].sku}: ${res.failed[0].error})`
          : `Zapisano zmiany w ${res.updated} produktach${res.unchanged ? ` (${res.unchanged} bez zmian)` : ''} — cofniesz w Logi → Operacje masowe`,
        res.failed.length ? 'warn' : 'ok',
        8000,
      );
      onDone(res);
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Nie udało się zapisać', 'error', 8000);
    } finally {
      setBusy(null);
    }
  }

  const sel = 'input-field text-sm';

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-2 sm:items-center sm:p-4" onClick={() => !busy && onClose()}>
      <div
        className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-800 px-5 py-3">
          <div>
            <h3 className="flex items-center gap-2 text-base font-bold text-slate-50">
              <Layers className="h-4 w-4" /> Edycja masowa — {products.length} produktów
            </h3>
            <p className="text-xs text-slate-400">Zaznacz pola do zmiany, sprawdź podgląd i zapisz. Cała operacja trafia do historii i można ją cofnąć.</p>
          </div>
          <button type="button" onClick={onClose} disabled={!!busy} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800" aria-label="Zamknij">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto px-5 py-4 lg:grid-cols-2">
          <div className="space-y-2.5">
            <Section title="Producent" enabled={useMfr} onToggle={setUseMfr}>
              <ManufacturerSelect value={mfr} onChange={setMfr} />
            </Section>
            <Section title="Kategoria" enabled={useCat} onToggle={setUseCat}>
              <select value={cat} onChange={(e) => setCat(e.target.value)} className={sel}>
                <option value="">— wybierz kategorię —</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Section>
            <Section title="Stawka VAT" enabled={useVat} onToggle={setUseVat}>
              <select value={vat} onChange={(e) => setVat(Number(e.target.value))} className={sel}>
                {[0, 5, 8, 23].map((v) => (
                  <option key={v} value={v}>
                    {v}%
                  </option>
                ))}
              </select>
            </Section>
            <Section title="Jednostka" enabled={useUnit} onToggle={setUseUnit}>
              <input value={unit} onChange={(e) => setUnit(e.target.value)} className={sel} placeholder="np. szt., l, kg" />
            </Section>
            <Section title="Tagi" enabled={useTags} onToggle={setUseTags}>
              <input value={tagsAdd} onChange={(e) => setTagsAdd(e.target.value)} className={sel} placeholder="Dodaj tagi (po przecinku)" />
              <input value={tagsRemove} onChange={(e) => setTagsRemove(e.target.value)} className={sel} placeholder="Usuń tagi (po przecinku)" />
            </Section>
            {attrDefs.length > 0 && (
              <Section title="Atrybut (parametr)" enabled={useAttr} onToggle={setUseAttr}>
                <select value={attrKey} onChange={(e) => { setAttrKey(e.target.value); setAttrValue(''); }} className={sel}>
                  <option value="">— wybierz atrybut —</option>
                  {attrDefs.map((d) => (
                    <option key={d.key} value={d.key}>
                      {d.label}
                    </option>
                  ))}
                </select>
                {(() => {
                  const d = attrDefs.find((x) => x.key === attrKey);
                  if (!d) return null;
                  if (d.type === 'select')
                    return (
                      <select value={attrValue} onChange={(e) => setAttrValue(e.target.value)} className={sel}>
                        <option value="">— wartość —</option>
                        {d.options.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    );
                  if (d.type === 'bool')
                    return (
                      <select value={attrValue} onChange={(e) => setAttrValue(e.target.value)} className={sel}>
                        <option value="">— wartość —</option>
                        <option value="true">Tak</option>
                        <option value="false">Nie</option>
                      </select>
                    );
                  return <input value={attrValue} onChange={(e) => setAttrValue(e.target.value)} className={sel} placeholder={d.unit ? `wartość (${d.unit})` : 'wartość'} />;
                })()}
              </Section>
            )}
            {canEditPrices && (
              <Section title="Ceny" enabled={usePrice} onToggle={setUsePrice}>
                <select value={priceField} onChange={(e) => setPriceField(e.target.value as PriceField)} className={sel}>
                  {(Object.keys(PRICE_FIELD_LABEL) as PriceField[]).map((f) => (
                    <option key={f} value={f}>
                      {PRICE_FIELD_LABEL[f]}
                    </option>
                  ))}
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <select value={priceMode} onChange={(e) => setPriceMode(e.target.value as PriceMode)} className={sel}>
                    <option value="percent">Zmień o %</option>
                    <option value="amount">Zmień o kwotę (zł)</option>
                    <option value="set">Ustaw wartość (zł)</option>
                  </select>
                  <input
                    value={priceValue}
                    onChange={(e) => setPriceValue(e.target.value)}
                    inputMode="decimal"
                    className={sel}
                    placeholder={priceMode === 'percent' ? 'np. 5 lub -10' : priceMode === 'amount' ? 'np. 2,50 lub -1' : 'np. 19,99'}
                  />
                </div>
                <label className="block text-xs text-slate-400">
                  Zaokrąglenie
                  <select value={priceRound} onChange={(e) => setPriceRound(e.target.value as PriceRound)} className={`${sel} mt-1`}>
                    <option value="0.01">do 1 grosza</option>
                    <option value="0.10">do 10 groszy</option>
                    <option value="1">do pełnych złotych</option>
                    <option value=".99">końcówka ,99</option>
                    <option value=".90">końcówka ,90</option>
                    <option value="none">bez zaokrąglania (2 miejsca)</option>
                  </select>
                </label>
                {priceField !== 'pricePurchaseNet' && (
                  <label className="flex items-center gap-2 text-xs text-slate-300">
                    <input type="checkbox" checked={recompute} onChange={(e) => setRecompute(e.target.checked)} className="h-4 w-4 accent-brand-500" />
                    Przelicz drugą cenę sprzedaży (netto ↔ brutto wg VAT)
                  </label>
                )}
              </Section>
            )}
          </div>

          <section>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Podgląd zmian ({changedCount} z {products.length} produktów zostanie zmienionych)
            </p>
            {!hasSpec ? (
              <p className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-sm text-slate-500">Zaznacz pola i uzupełnij wartości, aby zobaczyć podgląd.</p>
            ) : (
              <ul className="max-h-[26rem] divide-y divide-slate-800 overflow-y-auto rounded-xl border border-slate-800">
                {preview.slice(0, 30).map(({ p, changes }) => (
                  <li key={p.id} className="px-3 py-2 text-xs">
                    <p className="truncate font-semibold text-slate-100">
                      <span className="font-mono text-slate-400">{p.sku}</span> {p.displayName}
                    </p>
                    {changes.length === 0 ? (
                      <p className="text-slate-500">bez zmian</p>
                    ) : (
                      changes.map((c) => (
                        <p key={c.label} className="text-slate-400">
                          {c.label.replace(/^meta: /, '')}:{' '}
                          <span className="text-rose-300/90">{Array.isArray(c.from) ? c.from.join(', ') || '—' : String(c.from ?? '—') || '—'}</span> →{' '}
                          <span className="text-emerald-300">{Array.isArray(c.to) ? c.to.join(', ') || '—' : String(c.to ?? '—')}</span>
                        </p>
                      ))
                    )}
                  </li>
                ))}
                {products.length > 30 && <li className="px-3 py-2 text-center text-[11px] text-slate-500">…i {products.length - 30} kolejnych (podgląd pierwszych 30)</li>}
              </ul>
            )}
            <p className="mt-2 text-[11px] text-slate-500">
              Podgląd liczy z danych widocznych na liście; przy zapisie używamy aktualnych wartości z bazy.
            </p>
          </section>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 px-5 py-3">
          <p className="text-xs text-slate-400">{hasSpec ? specLabel : 'Nic nie wybrano'}</p>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} disabled={!!busy} className="rounded-xl border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800">
              Anuluj
            </button>
            <button
              type="button"
              disabled={!!busy || !hasSpec || changedCount === 0}
              onClick={() => void apply()}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {busy ? `Zapisuję ${busy.done}/${busy.total}…` : `Zapisz zmiany (${changedCount})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
