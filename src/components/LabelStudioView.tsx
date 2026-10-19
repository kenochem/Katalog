import { useEffect, useMemo, useState } from 'react';
import { Plus, Printer, Search, Trash2 } from 'lucide-react';
import type { Product } from '../types';
import { applyCatalogFilters } from '../lib/search';
import {
  addProductsToLabelQueue,
  clearLabelQueue,
  resetLabelPrices,
  roundLabelPrices,
  type LabelQueueItem,
} from '../lib/labelQueue';
import {
  LABEL_FIELD_LABELS,
  LABEL_SIZE_PRESETS,
  loadLabelConfig,
  saveLabelConfig,
  type LabelConfig,
  type LabelFields,
} from '../lib/labelConfig';
import { buildLabelsDocument, fitLabelName, printShelfLabels } from '../lib/printLabel';
import { showToast } from '../lib/toast';
import { LabelItemRow } from './LabelItemRow';
import { PRICE_ROUND_OPTIONS, type PriceRoundMode } from '../lib/priceRounding';
import { useAuth } from '../lib/auth';
import { roleCan } from '../lib/roles';
import { labelNameFor } from '../lib/labelPack';

const PAGE = 60;

const SAMPLE_ITEM: LabelQueueItem = {
  id: 'sample',
  sku: 'ARO000012',
  displayName: 'Aroma Patyczki zapachowe 100ml — Drewno Cedrowe z Paczulą',
  ean: '5907461511234',
  catalog: 'shop',
  locationCode: 'A-02-3',
  priceGross: 39.9,
  manufacturer: 'Aroma Car',
  category: 'Zapachy',
  stock: 26,
  priceNet: 32.44,
  vatRate: 23,
  pack: { qty: 100, unit: 'ml' },
  qty: 1,
};

interface Props {
  /** Produkty widoczne w katalogu (bez ukrytych). */
  products: Product[];
  queue: LabelQueueItem[];
  /** Odśwież kolejkę po zmianie (stan trzyma App). */
  onQueueChange: () => void;
}

