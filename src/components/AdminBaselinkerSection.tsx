import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Download, Loader2, RefreshCw, Send, XCircle } from 'lucide-react';
import {
  compareBaselinkerStock,
  fetchBaselinkerConfig,
  pushBaselinkerStock,
  setBaselinkerAutoStock,
  type BaselinkerCompare,
  type BaselinkerConfig,
  type BaselinkerPushResult,
} from '../lib/baselinkerApi';
import { downloadCsv, stampFile } from '../lib/exportReport';
import { showToast } from '../lib/toast';

type Tab = 'diffs' | 'missing' | 'onlyBl';

function asList(v: unknown): Record<string, unknown>[] {
  return Array.isArray(v) ? (v as Record<string, unknown>[]) : [];
}

export function AdminBaselinkerSection() {
  const [config, setConfig] = useState<BaselinkerConfig | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [comparing, setComparing] = useState(false);
  const [result, setResult] = useState<BaselinkerCompare | null>(null);
  const [tab, setTab] = useState<Tab>('diffs');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pushing, setPushing] = useState(false);
  const [pushResult, setPushResult] = useState<BaselinkerPushResult | null>(null);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    void fetchBaselinkerConfig()
      .then(setConfig)
      .catch((e) => setConfigError(e instanceof Error ? e.message : 'Błąd'));
  }, []);

  async function runCompare() {
    setComparing(true);
    setPushResult(null);
    try {
      const r = await compareBaselinkerStock();
      setResult(r);
      setSelected(new Set(r.diffs.map((d) => d.sku)));
      setTab('diffs');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Błąd porównania', 'error', 6000);
    } finally {
      setComparing(false);
    }
  }

  async function runPush() {
    if (!selected.size) return;
    if (
      !confirm(
        `Wysłać do BaseLinkera stany dla ${selected.size} produktów?\n\nStan w BaseLinkerze zostanie ustawiony na wartość z katalogu (WAPRO).`,
      )
    )
      return;
    setPushing(true);
    try {
      const r = await pushBaselinkerStock([...selected]);
      setPushResult(r);
      showToast(`Wysłano stany: ${r.updated} produktów`, 'ok');
      void runCompare();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Błąd wysyłki', 'error', 6000);
    } finally {
      setPushing(false);
    }
  }

  async function toggleAuto(enabled: boolean) {
    try {
      const r = await setBaselinkerAutoStock(enabled);
      setConfig((c) => (c ? { ...c, autoStock: r.autoStock } : c));
      showToast(
        r.autoStock
          ? 'Automatyczne wysyłanie stanów po syncu WAPRO włączone'
          : 'Automatyczne wysyłanie wyłączone',
        'ok',
      );
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Błąd', 'error');
    }
  }

  const rows = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const list = result?.diffs ?? [];
    return q ? list.filter((d) => d.sku.toLowerCase().includes(q) || d.name.toLowerCase().includes(q)) : list;
  }, [result, filter]);

  function exportCsv() {
    if (!result) return;
    if (tab === 'diffs')
      downloadCsv(
        stampFile('baselinker_rozjazdy_stanow'),
        ['SKU', 'Nazwa', 'Katalog (WAPRO)', 'BaseLinker', 'Różnica', 'ID BL'],
        result.diffs.map((d) => [d.sku, d.name, d.ours, d.bl, d.ours - d.bl, d.blId]),
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

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.sku));

  return (
    <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
      {/* Konfiguracja */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-100">Połączenie z BaseLinkerem</h2>
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
            {[
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
                config.configured.priceGroupId || 'pierwsza z BL',
                true,
              ],
            ].map(([label, value, ok]) => (
              <div key={String(label)} className="rounded-xl border border-slate-800 bg-slate-950/50 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
                <p
                  className={`mt-0.5 flex items-center gap-1.5 font-semibold ${ok ? 'text-slate-100' : 'text-red-400'}`}
                >
                  {ok ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5" />
                  )}
                  {String(value)}
                </p>
              </div>
            ))}
          </div>
        )}
        {config && !config.configured.token && (
          <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            Ustaw sekrety: <code>npx supabase secrets set BASELINKER_TOKEN=… BASELINKER_INVENTORY_ID=…</code>, a przy
            kilku magazynach także <code>BASELINKER_WAREHOUSE_ID=bl_123</code>.
          </p>
        )}
        {config && !config.resolvedWarehouse && config.configured.token && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            <p>
              Nie udało się wybrać magazynu automatycznie (w BaseLinkerze jest ich kilka). Ustaw{' '}
              <code>BASELINKER_WAREHOUSE_ID</code> na jeden z poniższych:
            </p>
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
        {config && (
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={config.autoStock}
              onChange={(e) => void toggleAuto(e.target.checked)}
              className="h-4 w-4 accent-brand-500"
            />
            Automatycznie wysyłaj do BaseLinkera stany zmienione przy syncu WAPRO
            <span className="text-xs text-slate-500">(agent na serwerze wywołuje funkcję po każdym syncu)</span>
          </label>
        )}
      </section>

      {/* Porównanie */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void runCompare()}
            disabled={comparing || !config?.configured.token}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-50"
          >
            {comparing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Porównaj stany katalog ↔ BaseLinker
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
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-6">
              {[
                ['W katalogu', result.totals.ours],
                ['W BaseLinkerze', result.totals.bl],
                ['Dopasowane', result.totals.matched],
                ['Różne stany', result.totals.diffs],
                ['Brak w BL (ze stanem)', result.totals.missingInBl],
                ['Tylko w BL', result.totals.onlyInBl],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-xl border border-slate-800 bg-slate-950/50 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
                  <p className="text-lg font-bold text-slate-100">{String(value)}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-1">
              {(
                [
                  ['diffs', `Różnice stanów (${result.totals.diffs})`],
                  ['missing', `Brak w BaseLinkerze (${result.totals.missingInBl})`],
                  ['onlyBl', `Tylko w BaseLinkerze (${result.totals.onlyInBl})`],
                ] as const
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

            {tab === 'diffs' && (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    placeholder="Filtr SKU / nazwa…"
                    className="input-field max-w-xs text-sm"
                  />
                  <span className="text-xs text-slate-500">
                    Zaznaczono {selected.size} z {result.diffs.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => void runPush()}
                    disabled={pushing || !selected.size}
                    className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                  >
                    {pushing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Wyślij zaznaczone do BaseLinkera
                  </button>
                </div>
                {pushResult && (
                  <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
                    Zaktualizowano {pushResult.updated} z {pushResult.requested}.
                    {pushResult.noLinkCount > 0 && ` Bez powiązania w BL: ${pushResult.noLinkCount}.`}
                    {Object.keys(pushResult.warnings ?? {}).length > 0 &&
                      ` Ostrzeżenia BL: ${Object.keys(pushResult.warnings).length}.`}
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
                                const next = new Set(prev);
                                for (const r of rows) {
                                  if (e.target.checked) next.add(r.sku);
                                  else next.delete(r.sku);
                                }
                                return next;
                              })
                            }
                            className="h-4 w-4 accent-brand-500"
                          />
                        </th>
                        <th className="px-3 py-2">SKU</th>
                        <th className="px-3 py-2">Nazwa</th>
                        <th className="px-3 py-2 text-right">Katalog</th>
                        <th className="px-3 py-2 text-right">BaseLinker</th>
                        <th className="px-3 py-2 text-right">Różnica</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((d) => (
                        <tr key={d.sku} className="border-t border-slate-800/70">
                          <td className="px-3 py-1.5">
                            <input
                              type="checkbox"
                              checked={selected.has(d.sku)}
                              onChange={(e) =>
                                setSelected((prev) => {
                                  const next = new Set(prev);
                                  if (e.target.checked) next.add(d.sku);
                                  else next.delete(d.sku);
                                  return next;
                                })
                              }
                              className="h-4 w-4 accent-brand-500"
                            />
                          </td>
                          <td className="px-3 py-1.5 font-mono text-brand-300">{d.sku}</td>
                          <td className="max-w-[22rem] truncate px-3 py-1.5 text-slate-300">{d.name}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{d.ours}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{d.bl}</td>
                          <td
                            className={`px-3 py-1.5 text-right font-semibold tabular-nums ${
                              d.ours - d.bl > 0 ? 'text-emerald-400' : 'text-red-400'
                            }`}
                          >
                            {d.ours - d.bl > 0 ? '+' : ''}
                            {d.ours - d.bl}
                          </td>
                        </tr>
                      ))}
                      {!rows.length && (
                        <tr>
                          <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                            Brak różnic — stany zgodne.
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
      </section>
    </div>
  );
}
