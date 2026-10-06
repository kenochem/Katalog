import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Download,
  Loader2,
  RefreshCw,
  Save,
  Send,
  Settings2,
  XCircle,
  History,
  GitCompare,
} from 'lucide-react';
import {
  compareBaselinker,
  fetchBaselinkerConfig,
  fetchBaselinkerHistory,
  pushToBaselinker,
  saveBaselinkerSettings,
  type BaselinkerCompare,
  type BaselinkerConfig,
  type BaselinkerDiffRow,
  type BaselinkerLogRow,
  type BaselinkerPushResult,
  type BaselinkerSettings,
} from '../lib/baselinkerApi';
import { downloadCsv, stampFile } from '../lib/exportReport';
import { formatPricePln } from '../lib/format';
import { showToast } from '../lib/toast';

type Section = 'settings' | 'compare' | 'history';
type CompareTab = 'stock' | 'price' | 'missing' | 'onlyBl';

function asList(v: unknown): Record<string, unknown>[] {
  return Array.isArray(v) ? (v as Record<string, unknown>[]) : [];
}

const STATUS_STYLE: Record<string, string> = {
  ok: 'bg-emerald-500/15 text-emerald-300',
  warning: 'bg-amber-500/15 text-amber-300',
  error: 'bg-red-500/15 text-red-300',
  blocked: 'bg-red-500/15 text-red-300',
};

const FIELD_LABEL: Record<string, string> = {
  stock: 'Stany',
  price: 'Ceny',
  'stock+price': 'Stany + ceny',
};

function Toggle({
  checked,
  onChange,
  title,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  title: string;
  hint?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 accent-brand-500"
      />
      <span>
        <span className="block text-sm font-medium text-slate-100">{title}</span>
        {hint && <span className="block text-xs text-slate-500">{hint}</span>}
      </span>
    </label>
  );
}