/** Studio etykiet: wybór produktów, ilości, konfiguracja wyglądu, podgląd na żywo i druk. */
export function LabelStudioView({ products, queue, onQueueChange }: Props) {
  const { role } = useAuth();
  const canSeeMargins = roleCan(role, 'viewPrices');
  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const [cfg, setCfg] = useState<LabelConfig>(loadLabelConfig);
  const [search, setSearch] = useState('');
  const [roundMode, setRoundMode] = useState<PriceRoundMode>('99-down');
  const [roundSale, setRoundSale] = useState(false);
  const [onlyEan, setOnlyEan] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [limit, setLimit] = useState(PAGE);

  useEffect(() => {
    saveLabelConfig(cfg);
  }, [cfg]);

  useEffect(() => {
    onQueueChange();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const results = useMemo(() => {
    let list = applyCatalogFilters(products, { search, category: 'Wszystkie', sort: 'name-asc' });
    if (onlyEan) list = list.filter((p) => (p.ean || '').trim().length >= 8);
    return list;
  }, [products, search, onlyEan]);

  const visible = results.slice(0, limit);
  const allVisibleSelected = visible.length > 0 && visible.every((p) => selected.has(p.id));
  const totalLabels = queue.reduce((s, q) => s + Math.max(1, q.qty ?? 1), 0);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function addSelected(list: Product[]) {
    if (!list.length) return;
    addProductsToLabelQueue(list);
    setSelected(new Set());
    onQueueChange();
    showToast(`Dodano do wydruku: ${list.length}`, 'ok', 2200);
  }

  function patchCfg(patch: Partial<LabelConfig>) {
    setCfg((c) => ({ ...c, ...patch }));
  }

  function setField(key: keyof LabelFields, value: boolean) {
    setCfg((c) => ({ ...c, fields: { ...c.fields, [key]: value } }));
  }

  function pickSize(id: string) {
    const preset = LABEL_SIZE_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    if (id === 'custom') patchCfg({ sizeId: id });
    else patchCfg({ sizeId: id, w: preset.w, h: preset.h });
  }

  const previewItems = queue.length ? queue.slice(0, 2) : [SAMPLE_ITEM];
  const previewDoc = useMemo(
    () => buildLabelsDocument(previewItems, cfg, { preview: true }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queue, cfg],
  );
  const PX = 3.78; // px na mm przy 96 dpi
  const innerW = Math.round(cfg.w * PX + 40);
  const scale = Math.min(1, 330 / innerW);
  const rows = previewItems.length;
  const innerH = Math.round((cfg.h * PX + 12) * (cfg.mode === 'sheet' && cfg.w * 2 + 12 < 190 ? 1 : rows) + 40);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-100">Etykiety produktów</h2>
        <p className="mt-1 text-sm text-slate-500">
          Wybierz produkty, ustaw ilość i wygląd, sprawdź podgląd i drukuj (arkusz A4 lub drukarka etykiet).
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="min-w-0 space-y-4">
          {/* 1. wybór produktów */}
          <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-100">1. Wybierz produkty</h3>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setLimit(PAGE);
                  }}
                  placeholder="Szukaj: nazwa, SKU, EAN…"
                  className="input-field with-icon"
                />
              </div>
              <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={onlyEan}
                  onChange={(e) => setOnlyEan(e.target.checked)}
                  className="h-4 w-4 accent-brand-500"
                />
                tylko z EAN
              </label>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setSelected(allVisibleSelected ? new Set() : new Set(visible.map((p) => p.id)))
                }
                className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
              >
                {allVisibleSelected ? 'Odznacz widoczne' : `Zaznacz widoczne (${visible.length})`}
              </button>
              <span className="text-xs text-slate-500">Wyników: {results.length}</span>
              <button
                type="button"
                disabled={selected.size === 0}
                onClick={() => addSelected(products.filter((p) => selected.has(p.id)))}
                className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                Dodaj zaznaczone ({selected.size})
              </button>
            </div>

            <ul className="mt-3 max-h-80 space-y-1 overflow-y-auto pr-1">
              {visible.map((p) => {
                const inQueue = queue.some((q) => q.id === p.id);
                return (
                  <li key={p.id}>
                    <label
                      className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-2.5 py-1.5 text-sm ${
                        selected.has(p.id)
                          ? 'border-brand-500/50 bg-brand-500/10'
                          : 'border-slate-800 bg-slate-950/40 hover:border-slate-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(p.id)}
                        onChange={() => toggle(p.id)}
                        className="h-4 w-4 shrink-0 accent-brand-500"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-slate-100">{p.displayName}</span>
                        <span className="block font-mono text-[11px] text-brand-400">
                          {p.sku}
                          {p.ean ? ` · ${p.ean}` : ' · brak EAN'}
                        </span>
                      </span>
                      {inQueue && (
                        <span className="shrink-0 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                          w wydruku
                        </span>
                      )}
                    </label>
                  </li>
                );
              })}
              {visible.length === 0 && (
                <li className="py-6 text-center text-sm text-slate-500">Brak produktów dla tego wyszukiwania.</li>
              )}
            </ul>
            {results.length > visible.length && (
              <button
                type="button"
                onClick={() => setLimit((l) => l + PAGE)}
                className="mt-2 w-full rounded-lg border border-slate-700 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
              >
                Pokaż więcej ({results.length - visible.length})
              </button>
            )}
            {search.trim() && results.length > 0 && results.length <= 300 && (
              <button
                type="button"
                onClick={() => addSelected(results)}
                className="mt-2 w-full rounded-lg border border-brand-500/40 bg-brand-500/10 py-1.5 text-xs font-medium text-brand-300 hover:bg-brand-500/20"
              >
                Dodaj wszystkie wyniki wyszukiwania ({results.length})
              </button>
            )}
          </section>

          {/* 2. do wydruku */}
          <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-100">
                2. Do wydruku — {queue.length} produktów, {totalLabels} etykiet
              </h3>
              <button
                type="button"
                disabled={!queue.length}
                onClick={() => {
                  clearLabelQueue();
                  onQueueChange();
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Wyczyść
              </button>
            </div>
            {queue.length > 0 && (
              <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-sky-500/30 bg-sky-500/5 px-3 py-2">
                <span className="text-xs font-semibold text-slate-200">Wyrównaj ceny wszystkich etykiet (tylko na etykiecie):</span>
                <select
                  value={roundMode}
                  onChange={(e) => setRoundMode(e.target.value as PriceRoundMode)}
                  className="input-field !w-auto text-xs"
                  aria-label="Sposób wyrównania"
                >
                  {PRICE_ROUND_OPTIONS.map((o) => (
                    <option key={o.mode} value={o.mode}>
                      {o.label} ({o.hint})
                    </option>
                  ))}
                </select>
                <label className="inline-flex items-center gap-1.5 text-xs text-slate-300">
                  <input type="checkbox" checked={roundSale} onChange={(e) => setRoundSale(e.target.checked)} className="h-3.5 w-3.5 accent-sky-500" />
                  także ceny promocyjne
                </label>
                <button
                  type="button"
                  onClick={() => {
                    roundLabelPrices(roundMode, { includeSale: roundSale });
                    onQueueChange();
                  }}
                  className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-500"
                >
                  Wyrównaj
                </button>
                <button
                  type="button"
                  onClick={() => {
                    resetLabelPrices();
                    onQueueChange();
                  }}
                  className="text-xs text-brand-300 hover:underline"
                >
                  przywróć ceny z katalogu
                </button>
              </div>
            )}
            {queue.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">
                Nic jeszcze nie wybrano
 — zaznacz produkty powyżej albo dodaj je z karty produktu.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {queue.map((item) => (
                  <LabelItemRow
                    key={item.id}
                    item={item}
                    unitPriceEnabled={cfg.fields.unitPrice}
                    product={productById.get(item.id.split('::')[0])}
                    showMargins={canSeeMargins}
                    nameStatus={fitLabelName(labelNameFor(item), cfg)}
                    onChanged={onQueueChange}
                  />
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* 3. wygląd + podgląd + druk */}
        <aside className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 lg:sticky lg:top-3">
          <h3 className="text-sm font-semibold text-slate-100">3. Wygląd i druk</h3>

          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Rozmiar etykiety</p>
            <select
              value={cfg.sizeId}
              onChange={(e) => pickSize(e.target.value)}
              className="input-field text-sm"
            >
              {LABEL_SIZE_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            {cfg.sizeId === 'custom' && (
              <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
                <input
                  type="number"
                  min={20}
                  max={210}
                  value={cfg.w}
                  onChange={(e) => patchCfg({ w: Math.max(20, Math.min(210, Number(e.target.value) || 70)) })}
                  className="input-field w-20 text-sm"
                />
                ×
                <input
                  type="number"
                  min={15}
                  max={297}
                  value={cfg.h}
                  onChange={(e) => patchCfg({ h: Math.max(15, Math.min(297, Number(e.target.value) || 40)) })}
                  className="input-field w-20 text-sm"
                />
                mm
              </div>
            )}
          </div>

          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Papier</p>
            <div className="flex gap-1 rounded-lg border border-slate-800 p-0.5">
              {(
                [
                  ['sheet', 'Arkusz A4'],
                  ['roll', 'Drukarka etykiet'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => patchCfg({ mode: key })}
                  className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium ${
                    cfg.mode === key ? 'bg-brand-600 text-white' : 'text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Co na etykiecie</p>
            <div className="grid grid-cols-1 gap-1">
              {(Object.keys(LABEL_FIELD_LABELS) as (keyof LabelFields)[]).map((key) => (
                <label key={key} className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={cfg.fields[key]}
                    onChange={(e) => setField(key, e.target.checked)}
                    className="h-4 w-4 accent-brand-500"
                  />
                  {LABEL_FIELD_LABELS[key]}
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Czcionka</p>
              <div className="flex gap-1 rounded-lg border border-slate-800 p-0.5">
                {(
                  [
                    [0.85, 'Mała'],
                    [1, 'Średnia'],
                    [1.2, 'Duża'],
                  ] as const
                ).map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => patchCfg({ fontScale: val })}
                    className={`flex-1 rounded-md px-1.5 py-1 text-xs font-medium ${
                      cfg.fontScale === val ? 'bg-brand-600 text-white' : 'text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <label className="flex cursor-pointer items-center gap-1.5 pt-4 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={cfg.border}
                onChange={(e) => patchCfg({ border: e.target.checked })}
                className="h-4 w-4 accent-brand-500"
              />
              ramka
            </label>
          </div>

          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Podgląd {queue.length === 0 ? '(przykładowy)' : ''}
            </p>
            <div
              className="overflow-hidden rounded-xl border border-slate-700 bg-[#eef2ee]"
              style={{ height: Math.round(innerH * scale) }}
            >
              <iframe
                title="Podgląd etykiety"
                srcDoc={previewDoc}
                style={{
                  width: innerW,
                  height: innerH,
                  border: 0,
                  transform: `scale(${scale})`,
                  transformOrigin: 'top left',
                }}
              />
            </div>
          </div>

          <button
            type="button"
            disabled={!queue.length}
            onClick={() => printShelfLabels(queue, cfg)}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
          >
            <Printer className="h-4 w-4" />
            Drukuj {totalLabels} {totalLabels === 1 ? 'etykietę' : 'etykiet'}
          </button>
          <p className="text-[11px] leading-snug text-slate-500">
            {cfg.mode === 'roll'
              ? `W oknie druku ustaw papier ${cfg.w}×${cfg.h} mm i brak marginesów (drukarka etykiet).`
              : 'W oknie druku wybierz A4 i skalę 100% (bez „dopasuj do strony”).'}
          </p>
        </aside>
      </div>
    </div>
  );
}
