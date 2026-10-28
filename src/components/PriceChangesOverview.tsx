import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowDown, ArrowUp, Download, Loader2, Search, Settings2 } from 'lucide-react';
import type { Product } from '../types';
import { formatPricePln } from '../lib/format';
import { downloadCsvFile, exportFileName } from '../lib/csvExport';
import {
  PRICE_ALERT_LABEL,
  buildPriceMoves,
  fetchPriceChangesSince,
  loadMonitorSettings,
  priceMovesToCsv,
  saveMonitorSettings,
  type FieldMove,
  type PriceAlertKind,
  type PriceMonitorSettings,
  type PriceMoveRow,
} from '../lib/priceMonitor';
import type { ProductSyncChange } from '../lib/productSyncChanges';

const PERIODS = [
  { days: 1, label: '24 h' },
  { days: 7, label: '7 dni' },
  { days: 30, label: '30 dni' },
  { days: 90, label: 'Wszystko' },
];

const ALERT_TONE: Record<PriceAlertKind, string> = {
  belowCost: 'bg-rose-500/15 text-rose-600 dark:text-rose-300',
  lowMargin: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  buyUpSaleFlat: 'bg-orange-500/15 text-orange-700 dark:text-orange-300',
  jump: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
};

function Move({ m }: { m?: FieldMove }) {
  if (!m) return <span className="text-slate-400">—</span>;
  const up = m.to > m.from;
  return (
    <div className="text-right tabular-nums">
      <div className="text-xs text-slate-500">
        {formatPricePln(m.from)} → <span className="font-medium text-slate-900 dark:text-slate-100">{formatPricePln(m.to)}</span>
      </div>
      {m.pct != null && (
        <div className={`inline-flex items-center gap-0.5 text-xs font-semibold ${up ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
          {up ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
          {up ? '+' : ''}
          {m.pct.toFixed(1)}%
        </div>
      )}
    </div>
  );
}

const pct1 = (v?: number) => (v === undefined ? '—' : `${v.toFixed(1)}%`);

/** Zbiorczy widok zmian cen: co zdrożało lub staniało, gdzie spadła marża. */
export function PriceChangesOverview({ products, onPick }: { products: Product[]; onPick: (p: Product) => void }) {
  const [days, setDays] = useState(7);
  const [changes, setChanges] = useState<ProductSyncChange[] | null>(null);
  const [settings, setSettings] = useState<PriceMonitorSettings>(loadMonitorSettings);
  const [showSettings, setShowSettings] = useState(false);
  const [dir, setDir] = useState<'all' | 'up' | 'down'>('all');
  const [alertFilter, setAlertFilter] = useState<'all' | PriceAlertKind>('all');
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    setChanges(null);
    void fetchPriceChangesSince(days).then((d) => {
      if (!cancelled) setChanges(d);
    });
    return () => {
      cancelled = true;
    };
  }, [days]);

  const rows = useMemo(() => (changes ? buildPriceMoves(changes, products, settings) : []), [changes, products, settings]);

  const counts = useMemo(() => {
    const c: Record<PriceAlertKind, number> = { belowCost: 0, lowMargin: 0, buyUpSaleFlat: 0, jump: 0 };
    for (const r of rows) for (const a of r.alerts) c[a]++;
    return c;
  }, [rows]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (dir !== 'all' && r.direction !== dir) return false;
      if (alertFilter !== 'all' && !r.alerts.includes(alertFilter)) return false;
      if (q && !(`${r.sku} ${r.name} ${r.manufacturer}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [rows, dir, alertFilter, query]);

  const up = rows.filter((r) => r.direction === 'up').length;
  const down = rows.length - up;

  const update = (patch: Partial<PriceMonitorSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveMonitorSettings(next);
  };

  const renderRow = (r: PriceMoveRow) => (
    <tr
      key={r.sku}
      onClick={() => r.product && onPick(r.product)}
      className={`${r.product ? 'cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/60' : ''}`}
    >
      <td className="px-3 py-2">
        <p className="max-w-[16rem] truncate text-sm font-medium text-slate-900 dark:text-slate-100">{r.name}</p>
        <p className="font-mono text-[11px] text-slate-500">
          {r.sku}
          {r.manufacturer && <span className="ml-2 font-sans">{r.manufacturer}</span>}
        </p>
      </td>
      <td className="px-3 py-2"><Move m={r.buy} /></td>
      <td className="px-3 py-2"><Move m={r.saleNet} /></td>
      <td className="px-3 py-2 text-right text-xs tabular-nums text-slate-500">
        {pct1(r.marginBefore)} → <span className={`font-semibold ${r.marginNow !== undefined && r.marginNow < settings.marginMin ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-slate-100'}`}>{pct1(r.marginNow)}</span>
      </td>
      <td className="px-3 py-2">
        <div className="flex flex-wrap gap-1">
          {r.alerts.map((a) => (
            <span key={a} className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${ALERT_TONE[a]}`}>{PRICE_ALERT_LABEL[a]}</span>
          ))}
        </div>
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-right text-[11px] text-slate-500">
        {new Date(r.lastAt).toLocaleString('pl-PL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
      </td>
    </tr>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-xl border border-slate-300 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-900">
          {PERIODS.map((p) => (
            <button
              key={p.days}
              type="button"
              onClick={() => setDays(p.days)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${days === p.days ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setShowSettings((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <Settings2 className="h-3.5 w-3.5" /> Progi alertów
        </button>
        <button
          type="button"
          disabled={visible.length === 0}
          onClick={() => downloadCsvFile(priceMovesToCsv(visible), exportFileName('zmiany_cen'), true)}
          className="ml-auto inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <Download className="h-3.5 w-3.5" /> Eksport CSV ({visible.length})
        </button>
      </div>

      {showSettings && (
        <div className="flex flex-wrap items-end gap-4 rounded-xl border border-slate-200 bg-white p-3 text-xs dark:border-slate-800 dark:bg-slate-900/60">
          <label className="space-y-1">
            <span className="block font-semibold text-slate-600 dark:text-slate-300">Minimalna marża (%)</span>
            <input
              type="number"
              min={0}
              max={99}
              value={settings.marginMin}
              onChange={(e) => update({ marginMin: Math.max(0, Number(e.target.value) || 0) })}
              className="input-field w-24 text-sm"
            />
          </label>
          <label className="space-y-1">
            <span className="block font-semibold text-slate-600 dark:text-slate-300">Skok ceny od (%)</span>
            <input
              type="number"
              min={1}
              max={500}
              value={settings.jumpPct}
              onChange={(e) => update({ jumpPct: Math.max(1, Number(e.target.value) || 1) })}
              className="input-field w-24 text-sm"
            />
          </label>
          <p className="max-w-sm text-slate-500">Marża = (sprzedaż netto − zakup netto) / sprzedaż netto. Progi zapisują się w tej przeglądarce.</p>
        </div>
      )}

      {changes === null ? (
        <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" /> Wczytuję zmiany cen…
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <button type="button" onClick={() => { setDir('all'); setAlertFilter('all'); }} className="rounded-xl border border-slate-200 bg-white p-3 text-left dark:border-slate-800 dark:bg-slate-900/60">
              <p className="text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-50">{rows.length}</p>
              <p className="text-xs text-slate-500">produktów ze zmianą ceny</p>
            </button>
            <button type="button" onClick={() => setDir('up')} className="rounded-xl border border-slate-200 bg-white p-3 text-left dark:border-slate-800 dark:bg-slate-900/60">
              <p className="text-2xl font-bold tabular-nums text-rose-600 dark:text-rose-400">{up}</p>
              <p className="text-xs text-slate-500">podwyżki</p>
            </button>
            <button type="button" onClick={() => setDir('down')} className="rounded-xl border border-slate-200 bg-white p-3 text-left dark:border-slate-800 dark:bg-slate-900/60">
              <p className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{down}</p>
              <p className="text-xs text-slate-500">obniżki</p>
            </button>
            <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900/60">
              <p className="text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-400">{rows.filter((r) => r.alerts.length).length}</p>
              <p className="text-xs text-slate-500">z alertem</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            {(Object.keys(PRICE_ALERT_LABEL) as PriceAlertKind[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setAlertFilter(alertFilter === k ? 'all' : k)}
                className={`rounded-full border px-3 py-1 text-xs font-medium ${alertFilter === k ? 'border-brand-500 bg-brand-600/10 text-brand-700 dark:text-brand-300' : 'border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300'}`}
              >
                {PRICE_ALERT_LABEL[k]} <span className="tabular-nums opacity-70">{counts[k]}</span>
              </button>
            ))}
            <div className="relative ml-auto min-w-[12rem]">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filtruj: SKU, nazwa, producent…"
                className="w-full rounded-xl border border-slate-300 bg-white py-1.5 pl-8 pr-3 text-xs dark:border-slate-700 dark:bg-slate-900"
              />
            </div>
          </div>

          {visible.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-500">
              {rows.length === 0 ? 'W tym okresie nie zarejestrowano zmian cen.' : 'Brak wyników dla wybranych filtrów.'}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full min-w-[56rem] text-left">
                <thead className="bg-slate-100 text-[11px] uppercase tracking-wider text-slate-600 dark:bg-slate-950 dark:text-slate-400">
                  <tr>
                    <th className="px-3 py-2">Produkt</th>
                    <th className="px-3 py-2 text-right">Zakup netto</th>
                    <th className="px-3 py-2 text-right">Sprzedaż netto</th>
                    <th className="px-3 py-2 text-right">Marża</th>
                    <th className="px-3 py-2">Alerty</th>
                    <th className="px-3 py-2 text-right">Kiedy</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-900/30">
                  {visible.slice(0, 300).map(renderRow)}
                </tbody>
              </table>
              {visible.length > 300 && (
                <p className="border-t border-slate-200 px-3 py-2 text-center text-xs text-slate-500 dark:border-slate-800">
                  Pokazano 300 z {visible.length} — zawęź filtry lub wyeksportuj CSV, żeby zobaczyć całość.
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
