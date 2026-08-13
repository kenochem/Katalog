import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ContextHelp } from '../ContextHelp';
import { formatPricePln } from '../../lib/format';
import type { EnrichedSalesMetrics } from '../../lib/waproSalesInsights';
import {
  aggregateByDimension,
  aggregateMonthlyTrend,
  formatChangePct,
  formatMonthLabel,
} from '../../lib/waproSalesInsights';

function formatQty(qty: number): string {
  if (!Number.isFinite(qty)) return '—';
  if (Math.abs(qty - Math.round(qty)) < 0.001) return String(Math.round(qty));
  return qty.toLocaleString('pl-PL', { maximumFractionDigits: 2 });
}

type AbcFilter = 'all' | 'A' | 'B' | 'C';
type XyzFilter = 'all' | 'X' | 'Y' | 'Z';

export function OpsProductSalesInsights({
  rows,
  showPrices,
  periodMonths,
  chartMetric,
  skuBasketCount,
  abcFilter,
  xyzFilter,
  onAbcFilterChange,
  onXyzFilterChange,
}: {
  rows: EnrichedSalesMetrics[];
  showPrices: boolean;
  periodMonths: number;
  chartMetric: 'qty' | 'netValue';
  skuBasketCount: number;
  abcFilter: AbcFilter;
  xyzFilter: XyzFilter;
  onAbcFilterChange: (f: AbcFilter) => void;
  onXyzFilterChange: (f: XyzFilter) => void;
}) {
  const [dimension, setDimension] = useState<'category' | 'manufacturer'>('category');

  const hasMonthly = rows.some((r) => r.hasMonthly);

  const trendData = useMemo(
    () => aggregateMonthlyTrend(rows, chartMetric),
    [rows, chartMetric],
  );

  const dimensionRows = useMemo(
    () => aggregateByDimension(rows, dimension).slice(0, 15),
    [rows, dimension],
  );

  const periodCompare = useMemo(() => {
    if (periodMonths !== 12) return null;
    let qtyCur = 0;
    let qtyPrev = 0;
    let netCur = 0;
    let netPrev = 0;
    for (const row of rows) {
      qtyCur += row.qty;
      qtyPrev += row.qtyPrev12m;
      netCur += row.netValue ?? 0;
      netPrev += row.netPrev12m ?? 0;
    }
    return { qtyCur, qtyPrev, netCur, netPrev };
  }, [rows, periodMonths]);

  const abcCounts = useMemo(() => {
    const c = { A: 0, B: 0, C: 0 };
    for (const row of rows) c[row.abcClass] += 1;
    return c;
  }, [rows]);

  const xyzCounts = useMemo(() => {
    const c = { X: 0, Y: 0, Z: 0, other: 0 };
    for (const row of rows) {
      if (row.xyzClass === 'X') c.X += 1;
      else if (row.xyzClass === 'Y') c.Y += 1;
      else if (row.xyzClass === 'Z') c.Z += 1;
      else c.other += 1;
    }
    return c;
  }, [rows]);

  const dimChartData = dimensionRows.map((d) => ({
    label: d.label.length > 28 ? `${d.label.slice(0, 26)}…` : d.label,
    fullLabel: d.label,
    value: chartMetric === 'qty' ? d.qty : d.netValue,
    qty: d.qty,
    net: d.netValue,
  }));

  return (
    <div className="space-y-4">
      {!hasMonthly ? (
        <div className="ops-sales-alert-warn rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
          Trend miesięczny i porównanie rok do roku wymagają rozszerzonego sync Mag (schema v2).
          Uruchom <strong>Odśwież z Mag</strong> po aktualizacji skryptu na serwerze.
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-slate-100">
              Trend miesięczny
              {skuBasketCount ? ` · koszyk ${skuBasketCount} SKU` : ''}
            </p>
            <ContextHelp id="opsProductSalesTrend" />
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Suma {chartMetric === 'qty' ? 'sztuk' : 'netto'} z aktualnych filtrów · 12 mies. kalendarzowych
          </p>
          {trendData.length > 0 ? (
            <div className="ops-sales-chart mt-3 h-64">
              <ResponsiveContainer width="100%" height={256}>
                <LineChart data={trendData} margin={{ left: 4, right: 12, top: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" vertical={false} />
                  <XAxis
                    dataKey="label"
                    stroke="#334155"
                    fontSize={10}
                    tick={{ fill: '#334155', fontWeight: 600 }}
                  />
                  <YAxis
                    stroke="#334155"
                    fontSize={10}
                    tick={{ fill: '#334155' }}
                    tickFormatter={(v) =>
                      chartMetric === 'qty' ? String(v) : `${Math.round(v / 1000)}k`
                    }
                  />
                  <Tooltip
                    formatter={(v: number) =>
                      chartMetric === 'qty' ? `${formatQty(v)} szt.` : formatPricePln(v)
                    }
                    labelFormatter={(_, payload) => {
                      const p = payload?.[0]?.payload as { month?: string } | undefined;
                      return p?.month ? formatMonthLabel(p.month) : '';
                    }}
                    contentStyle={{
                      background: '#fff',
                      border: '1px solid #cbd5e1',
                      borderRadius: 12,
                      color: '#0f172a',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke={chartMetric === 'qty' ? '#6366f1' : '#10b981'}
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: chartMetric === 'qty' ? '#6366f1' : '#10b981' }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-800 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-300">
              <p className="font-semibold text-slate-900 dark:text-slate-100">
                {hasMonthly ? 'Brak sprzedaży w wybranym widoku' : 'Brak danych miesięcznych w cache'}
              </p>
              {hasMonthly ? (
                <ol className="list-decimal space-y-1.5 pl-5 text-slate-700 dark:text-slate-400">
                  <li>Sprawdź filtry — preset „Tylko ze sprzedażą” może ukrywać pozycje koszyka.</li>
                  <li>Upewnij się, że SKU w koszyku miały ruch w ostatnich 12 miesiącach kalendarzowych.</li>
                  <li>Przełącz metrykę wykresu powyżej (Sztuki / Suma netto) — linia sumuje te same filtry co tabela.</li>
                </ol>
              ) : (
                <>
                  <p className="text-slate-700 dark:text-slate-400">
                    Koszyk i filtry działają na tabeli i wykresie Top 10, ale <strong>trend miesięczny</strong>{' '}
                    potrzebuje rozszerzonego sync Mag (12 miesięcy w JSON, schema v2). Stary cache ma tylko sumy
                    1/3/6/12 m — bez podziału na miesiące.
                  </p>
                  <ol className="list-decimal space-y-1.5 pl-5 text-slate-700 dark:text-slate-400">
                    <li>
                      Na serwerze Mag skopiuj repo{' '}
                      <code className="text-xs">scripts/sync-wapro-stock-server.ps1</code> →{' '}
                      <code className="text-xs">C:\katalog-sync\sync-wapro-stock-server.ps1</code> (ten sam plik co
                      stany — nie inny skrypt).
                    </li>
                    <li>
                      Uruchom sync sprzedaży:{' '}
                      <code className="text-xs">powershell -ExecutionPolicy Bypass -File C:\katalog-sync\sync-wapro-stock-server.ps1 -SalesSyncOnly</code>{' '}
                      (sam sync stanów co 2 min <strong>nie</strong> wypełnia monthly).
                    </li>
                    <li>Po sync: rozwiń tę sekcję, dodaj SKU do koszyka (opcjonalnie) — linia pokaże sumę tych produktów
                      miesiąc po miesiącu.</li>
                  </ol>
                </>
              )}
              <p className="text-xs text-slate-600 dark:text-slate-500">
                <strong>Jak czytać po sync:</strong> bez koszyka = suma wszystkich produktów po filtrach; z koszykiem
                = tylko wybrane SKU (np. 5 sztuk tej samej linii). Metryka: przyciski „Sztuki” / „Suma netto” nad
                wykresem Top 10.
              </p>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-slate-100">Porównanie okresów</p>
            <ContextHelp id="opsProductSalesYoY" />
          </div>
          {periodCompare ? (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <CompareCard
                label="Szt. · ostatnie 12 m"
                current={formatQty(periodCompare.qtyCur)}
                previous={formatQty(periodCompare.qtyPrev)}
                change={formatChangePct(
                  periodCompare.qtyPrev !== 0
                    ? ((periodCompare.qtyCur - periodCompare.qtyPrev) /
                        Math.abs(periodCompare.qtyPrev)) *
                        100
                    : null,
                )}
              />
              {showPrices ? (
                <CompareCard
                  label="Netto · ostatnie 12 m"
                  current={formatPricePln(periodCompare.netCur)}
                  previous={formatPricePln(periodCompare.netPrev)}
                  change={formatChangePct(
                    periodCompare.netPrev !== 0
                      ? ((periodCompare.netCur - periodCompare.netPrev) /
                          Math.abs(periodCompare.netPrev)) *
                          100
                      : null,
                  )}
                />
              ) : null}
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">
              Ustaw okres analizy na <strong>12 miesięcy</strong>, aby porównać z poprzednimi 12 m.
            </p>
          )}
        </section>
      </div>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-slate-100">Ranking {dimension === 'category' ? 'kategorii' : 'producentów'}</p>
            <ContextHelp id="opsProductSalesDimension" />
          </div>
          <div className="flex gap-1">
            <FilterChip active={dimension === 'category'} onClick={() => setDimension('category')} label="Kategorie" />
            <FilterChip active={dimension === 'manufacturer'} onClick={() => setDimension('manufacturer')} label="Producenci" />
          </div>
        </div>
        {dimChartData.length > 0 ? (
          <div className="ops-sales-chart mt-3 h-72">
            <ResponsiveContainer width="100%" height={288}>
              <BarChart data={dimChartData} layout="vertical" margin={{ left: 4, right: 16, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" horizontal={false} />
                <XAxis
                  type="number"
                  stroke="#334155"
                  fontSize={10}
                  tick={{ fill: '#334155' }}
                  tickFormatter={(v) =>
                    chartMetric === 'qty' ? String(v) : `${Math.round(v / 1000)}k`
                  }
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={120}
                  stroke="#334155"
                  fontSize={10}
                  tick={{ fill: '#334155', fontWeight: 600 }}
                />
                <Tooltip
                  formatter={(v: number) =>
                    chartMetric === 'qty' ? `${formatQty(v)} szt.` : formatPricePln(v)
                  }
                  labelFormatter={(_, payload) => {
                    const p = payload?.[0]?.payload as { fullLabel?: string } | undefined;
                    return p?.fullLabel ?? '';
                  }}
                  contentStyle={{
                    background: '#fff',
                    border: '1px solid #cbd5e1',
                    borderRadius: 12,
                    color: '#0f172a',
                  }}
                />
                <Bar
                  dataKey="value"
                  fill={chartMetric === 'qty' ? '#6366f1' : '#10b981'}
                  radius={[0, 4, 4, 0]}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="mt-6 text-center text-sm text-slate-500">Brak danych do agregacji.</p>
        )}
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-slate-100">ABC / XYZ</p>
          <ContextHelp id="opsProductSalesAbcXyz" />
        </div>
        <p className="mt-1 text-xs text-slate-500">
          ABC = udział w obrocie (A ≈ 80% sumy). XYZ = stabilność popytu miesięcznego (X stabilny, Z nieregularny).
        </p>
        <div className="mt-3 flex flex-wrap gap-4">
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Filtr ABC</p>
            <div className="flex flex-wrap gap-1">
              {(['all', 'A', 'B', 'C'] as const).map((f) => (
                <FilterChip
                  key={f}
                  active={abcFilter === f}
                  onClick={() => onAbcFilterChange(f)}
                  label={f === 'all' ? `Wszystkie (${rows.length})` : `${f} (${abcCounts[f]})`}
                />
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Filtr XYZ</p>
            <div className="flex flex-wrap gap-1">
              {(['all', 'X', 'Y', 'Z'] as const).map((f) => (
                <FilterChip
                  key={f}
                  active={xyzFilter === f}
                  onClick={() => onXyzFilterChange(f)}
                  label={
                    f === 'all'
                      ? `Wszystkie (${rows.length})`
                      : `${f} (${f === 'X' ? xyzCounts.X : f === 'Y' ? xyzCounts.Y : xyzCounts.Z})`
                  }
                />
              ))}
            </div>
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Filtry ABC/XYZ stosują się do tabeli poniżej (eksport CSV też).
        </p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-400">
        <span className="font-semibold text-slate-900 dark:text-slate-300">Korelacja koszyka (FV):</span>{' '}
        wymaga osobnego sync pozycji faktur — planowane. Na razie użyj koszyka SKU do ręcznego grupowania produktów.
      </section>
    </div>
  );
}

function CompareCard({
  label,
  current,
  previous,
  change,
}: {
  label: string;
  current: string;
  previous: string;
  change: string;
}) {
  const up = change.startsWith('+');
  const down = change.startsWith('-');
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950/70">
      <p className="text-[10px] uppercase tracking-wide text-slate-600 dark:text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-100">{current}</p>
      <p className="mt-1 text-xs text-slate-600 dark:text-slate-500">Poprzednie 12 m: {previous}</p>
      <p
        className={`mt-1 text-sm font-semibold tabular-nums ${
          up ? 'text-emerald-700 dark:text-emerald-400' : down ? 'text-red-700 dark:text-red-400' : 'text-slate-500'
        }`}
      >
        Δ {change}
      </p>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
        active ? 'bg-brand-600 text-white' : 'border border-slate-300 text-slate-700 hover:text-slate-900 dark:border-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
      }`}
    >
      {label}
    </button>
  );
}

export type { AbcFilter, XyzFilter };
