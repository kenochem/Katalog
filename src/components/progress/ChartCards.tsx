import { useEffect, useState, type ReactNode } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

/**
 * Wykresy statystyk — spokojna, systemowa estetyka: kolory systemowe, cienkie linie, duże liczby.
 * Żadnych dymków ani legend nachodzących na dane: wartości są podpisane obok lub nad elementami wykresu.
 */
export const PALETTE = {
  green: '#30d158',
  sky: '#0a84ff',
  amber: '#ff9f0a',
  violet: '#bf5af2',
  rose: '#ff453a',
  slate: '#8e8e93',
  teal: '#64d2ff',
  orange: '#ff9f0a',
};

const AXIS = { fontSize: 11, fill: '#8e8e93' } as const;
const GRID = 'rgba(142,142,147,0.18)';

const nf = (n: number) => n.toLocaleString('pl-PL');

export function ChartCard({
  title,
  subtitle,
  children,
  className = '',
  action,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}) {
  return (
    <section className={`rounded-3xl bg-slate-100/70 p-5 dark:bg-white/[0.045] sm:p-6 ${className}`}>
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold tracking-tight text-slate-950 dark:text-slate-50">{title}</h3>
          {subtitle && <p className="mt-0.5 text-[13px] leading-snug text-slate-500">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Kpi({
  label,
  value,
  sub,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  /** Zachowane dla zgodności — liczby są zawsze w kolorze tekstu. */
  tone?: string;
}) {
  return (
    <div className="rounded-3xl bg-slate-100/70 px-5 py-4 dark:bg-white/[0.045]">
      <p className="text-[13px] text-slate-500">{label}</p>
      <p className="mt-1 text-[28px] font-semibold leading-none tracking-tight tabular-nums text-slate-950 dark:text-slate-50">{value}</p>
      {sub && <p className="mt-2 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

export interface Slice {
  name: string;
  value: number;
  color: string;
}

/** Pierścień z legendą obok: nazwa, wartość i udział w osobnych wierszach (nic nie leży na wykresie). */
export function Donut({ data, center, height = 168 }: { data: Slice[]; center?: { top: string; bottom?: string }; height?: number }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
      <div className="relative shrink-0" style={{ height, width: height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="72%"
              outerRadius="100%"
              paddingAngle={data.length > 1 ? 3 : 0}
              cornerRadius={6}
              stroke="none"
              isAnimationActive
              animationDuration={700}
            >
              {data.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        {center && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-semibold tracking-tight tabular-nums text-slate-950 dark:text-slate-50">{center.top}</span>
            {center.bottom && <span className="text-[11px] text-slate-500">{center.bottom}</span>}
          </div>
        )}
      </div>
      <ul className="min-w-[10rem] flex-1 space-y-2">
        {data.map((d) => (
          <li key={d.name} className="flex items-center gap-2.5 text-[13px]">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: d.color }} />
            <span className="min-w-0 flex-1 truncate text-slate-700 dark:text-slate-300">{d.name}</span>
            <span className="font-medium tabular-nums text-slate-950 dark:text-slate-50">{nf(d.value)}</span>
            <span className="w-10 text-right tabular-nums text-slate-500">{total ? Math.round((d.value / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export interface BarDatum {
  name: string;
  value: number;
  /** Opcjonalne kolory słupków. */
  color?: string;
  /** Opis wyświetlany zamiast liczby (np. wartość w zł). */
  display?: string;
}

/** Rankingi: nazwa po lewej, cienki pasek, wartość po prawej — wszystko w jednym wierszu. */
export function HBars({
  data,
  color = PALETTE.sky,
  unit = '',
  max,
  onClick,
}: {
  data: BarDatum[];
  color?: string;
  unit?: string;
  max?: number;
  /** Zachowane dla zgodności — wysokość wynika z liczby wierszy. */
  height?: number;
  onClick?: (name: string) => void;
}) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(t);
  }, []);
  const top = max ?? Math.max(1, ...data.map((d) => d.value));
  return (
    <ul className="space-y-3">
      {data.map((d) => {
        const w = Math.max(d.value > 0 ? 2 : 0, Math.min(100, (d.value / top) * 100));
        const Row = onClick ? 'button' : 'div';
        return (
          <li key={d.name}>
            <Row
              {...(onClick ? { type: 'button' as const, onClick: () => onClick(d.name) } : {})}
              className={`block w-full text-left ${onClick ? 'group cursor-pointer' : ''}`}
            >
              <div className="flex items-baseline justify-between gap-3 text-[13px]">
                <span className={`min-w-0 truncate text-slate-700 dark:text-slate-300 ${onClick ? 'group-hover:text-slate-950 dark:group-hover:text-white' : ''}`}>{d.name}</span>
                <span className="shrink-0 font-medium tabular-nums text-slate-950 dark:text-slate-50">
                  {d.display ?? `${nf(d.value)}${unit}`}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200/80 dark:bg-white/10">
                <div
                  className="h-full rounded-full transition-[width] duration-700 ease-out"
                  style={{ width: ready ? `${w}%` : '0%', background: d.color ?? color }}
                />
              </div>
            </Row>
          </li>
        );
      })}
      {data.length === 0 && <li className="text-[13px] text-slate-500">Brak danych.</li>}
    </ul>
  );
}

/** Słupki pionowe (histogramy) z wartościami nad słupkami. */
export function Columns({
  data,
  color = PALETTE.sky,
  height = 200,
}: {
  data: BarDatum[];
  color?: string;
  height?: number;
}) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: 0, right: 0, top: 22, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="name" tick={AXIS} axisLine={false} tickLine={false} interval={0} />
          <YAxis hide domain={[0, 'dataMax']} />
          <Bar dataKey="value" radius={[8, 8, 8, 8]} maxBarSize={44} animationDuration={700}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.color ?? color} />
            ))}
            <LabelList
              dataKey="value"
              position="top"
              offset={6}
              formatter={(v: number) => (v > 0 ? nf(v) : '')}
              style={{ fontSize: 11, fill: '#8e8e93', fontVariantNumeric: 'tabular-nums' }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export interface SeriesPoint {
  label: string;
  [series: string]: number | string;
}

/** Trend w czasie: wartości wskazanego dnia pokazuje wiersz nad wykresem, nie dymek na danych. */
export function Trend({
  data,
  series,
  height = 220,
}: {
  data: SeriesPoint[];
  series: { key: string; name: string; color: string }[];
  height?: number;
}) {
  const [active, setActive] = useState<number | null>(null);
  const point = active != null ? data[active] : null;
  const sum = (key: string) => data.reduce((s, p) => s + (Number(p[key]) || 0), 0);
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end gap-x-8 gap-y-2">
        {series.map((s) => (
          <div key={s.key}>
            <p className="flex items-center gap-1.5 text-[13px] text-slate-500">
              <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
              {s.name}
            </p>
            <p className="text-2xl font-semibold leading-tight tracking-tight tabular-nums text-slate-950 dark:text-slate-50">
              {nf(point ? Number(point[s.key]) || 0 : sum(s.key))}
            </p>
          </div>
        ))}
        <p className="pb-1 text-[13px] text-slate-500">{point ? point.label : 'suma w okresie'}</p>
      </div>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ left: 0, right: 4, top: 6, bottom: 0 }}
            onMouseMove={(s) => setActive(typeof s?.activeTooltipIndex === 'number' ? s.activeTooltipIndex : null)}
            onMouseLeave={() => setActive(null)}
          >
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={28} />
            <YAxis tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} width={30} />
            <Tooltip content={() => null} cursor={{ stroke: '#8e8e93', strokeWidth: 1, strokeDasharray: '3 3' }} />
            {series.map((s) => (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.name}
                stroke={s.color}
                strokeWidth={2.25}
                fill={s.color}
                fillOpacity={0.1}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
                animationDuration={800}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** Pasek o stałej wysokości — do tabel (kompletność, zdjęcia, EAN). */
export function MiniMeter({ value }: { value: number }) {
  const color = value < 40 ? PALETTE.rose : value < 70 ? PALETTE.amber : PALETTE.green;
  return (
    <span className="inline-flex items-center justify-end gap-2">
      <span className="h-1 w-14 overflow-hidden rounded-full bg-slate-200/80 dark:bg-white/10">
        <span className="block h-full rounded-full" style={{ width: `${Math.min(100, value)}%`, background: color }} />
      </span>
      <span className="w-9 text-right text-xs tabular-nums text-slate-600 dark:text-slate-300">{value}%</span>
    </span>
  );
}

