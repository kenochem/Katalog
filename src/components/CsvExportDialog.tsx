import { ArrowDown, ArrowUp, Download, Loader2, Save, Search, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { Product } from '../types';
import { supabase } from '../lib/supabase';
import {
  BUILTIN_PRESETS,
  COLUMN_BY_ID,
  DEFAULT_OPTIONS,
  EXPORT_COLUMNS,
  GROUP_LABEL,
  GROUP_ORDER,
  buildCsv,
  downloadCsvFile,
  exportFileName,
  formatCell,
  headerOf,
  loadLastConfig,
  loadSavedProfiles,
  neededDescriptions,
  saveLastConfig,
  saveProfiles,
  type ExportConfig,
  type ExportOptions,
  type SavedExportProfile,
} from '../lib/csvExport';
import { showToast } from '../lib/toast';

async function fetchDescriptions(ids: string[], onProgress: (done: number) => void): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!supabase) return map;
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await supabase.from('products').select('id,description').in('id', ids.slice(i, i + 200));
    if (error) throw new Error(error.message);
    for (const r of data ?? []) map.set(String(r.id), String(r.description ?? ''));
    onProgress(Math.min(ids.length, i + 200));
  }
  return map;
}

/** Konfigurowalny eksport CSV: kolumny, ceny, format liczb, separator; profile zapisują się w przeglądarce. */
export function CsvExportDialog({
  products,
  selectedIds,
  title = 'Eksport CSV',
  filePrefix = 'produkty',
  onClose,
}: {
  products: Product[];
  /** Zaznaczone produkty (opcjonalnie) — pojawia się wybór zakresu. */
  selectedIds?: Set<string>;
  title?: string;
  filePrefix?: string;
  onClose: () => void;
}) {
  const [config, setConfig] = useState<ExportConfig>(() => ({ ...loadLastConfig(), filePrefix }));
  const [profiles, setProfiles] = useState<SavedExportProfile[]>(() => loadSavedProfiles());
  const [profileName, setProfileName] = useState('');
  const [search, setSearch] = useState('');
  const [scope, setScope] = useState<'all' | 'selected'>(selectedIds && selectedIds.size > 0 ? 'selected' : 'all');
  const [showOptions, setShowOptions] = useState(false);
  const [busy, setBusy] = useState<{ done: number; total: number } | null>(null);

  const scoped = useMemo(
    () => (scope === 'selected' && selectedIds ? products.filter((p) => selectedIds.has(p.id)) : products),
    [products, scope, selectedIds],
  );

  useEffect(() => {
    saveLastConfig(config);
  }, [config]);

  const chosen = useMemo(() => new Set(config.columns.map((c) => c.id)), [config.columns]);
  const q = search.trim().toLowerCase();

  function setOption<K extends keyof ExportOptions>(key: K, value: ExportOptions[K]) {
    setConfig((c) => ({ ...c, options: { ...c.options, [key]: value } }));
  }

  function toggleColumn(id: string) {
    setConfig((c) => ({
      ...c,
      columns: c.columns.some((x) => x.id === id) ? c.columns.filter((x) => x.id !== id) : [...c.columns, { id }],
    }));
  }

  function toggleGroup(group: string, on: boolean) {
    const ids = EXPORT_COLUMNS.filter((c) => c.group === group).map((c) => c.id);
    setConfig((c) => {
      const rest = c.columns.filter((x) => !ids.includes(x.id));
      return { ...c, columns: on ? [...c.columns, ...ids.filter((id) => !c.columns.some((x) => x.id === id)).map((id) => ({ id }))] : rest };
    });
  }

  function move(index: number, dir: -1 | 1) {
    setConfig((c) => {
      const next = [...c.columns];
      const j = index + dir;
      if (j < 0 || j >= next.length) return c;
      [next[index], next[j]] = [next[j], next[index]];
      return { ...c, columns: next };
    });
  }

  function applyPreset(columns: string[]) {
    setConfig((c) => ({ ...c, columns: columns.map((id) => ({ id })) }));
  }

  function saveProfile() {
    const name = profileName.trim();
    if (!name) return;
    const next = [...profiles.filter((p) => p.name !== name), { name, config }];
    setProfiles(next);
    saveProfiles(next);
    setProfileName('');
    showToast(`Zapisano profil „${name}”`, 'ok');
  }

  function removeProfile(name: string) {
    const next = profiles.filter((p) => p.name !== name);
    setProfiles(next);
    saveProfiles(next);
  }

  const previewRows = useMemo(() => {
    const cols = config.columns.map((c) => ({ choice: c, col: COLUMN_BY_ID.get(c.id) })).filter((x) => x.col);
    return scoped.slice(0, 5).map((p) =>
      cols.map((x) =>
        formatCell(x.col!, x.col!.get(p, { options: config.options }), config.options),
      ),
    );
  }, [scoped, config]);

  async function doExport() {
    if (config.columns.length === 0 || scoped.length === 0) return;
    try {
      let descriptions: Map<string, string> | undefined;
      if (neededDescriptions(config)) {
        setBusy({ done: 0, total: scoped.length });
        descriptions = await fetchDescriptions(
          scoped.map((p) => p.id),
          (done) => setBusy({ done, total: scoped.length }),
        );
      }
      const csv = buildCsv(scoped, config, descriptions);
      downloadCsvFile(csv, exportFileName(config.filePrefix), config.options.bom);
      showToast(`Wyeksportowano ${scoped.length} wierszy, ${config.columns.length} kolumn`, 'ok');
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Nie udało się wyeksportować', 'error', 7000);
    } finally {
      setBusy(null);
    }
  }

  const o = config.options;
  const sel = 'input-field !w-auto text-sm';

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-2 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-800 px-5 py-3">
          <div>
            <h3 className="flex items-center gap-2 text-base font-bold text-slate-50">
              <Download className="h-4 w-4" /> {title}
            </h3>
            <p className="text-xs text-slate-400">Wybierz kolumny, ich kolejność i format. Ustawienia zapamiętujemy w tej przeglądarce.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800" aria-label="Zamknij">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {/* profile i zakres */}
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Gotowe zestawy kolumn</p>
            <div className="flex flex-wrap gap-2">
              {BUILTIN_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  title={p.hint}
                  onClick={() => applyPreset(p.columns)}
                  className="rounded-full border border-slate-700 bg-slate-800/60 px-3 py-1 text-xs font-semibold text-slate-200 hover:border-brand-500 hover:text-brand-300"
                >
                  {p.name}
                </button>
              ))}
              {profiles.map((p) => (
                <span key={p.name} className="inline-flex items-center overflow-hidden rounded-full border border-violet-500/40 bg-violet-500/10 text-xs font-semibold text-violet-200">
                  <button type="button" onClick={() => setConfig({ ...p.config, filePrefix: config.filePrefix })} className="px-3 py-1 hover:bg-violet-500/20">
                    ★ {p.name}
                  </button>
                  <button type="button" onClick={() => removeProfile(p.name)} className="px-1.5 py-1 hover:bg-rose-500/30" aria-label={`Usuń profil ${p.name}`}>
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && saveProfile()}
                placeholder="Nazwa własnego profilu…"
                className="input-field !w-56 text-sm"
              />
              <button
                type="button"
                disabled={!profileName.trim()}
                onClick={saveProfile}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-600 px-3 py-2 text-xs font-semibold text-slate-100 hover:bg-slate-800 disabled:opacity-40"
              >
                <Save className="h-3.5 w-3.5" /> Zapisz bieżące ustawienia
              </button>
              {selectedIds && selectedIds.size > 0 && (
                <div className="ml-auto inline-flex rounded-xl border border-slate-700 p-0.5 text-xs font-semibold">
                  {(
                    [
                      ['selected', `Zaznaczone (${selectedIds.size})`],
                      ['all', `Wszystkie (${products.length})`],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setScope(key)}
                      className={`rounded-lg px-3 py-1.5 ${scope === key ? 'bg-brand-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* dostępne kolumny */}
            <section className="rounded-xl border border-slate-800 bg-slate-950/40">
              <div className="relative border-b border-slate-800 p-2">
                <Search className="pointer-events-none absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Szukaj kolumny…" className="input-field with-icon text-sm" />
              </div>
              <div className="max-h-72 space-y-3 overflow-y-auto p-3">
                {GROUP_ORDER.map((g) => {
                  const cols = EXPORT_COLUMNS.filter((c) => c.group === g && (!q || c.label.toLowerCase().includes(q)));
                  if (!cols.length) return null;
                  const all = cols.every((c) => chosen.has(c.id));
                  return (
                    <div key={g}>
                      <div className="mb-1 flex items-center justify-between">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{GROUP_LABEL[g]}</p>
                        <button type="button" onClick={() => toggleGroup(g, !all)} className="text-[11px] font-semibold text-brand-300 hover:underline">
                          {all ? 'odznacz grupę' : 'zaznacz grupę'}
                        </button>
                      </div>
                      <div className="grid gap-x-3 gap-y-1 sm:grid-cols-2">
                        {cols.map((c) => (
                          <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-0.5 text-sm text-slate-200 hover:bg-slate-800/60">
                            <input type="checkbox" checked={chosen.has(c.id)} onChange={() => toggleColumn(c.id)} className="h-4 w-4 accent-brand-500" />
                            <span className="truncate">{c.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* kolejność */}
            <section className="rounded-xl border border-slate-800 bg-slate-950/40">
              <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2.5">
                <p className="text-xs font-semibold text-slate-300">Kolumny w pliku ({config.columns.length}) — kolejność i nagłówki</p>
                {config.columns.length > 0 && (
                  <button type="button" onClick={() => setConfig((c) => ({ ...c, columns: [] }))} className="text-[11px] font-semibold text-rose-300 hover:underline">
                    wyczyść
                  </button>
                )}
              </div>
              <ol className="max-h-72 space-y-1 overflow-y-auto p-2">
                {config.columns.map((c, i) => {
                  const col = COLUMN_BY_ID.get(c.id);
                  if (!col) return null;
                  return (
                    <li key={c.id} className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/60 px-2 py-1">
                      <span className="w-5 text-center text-[10px] tabular-nums text-slate-500">{i + 1}</span>
                      <input
                        value={c.header ?? ''}
                        onChange={(e) =>
                          setConfig((cfg) => ({ ...cfg, columns: cfg.columns.map((x) => (x.id === c.id ? { ...x, header: e.target.value } : x)) }))
                        }
                        placeholder={headerOf({ id: c.id }, o)}
                        title="Własny nagłówek kolumny w pliku (puste = domyślny)"
                        className="min-w-0 flex-1 bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-400"
                      />
                      <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="rounded p-1 text-slate-400 hover:bg-slate-800 disabled:opacity-30" aria-label="W górę">
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={() => move(i, 1)} disabled={i === config.columns.length - 1} className="rounded p-1 text-slate-400 hover:bg-slate-800 disabled:opacity-30" aria-label="W dół">
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={() => toggleColumn(c.id)} className="rounded p-1 text-slate-400 hover:bg-rose-500/20 hover:text-rose-300" aria-label="Usuń kolumnę">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  );
                })}
                {config.columns.length === 0 && <li className="px-2 py-6 text-center text-sm text-slate-500">Zaznacz kolumny po lewej stronie.</li>}
              </ol>
            </section>
          </div>

          {/* opcje formatu */}
          <section className="rounded-xl border border-slate-800 bg-slate-950/40">
            <button type="button" onClick={() => setShowOptions((v) => !v)} className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm font-semibold text-slate-200">
              Format pliku
              <span className="text-xs font-normal text-slate-500">
                separator „{o.delimiter === '\t' ? 'tab' : o.delimiter}”, dziesiętny „{o.decimal}”, {o.decimals} msc., {o.bom ? 'UTF-8 z BOM' : 'UTF-8'} {showOptions ? '▲' : '▼'}
              </span>
            </button>
            {showOptions && (
              <div className="grid gap-3 border-t border-slate-800 p-4 sm:grid-cols-2 lg:grid-cols-3">
                <label className="block text-xs text-slate-400">
                  Separator kolumn
                  <select value={o.delimiter} onChange={(e) => setOption('delimiter', e.target.value as ExportOptions['delimiter'])} className={`${sel} mt-1 !w-full`}>
                    <option value=";">Średnik ; (Excel PL)</option>
                    <option value=",">Przecinek ,</option>
                    <option value={'\t'}>Tabulator</option>
                  </select>
                </label>
                <label className="block text-xs text-slate-400">
                  Separator dziesiętny
                  <select value={o.decimal} onChange={(e) => setOption('decimal', e.target.value as ExportOptions['decimal'])} className={`${sel} mt-1 !w-full`}>
                    <option value=",">Przecinek (12,50)</option>
                    <option value=".">Kropka (12.50)</option>
                  </select>
                </label>
                <label className="block text-xs text-slate-400">
                  Miejsca po przecinku (ceny, %)
                  <select value={o.decimals} onChange={(e) => setOption('decimals', Number(e.target.value) as ExportOptions['decimals'])} className={`${sel} mt-1 !w-full`}>
                    {[0, 1, 2, 3, 4].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs text-slate-400">
                  Wartości Tak/Nie
                  <select value={o.boolFormat} onChange={(e) => setOption('boolFormat', e.target.value as ExportOptions['boolFormat'])} className={`${sel} mt-1 !w-full`}>
                    <option value="tak-nie">Tak / Nie</option>
                    <option value="1-0">1 / 0</option>
                    <option value="true-false">true / false</option>
                  </select>
                </label>
                <label className="block text-xs text-slate-400">
                  Opisy
                  <select value={o.descriptionFormat} onChange={(e) => setOption('descriptionFormat', e.target.value as ExportOptions['descriptionFormat'])} className={`${sel} mt-1 !w-full`}>
                    <option value="text">Zwykły tekst (bez HTML)</option>
                    <option value="html">HTML (jak w BaseLinkerze)</option>
                  </select>
                </label>
                <label className="block text-xs text-slate-400">
                  Nagłówki
                  <select value={o.headerStyle} onChange={(e) => setOption('headerStyle', e.target.value as ExportOptions['headerStyle'])} className={`${sel} mt-1 !w-full`}>
                    <option value="labels">Czytelne (polskie nazwy)</option>
                    <option value="ids">Techniczne (sku, priceGross…)</option>
                  </select>
                </label>
                <label className="block text-xs text-slate-400 sm:col-span-2 lg:col-span-1">
                  Początek nazwy pliku
                  <input value={config.filePrefix} onChange={(e) => setConfig((c) => ({ ...c, filePrefix: e.target.value }))} className="input-field mt-1 text-sm" />
                </label>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-300 sm:col-span-2">
                  <label className="inline-flex items-center gap-2">
                    <input type="checkbox" checked={o.includeHeader} onChange={(e) => setOption('includeHeader', e.target.checked)} className="h-4 w-4 accent-brand-500" />
                    wiersz nagłówków
                  </label>
                  <label className="inline-flex items-center gap-2" title="Dodaje znacznik UTF-8, dzięki któremu Excel poprawnie wyświetla polskie znaki">
                    <input type="checkbox" checked={o.bom} onChange={(e) => setOption('bom', e.target.checked)} className="h-4 w-4 accent-brand-500" />
                    BOM UTF-8 (Excel)
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input type="checkbox" checked={o.quoteAll} onChange={(e) => setOption('quoteAll', e.target.checked)} className="h-4 w-4 accent-brand-500" />
                    wszystkie pola w cudzysłowie
                  </label>
                  <button type="button" onClick={() => setConfig((c) => ({ ...c, options: { ...DEFAULT_OPTIONS } }))} className="text-xs font-semibold text-brand-300 hover:underline">
                    przywróć domyślny format
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* podgląd */}
          <section>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Podgląd (pierwsze {previewRows.length} z {scoped.length.toLocaleString('pl-PL')} wierszy)</p>
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="min-w-full text-left text-xs">
                <thead className="bg-slate-900 text-slate-400">
                  <tr>
                    {config.columns.map((c) => (
                      <th key={c.id} className="whitespace-nowrap px-3 py-2 font-semibold">
                        {headerOf(c, o)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-200">
                  {previewRows.map((row, i) => (
                    <tr key={i}>
                      {row.map((cell, j) => (
                        <td key={j} className="max-w-[16rem] truncate whitespace-nowrap px-3 py-1.5">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {config.columns.length === 0 && (
                    <tr>
                      <td className="px-3 py-4 text-center text-slate-500">Wybierz kolumny, aby zobaczyć podgląd.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 px-5 py-3">
          <p className="text-xs text-slate-400">
            {scoped.length.toLocaleString('pl-PL')} wierszy × {config.columns.length} kolumn
            {neededDescriptions(config) && ' · pełne opisy zostaną doczytane z bazy'}
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded-xl border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800">
              Anuluj
            </button>
            <button
              type="button"
              disabled={busy !== null || config.columns.length === 0 || scoped.length === 0}
              onClick={() => void doExport()}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {busy ? `Pobieram opisy ${busy.done}/${busy.total}…` : 'Eksportuj CSV'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