export function AdminBaselinkerSection() {
  const [section, setSection] = useState<Section>('settings');
  const [config, setConfig] = useState<BaselinkerConfig | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [draft, setDraft] = useState<BaselinkerSettings | null>(null);
  const [prefixText, setPrefixText] = useState('');
  const [skuText, setSkuText] = useState('');
  const [saving, setSaving] = useState(false);

  const [comparing, setComparing] = useState(false);
  const [result, setResult] = useState<BaselinkerCompare | null>(null);
  const [tab, setTab] = useState<CompareTab>('stock');
  const [selected, setSelected] = useState<Record<'stock' | 'price', Set<string>>>({
    stock: new Set(),
    price: new Set(),
  });
  const [pushing, setPushing] = useState(false);
  const [pushResult, setPushResult] = useState<BaselinkerPushResult | null>(null);
  const [filter, setFilter] = useState('');

  const [history, setHistory] = useState<BaselinkerLogRow[] | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);

  function applyConfig(c: BaselinkerConfig) {
    setConfig(c);
    setDraft(c.settings);
    setPrefixText(c.settings.excludePrefixes.join(', '));
    setSkuText(c.settings.excludeSkus.join('\n'));
  }

  useEffect(() => {
    void fetchBaselinkerConfig()
      .then(applyConfig)
      .catch((e) => setConfigError(e instanceof Error ? e.message : 'Błąd'));
  }, []);

  async function loadHistory() {
    setHistoryError(null);
    try {
      setHistory(await fetchBaselinkerHistory());
    } catch (e) {
      setHistoryError(e instanceof Error ? e.message : 'Błąd');
    }
  }

  useEffect(() => {
    if (section === 'history') void loadHistory();
  }, [section]);

  async function saveSettings() {
    if (!draft) return;
    setSaving(true);
    try {
      const next: BaselinkerSettings = {
        ...draft,
        excludePrefixes: prefixText.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean),
        excludeSkus: skuText.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean),
      };
      const r = await saveBaselinkerSettings(next);
      setDraft(r.settings);
      setConfig((c) => (c ? { ...c, settings: r.settings } : c));
      showToast('Zapisano ustawienia synchronizacji BaseLinker', 'ok');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Błąd zapisu', 'error', 6000);
    } finally {
      setSaving(false);
    }
  }

  async function runCompare() {
    setComparing(true);
    setPushResult(null);
    try {
      const r = await compareBaselinker();
      setResult(r);
      setSelected({
        stock: new Set(r.stockDiffs.map((d) => d.sku)),
        price: new Set(r.priceDiffs.map((d) => d.sku)),
      });
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Błąd porównania', 'error', 6000);
    } finally {
      setComparing(false);
    }
  }

  async function runPush(field: 'stock' | 'price') {
    const skus = [...selected[field]];
    if (!skus.length) return;
    const what = field === 'stock' ? 'stany' : 'ceny brutto';
    if (
      !confirm(
        `Wysłać do BaseLinkera ${what} dla ${skus.length} produktów?\n\nWartości w BaseLinkerze zostaną ustawione na te z katalogu (WAPRO).`,
      )
    )
      return;
    setPushing(true);
    try {
      const r = await pushToBaselinker(skus, [field]);
      setPushResult(r);
      showToast(`Wysłano (${what}): ${r.results[field]?.updated ?? 0} produktów`, 'ok');
      void runCompare();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Błąd wysyłki', 'error', 6000);
    } finally {
      setPushing(false);
    }
  }

  const diffRows: BaselinkerDiffRow[] = useMemo(() => {
    const list = tab === 'price' ? (result?.priceDiffs ?? []) : (result?.stockDiffs ?? []);
    const q = filter.trim().toLowerCase();
    return q ? list.filter((d) => d.sku.toLowerCase().includes(q) || d.name.toLowerCase().includes(q)) : list;
  }, [result, filter, tab]);

  function exportCsv() {
    if (!result) return;
    if (tab === 'stock' || tab === 'price')
      downloadCsv(
        stampFile(tab === 'stock' ? 'baselinker_rozjazdy_stanow' : 'baselinker_rozjazdy_cen'),
        ['SKU', 'Nazwa', 'Katalog (WAPRO)', 'BaseLinker', 'ID BL'],
        (tab === 'stock' ? result.stockDiffs : result.priceDiffs).map((d) => [d.sku, d.name, d.ours, d.bl, d.blId]),
      );
    else if (tab === 'missing')
      downloadCsv(
        stampFile('baselinker_brak_w_bl'),
        ['SKU', 'Nazwa', 'Stan w katalogu'],
        result.missingInBl.map((d) => [d.sku, d.name, d.ours]),
      );
    else
      downloadCsv(
        stampFile('baselinker_tylko_w_bl'),
        ['SKU', 'Nazwa', 'Stan BL', 'ID BL'],
        result.onlyInBl.map((d) => [d.sku, d.name, d.bl, d.blId]),
      );
  }

  const activeField: 'stock' | 'price' = tab === 'price' ? 'price' : 'stock';
  const allSelected = diffRows.length > 0 && diffRows.every((r) => selected[activeField].has(r.sku));

  const sectionBtn = (id: Section, label: string, icon: React.ReactNode) => (
    <button
      type="button"
      onClick={() => setSection(id)}
      className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium ${
        section === id ? 'bg-brand-500/15 text-brand-300' : 'text-slate-400 hover:bg-slate-800'
      }`}
    >
      {icon}
      {label}
    </button>
  );

  const fmt = (field: 'stock' | 'price', v: number | null) =>
    v == null ? '—' : field === 'price' ? formatPricePln(v) : String(v);

  return (
    <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
      {configError && (
        <p className="flex items-start gap-1.5 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {configError.includes('non-2xx') || configError.includes('Failed to send')
            ? 'Funkcja `baselinker` nie jest wdrożona w Supabase (npx supabase functions deploy baselinker).'
            : configError}
        </p>
      )}

      {config && (
        <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
          {(
            [
              ['Token API', config.configured.token ? 'ustawiony' : 'BRAK', config.configured.token],
              [
                'Katalog (inventory)',
                config.configured.inventoryId ? String(config.configured.inventoryId) : 'BRAK',
                Boolean(config.configured.inventoryId),
              ],
              [
                'Magazyn stanów',
                config.resolvedWarehouse || config.configured.warehouseId || 'nie wybrano',
                Boolean(config.resolvedWarehouse || config.configured.warehouseId),
              ],
              [
                'Grupa cenowa',
                config.settings.priceGroupId || config.configured.priceGroupId || 'wybierz w ustawieniach',
                Boolean(config.settings.priceGroupId || config.configured.priceGroupId),
              ],
            ] as [string, string, boolean][]
          ).map(([label, value, ok]) => (
            <div key={label} className="rounded-xl border border-slate-800 bg-slate-950/50 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
              <p className={`mt-0.5 flex items-center gap-1.5 font-semibold ${ok ? 'text-slate-100' : 'text-amber-400'}`}>
                {ok ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <XCircle className="h-3.5 w-3.5" />
                )}
                {value}
              </p>
            </div>
          ))}
        </div>
      )}

      {config && !config.configured.token && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          Ustaw sekrety: <code>npx supabase secrets set BASELINKER_TOKEN=… BASELINKER_INVENTORY_ID=… BASELINKER_WAREHOUSE_ID=bl_…</code>
        </p>
      )}

      <div className="flex flex-wrap gap-1 border-b border-slate-800 pb-2">
        {sectionBtn('settings', 'Ustawienia synchronizacji', <Settings2 className="h-4 w-4" />)}
        {sectionBtn('compare', 'Porównanie i korekta', <GitCompare className="h-4 w-4" />)}
        {sectionBtn('history', 'Historia wysyłek', <History className="h-4 w-4" />)}
      </div>

      {/* ---------------- USTAWIENIA ---------------- */}
      {section === 'settings' && draft && (
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            Źródłem prawdy jest katalog (dane z WAPRO). Synchronizacja idzie jednokierunkowo: katalog → BaseLinker.
            Automat uruchamia agent na serwerze WAPRO po każdym syncu i wysyła tylko produkty, którym coś się zmieniło.
          </p>

          <div className="grid gap-2 lg:grid-cols-2">
            <Toggle
              checked={draft.stockAuto}
              onChange={(v) => setDraft({ ...draft, stockAuto: v })}
              title="Automatycznie wysyłaj stany"
              hint="Po każdym syncu WAPRO stany zmienionych produktów trafiają do BaseLinkera."
            />
            <Toggle
              checked={draft.priceAuto}
              onChange={(v) => setDraft({ ...draft, priceAuto: v })}
              title="Automatycznie wysyłaj ceny brutto"
              hint="Cena sprzedaży brutto z katalogu (gdy brak — netto + VAT) ustawiana w wybranej grupie cenowej."
            />
            <Toggle
              checked={draft.skipManualStock}
              onChange={(v) => setDraft({ ...draft, skipManualStock: v })}
              title="Pomijaj w automacie produkty z ręcznym stanem"
              hint="Produkty, którym stan ustawiono ręcznie w katalogu, nie będą nadpisywane w BaseLinkerze przez automat."
            />
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Grupa cenowa BaseLinker (dla cen)
              </span>
              <select
                value={draft.priceGroupId}
                onChange={(e) => setDraft({ ...draft, priceGroupId: e.target.value })}
                className="input-field text-sm"
              >
                <option value="">— wybierz —</option>
                {asList(config?.priceGroups).map((g, i) => (
                  <option key={i} value={String(g.price_group_id)}>
                    {String(g.name ?? g.price_group_id)} ({String(g.price_group_id)}
                    {g.currency ? `, ${String(g.currency)}` : ''})
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Limit zmian w jednym automatycznym przebiegu
              </span>
              <input
                type="number"
                min={1}
                max={5000}
                value={draft.maxAutoChanges}
                onChange={(e) => setDraft({ ...draft, maxAutoChanges: Number(e.target.value) })}
                className="input-field text-sm"
              />
              <span className="mt-1 block text-xs text-slate-500">
                Zabezpieczenie: jeśli sync zmieni więcej produktów, automat nic nie wyśle (wpis „zablokowano" w historii),
                a wysyłkę zrobisz ręcznie po przejrzeniu.
              </span>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Tolerancja różnicy ceny (zł)
              </span>
              <input
                type="number"
                min={0}
                step={0.01}
                value={draft.priceTolerance}
                onChange={(e) => setDraft({ ...draft, priceTolerance: Number(e.target.value) })}
                className="input-field text-sm"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Wyłącz z synchronizacji — prefiksy SKU
              </span>
              <input
                value={prefixText}
                onChange={(e) => setPrefixText(e.target.value)}
                className="input-field text-sm"
                placeholder="np. ZEST, PAL, X"
              />
            </label>
            <label className="block lg:col-span-2">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Wyłącz z synchronizacji — pojedyncze SKU (po spacji, przecinku lub w nowej linii)
              </span>
              <textarea
                value={skuText}
                onChange={(e) => setSkuText(e.target.value)}
                rows={2}
                className="input-field text-sm"
              />
            </label>
          </div>

          <button
            type="button"
            onClick={() => void saveSettings()}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Zapisz ustawienia
          </button>

          {config && !config.resolvedWarehouse && config.configured.token && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              Magazyn stanów nie jest wybrany. Ustaw sekret <code>BASELINKER_WAREHOUSE_ID</code> na jeden z:
              <ul className="mt-1 list-disc pl-5">
                {asList(config.warehouses).map((w, i) => (
                  <li key={i}>
                    <code>
                      {String(w.warehouse_type)}_{String(w.warehouse_id)}
                    </code>{' '}
                    — {String(w.name ?? '')}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* ---------------- PORÓWNANIE ---------------- */}
      {section === 'compare' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void runCompare()}
              disabled={comparing || !config?.configured.token}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-50"
            >
              {comparing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Porównaj katalog ↔ BaseLinker
            </button>
            {result && (
              <button
                type="button"
                onClick={exportCsv}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"
              >
                <Download className="h-4 w-4" />
                CSV
              </button>
            )}
          </div>

          {result && (
            <>
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-7">
                {(
                  [
                    ['W katalogu', result.totals.ours],
                    ['W BaseLinkerze', result.totals.bl],
                    ['Dopasowane', result.totals.matched],
                    ['Różne stany', result.totals.stockDiffs],
                    ['Różne ceny', result.totals.priceDiffs],
                    ['Brak w BL', result.totals.missingInBl],
                    ['Wyłączone', result.totals.excluded],
                  ] as [string, number][]
                ).map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-slate-800 bg-slate-950/50 px-3 py-2">
                    <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
                    <p className="text-lg font-bold text-slate-100">{value}</p>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-1">
                {(
                  [
                    ['stock', `Stany (${result.totals.stockDiffs})`],
                    ['price', `Ceny (${result.totals.priceDiffs})`],
                    ['missing', `Brak w BaseLinkerze (${result.totals.missingInBl})`],
                    ['onlyBl', `Tylko w BaseLinkerze (${result.totals.onlyInBl})`],
                  ] as [CompareTab, string][]
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTab(id)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                      tab === id ? 'bg-brand-500/15 text-brand-300' : 'text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {(tab === 'stock' || tab === 'price') && (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                      placeholder="Filtr SKU / nazwa…"
                      className="input-field max-w-xs text-sm"
                    />
                    <span className="text-xs text-slate-500">
                      Zaznaczono {selected[activeField].size} z{' '}
                      {(tab === 'stock' ? result.stockDiffs : result.priceDiffs).length}
                    </span>
                    <button
                      type="button"
                      onClick={() => void runPush(activeField)}
                      disabled={pushing || !selected[activeField].size}
                      className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                    >
                      {pushing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      {tab === 'stock' ? 'Wyślij zaznaczone stany' : 'Wyślij zaznaczone ceny'}
                    </button>
                  </div>
                  {pushResult && (
                    <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
                      {Object.entries(pushResult.results)
                        .map(
                          ([f, r]) =>
                            `${FIELD_LABEL[f] ?? f}: zaktualizowano ${r.updated}${
                              r.error ? ` (błąd: ${r.error})` : ''
                            }`,
                        )
                        .join(' · ')}
                      {pushResult.noLinkCount > 0 && ` · bez powiązania w BL: ${pushResult.noLinkCount}`}
                    </p>
                  )}
                  <div className="max-h-[28rem] overflow-auto rounded-xl border border-slate-800">
                    <table className="min-w-full text-sm">
                      <thead className="sticky top-0 bg-slate-900 text-left text-[11px] uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-3 py-2">
                            <input
                              type="checkbox"
                              checked={allSelected}
                              onChange={(e) =>
                                setSelected((prev) => {
                                  const next = new Set(prev[activeField]);
                                  for (const r of diffRows) {
                                    if (e.target.checked) next.add(r.sku);
                                    else next.delete(r.sku);
                                  }
                                  return { ...prev, [activeField]: next };
                                })
                              }
                              className="h-4 w-4 accent-brand-500"
                            />
                          </th>
                          <th className="px-3 py-2">SKU</th>
                          <th className="px-3 py-2">Nazwa</th>
                          <th className="px-3 py-2 text-right">Katalog</th>
                          <th className="px-3 py-2 text-right">BaseLinker</th>
                        </tr>
                      </thead>
                      <tbody>
                        {diffRows.map((d) => (
                          <tr key={d.sku} className="border-t border-slate-800/70">
                            <td className="px-3 py-1.5">
                              <input
                                type="checkbox"
                                checked={selected[activeField].has(d.sku)}
                                onChange={(e) =>
                                  setSelected((prev) => {
                                    const next = new Set(prev[activeField]);
                                    if (e.target.checked) next.add(d.sku);
                                    else next.delete(d.sku);
                                    return { ...prev, [activeField]: next };
                                  })
                                }
                                className="h-4 w-4 accent-brand-500"
                              />
                            </td>
                            <td className="px-3 py-1.5 font-mono text-brand-300">
                              {d.sku}
                              {d.manual && (
                                <span className="ml-1.5 rounded bg-amber-500/15 px-1 text-[10px] text-amber-300" title="Stan ustawiony ręcznie w katalogu">
                                  ręczny
                                </span>
                              )}
                            </td>
                            <td className="max-w-[22rem] truncate px-3 py-1.5 text-slate-300">{d.name}</td>
                            <td className="px-3 py-1.5 text-right tabular-nums">{fmt(activeField, d.ours)}</td>
                            <td className="px-3 py-1.5 text-right font-semibold tabular-nums text-amber-400">
                              {fmt(activeField, d.bl)}
                            </td>
                          </tr>
                        ))}
                        {!diffRows.length && (
                          <tr>
                            <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                              Brak różnic — wartości zgodne.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {tab === 'missing' && (
                <div className="max-h-[28rem] overflow-auto rounded-xl border border-slate-800">
                  <table className="min-w-full text-sm">
                    <thead className="sticky top-0 bg-slate-900 text-left text-[11px] uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-3 py-2">SKU</th>
                        <th className="px-3 py-2">Nazwa</th>
                        <th className="px-3 py-2 text-right">Stan w katalogu</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.missingInBl.map((d) => (
                        <tr key={d.sku} className="border-t border-slate-800/70">
                          <td className="px-3 py-1.5 font-mono text-brand-300">{d.sku}</td>
                          <td className="max-w-[28rem] truncate px-3 py-1.5 text-slate-300">{d.name}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{d.ours}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {tab === 'onlyBl' && (
                <div className="max-h-[28rem] overflow-auto rounded-xl border border-slate-800">
                  <table className="min-w-full text-sm">
                    <thead className="sticky top-0 bg-slate-900 text-left text-[11px] uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-3 py-2">SKU</th>
                        <th className="px-3 py-2">Nazwa</th>
                        <th className="px-3 py-2 text-right">Stan BL</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.onlyInBl.map((d) => (
                        <tr key={d.blId} className="border-t border-slate-800/70">
                          <td className="px-3 py-1.5 font-mono text-brand-300">{d.sku}</td>
                          <td className="max-w-[28rem] truncate px-3 py-1.5 text-slate-300">{d.name}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{d.bl}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ---------------- HISTORIA ---------------- */}
      {section === 'history' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">Ostatnie 150 wysyłek do BaseLinkera (ręczne i automatyczne).</p>
            <button
              type="button"
              onClick={() => void loadHistory()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Odśwież
            </button>
          </div>
          {historyError && (
            <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {/baselinker_sync_log/.test(historyError)
                ? 'Brak tabeli baselinker_sync_log — uruchom supabase/migration-baselinker-sync-log.sql.'
                : historyError}
            </p>
          )}
          {history && history.length === 0 && (
            <p className="rounded-xl border border-dashed border-slate-700 py-8 text-center text-sm text-slate-500">
              Brak wysyłek.
            </p>
          )}
          {history && history.length > 0 && (
            <div className="max-h-[32rem] overflow-auto rounded-xl border border-slate-800">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 bg-slate-900 text-left text-[11px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Kiedy</th>
                    <th className="px-3 py-2">Tryb</th>
                    <th className="px-3 py-2">Kto</th>
                    <th className="px-3 py-2">Co</th>
                    <th className="px-3 py-2 text-right">Wysłano</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Uwagi</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.id} className="border-t border-slate-800/70 align-top">
                      <td className="whitespace-nowrap px-3 py-1.5 text-xs tabular-nums text-slate-400">
                        {new Date(h.created_at).toLocaleString('pl-PL')}
                      </td>
                      <td className="px-3 py-1.5 text-xs text-slate-300">{h.trigger === 'auto' ? 'automat' : 'ręcznie'}</td>
                      <td className="px-3 py-1.5 text-xs text-slate-300">{h.user_label}</td>
                      <td className="px-3 py-1.5 text-slate-200">{FIELD_LABEL[h.field] ?? h.field}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">
                        {h.updated}
                        <span className="text-xs text-slate-500"> / {h.requested}</span>
                      </td>
                      <td className="px-3 py-1.5">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLE[h.status] ?? 'bg-slate-800 text-slate-300'}`}>
                          {h.status}
                        </span>
                      </td>
                      <td className="max-w-[20rem] px-3 py-1.5 text-xs text-slate-400">
                        {h.note}
                        {!!h.sample?.length && (
                          <span className="block truncate text-slate-500" title={h.sample.map((s) => `${s.sku}=${s.value}`).join(', ')}>
                            np. {h.sample.slice(0, 3).map((s) => `${s.sku}=${s.value}`).join(', ')}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
