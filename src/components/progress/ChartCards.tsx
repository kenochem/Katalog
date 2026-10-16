import type { ReactNode } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export const PALETTE = {
  green: '#33b33b',
  sky: '#38bdf8',
  amber: '#fbbf24',
  violet: '#a78bfa',
  rose: '#fb7185',
  slate: '#64748b',
  teal: '#2dd4bf',
  orange: '#fb923c',
};

const AXIS = { fontSize: 11, fill: '#94a3b8' } as const;
const TOOLTIP_STYLE = {
  background: '#0f172a',
  border: '1px solid #334155',
  borderRadius: 12,
  fontSize: 12,
  color: '#e2e8f0',
} as const;

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
    <section className={`rounded-2xl border border-slate-800 bg-slate-900/50 p-4 ${className}`}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
          {subtitle && <p className="mt-0.5 text-[11px] text-slate-500">{subtitle}</p>}
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
  tone = 'text-slate-50',
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${tone}`}>{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-slate-500">{sub}</p>}
    </div>
  );
}

export interface Slice {
  name: string;
  value: number;
  color: string;
}

/** Wykres kołowy (pierścień) z podpisem w środku i legendą. */
export function Donut({ data, center, height = 220 }: { data: Slice[]; center?: { top: string; bottom?: string }; height?: number }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="relative" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="82%" paddingAngle={2} stroke="none">
            {data.map((d) => (
              <Cell key={d.name} fill={d.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(v, name) => [`${Number(v).toLocaleString('pl-PL')} (${total ? Math.round((Number(v) / total) * 100) : 0}%)`, name]}
          />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
        </PieChart>
      </ResponsiveContainer>
      {center && (
        <div className="pointer-events-none absolute inset-x-0 top-0 flex h-[calc(100%-28px)] flex-col items-center justify-center">
          <span className="text-2xl font-bold tabular-nums text-slate-50">{center.top}</span>
          {center.bottom && <span className="text-[11px] text-slate-500">{center.bottom}</span>}
        </div>
      )}
    </div>
  );
}

export interface BarDatum {
  name: string;
  value: number;
  /** Opcjonalne kolory słupków. */
  color?: string;
}

/** Słupki poziome (rankingi: producenci, kategorie, użytkownicy). */
export function HBars({
  data,
  color = PALETTE.green,
  unit = '',
  max,
  height,
  onClick,
}: {
  data: BarDatum[];
  color?: string;
  unit?: string;
  max?: number;
  height?: number;
  onClick?: (name: string) => void;
}) {
  const h = height ?? Math.max(120, data.length * 28 + 20);
  return (
    <div style={{ height: h }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 4, right: 16, top: 0, bottom: 0 }}>
          <CartesianGrid horizontal={false} stroke="#1e293b" />
          <XAxis type="number" tick={AXIS} domain={max ? [0, max] : undefined} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="name" tick={AXIS} width={118} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(148,163,184,0.08)' }} formatter={(v) => [`${Number(v).toLocaleString('pl-PL')}${unit}`, '']} />
          <Bar dataKey="value" radius={[0, 6, 6, 0]} onClick={onClick ? (d) => onClick(String((d as { name?: string }).name ?? '')) : undefined} cursor={onClick ? 'pointer' : undefined}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.color ?? color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Słupki pionowe (histogramy). */
export function Columns({
  data,
  color = PALETTE.sky,
  height = 220,
}: {
  data: BarDatum[];
  color?: string;
  height?: number;
}) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: -12, right: 8, top: 8, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#1e293b" />
          <XAxis dataKey="name" tick={AXIS} axisLine={false} tickLine={false} />
          <YAxis tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
          <Bar dataKey="value" radius={[6, 6, 0, 0]}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.color ?? color} />
            ))}
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

/** Wykres liniowo-powierzchniowy (trendy w czasie) z wieloma seriami. */
export function Trend({
  data,
  series,
  height = 240,
}: {
  data: SeriesPoint[];
  series: { key: string; name: string; color: string }[];
  height?: number;
}) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ left: -12, right: 8, top: 8, bottom: 0 }}>
          <defs>
            {series.map((s) => (
              <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={s.color} stopOpacity={0.45} />
                <stop offset="95%" stopColor={s.color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid vertical={false} stroke="#1e293b" />
          <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={24} />
          <YAxis tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
          {series.map((s) => (
            <Area key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={2} fill={`url(#grad-${s.key})`} />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
