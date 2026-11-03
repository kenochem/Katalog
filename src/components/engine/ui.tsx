import { ChevronDown, Search, SlidersHorizontal, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';

/** Wspólne klasy i klocki widoku silnika — jeden wygląd dla wszystkich zakładek. */
export const card = 'rounded-3xl border border-black/10 bg-white/80 p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.045]';
export const inner = 'rounded-2xl bg-black/[0.04] dark:bg-white/[0.06]';
export const btn =
  'inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800';
export const btnPrimary = 'inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-500 disabled:opacity-50';
export const field = 'min-w-0 rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900';
export const chip = (active: boolean) =>
  `rounded-full px-3 py-1.5 text-sm font-semibold transition ${active ? 'bg-brand-600 text-white' : 'bg-black/[0.06] text-slate-700 hover:bg-black/10 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/15'}`;

export const toneBox = {
  ok: 'border-emerald-500/30 bg-emerald-500/10',
  info: 'border-sky-500/30 bg-sky-500/10',
  warn: 'border-amber-500/30 bg-amber-500/10',
  bad: 'border-rose-500/30 bg-rose-500/10',
} as const;
export const toneText = {
  ok: 'text-emerald-600 dark:text-emerald-400',
  info: 'text-sky-600 dark:text-sky-400',
  warn: 'text-amber-600 dark:text-amber-400',
  bad: 'text-rose-600 dark:text-rose-400',
} as const;

/** Nagłówek sekcji: tytuł, jedno zdanie opisu i miejsce na akcje po prawej. */
export function SectionHead({ title, hint, actions }: { title: string; hint?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 className="text-[15px] font-semibold text-slate-950 dark:text-slate-50">{title}</h3>
        {hint && <p className="mt-0.5 max-w-3xl text-[13px] text-slate-500">{hint}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** Kafelek z liczbą. */
export function Stat({ label, value, tone, hint }: { label: string; value: ReactNode; tone?: keyof typeof toneText; hint?: string }) {
  return (
    <div className={`${inner} p-3`} title={hint}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-0.5 text-xl font-semibold tabular-nums text-slate-900 dark:text-slate-50 ${tone ? toneText[tone] : ''}`}>{value}</p>
    </div>
  );
}

/** Poziomy pasek postępu 0–100. */
export function Bar({ value, className = '' }: { value: number | null; className?: string }) {
  const v = value ?? 0;
  const color = value == null ? 'bg-black/20 dark:bg-white/20' : v >= 90 ? 'bg-emerald-500' : v >= 70 ? 'bg-sky-500' : v >= 45 ? 'bg-amber-500' : 'bg-rose-500';
  return (
    <div className={`h-1.5 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10 ${className}`}>
      <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${v}%` }} />
    </div>
  );
}

/** Pierścień z wynikiem. */
export function ScoreRing({ value, size = 112 }: { value: number | null; size?: number }) {
  const r = 44;
  const c = 2 * Math.PI * r;
  const v = value ?? 0;
  const stroke = value == null ? 'stroke-black/20 dark:stroke-white/20' : v >= 90 ? 'stroke-emerald-500' : v >= 70 ? 'stroke-sky-500' : v >= 45 ? 'stroke-amber-500' : 'stroke-rose-500';
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" strokeWidth="9" className="stroke-black/10 dark:stroke-white/10" />
        <circle cx="50" cy="50" r={r} fill="none" strokeWidth="9" strokeLinecap="round" className={`${stroke} transition-all duration-700`} strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold tabular-nums text-slate-950 dark:text-slate-50">{value == null ? '—' : value}</span>
        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">gotowość</span>
      </div>
    </div>
  );
}

/** Zakładki wewnątrz narzędzia: jedna linia z podkreśleniem zamiast stosu kart. */
export function SubTabs<T extends string>({ items, value, onChange }: { items: { id: T; label: string; count?: number | null }[]; value: T; onChange: (id: T) => void }) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-black/10 dark:border-white/10" role="tablist">
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          role="tab"
          aria-selected={value === it.id}
          onClick={() => onChange(it.id)}
          className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-3.5 py-2 text-sm font-semibold transition ${value === it.id ? 'border-brand-600 text-slate-950 dark:text-slate-50' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
        >
          {it.label}
          {it.count != null && it.count > 0 && (
            <span className={`rounded-full px-1.5 py-0.5 text-[11px] leading-none tabular-nums ${value === it.id ? 'bg-brand-600 text-white' : 'bg-black/[0.07] text-slate-600 dark:bg-white/10 dark:text-slate-300'}`}>{it.count.toLocaleString('pl-PL')}</span>
          )}
        </button>
      ))}
    </div>
  );
}

/** Sekcja, którą można zwinąć — objaśnienia i rzadko używane narzędzia nie zasłaniają roboczej listy. */
export function Disclosure({ title, summary, defaultOpen = false, children }: { title: string; summary?: ReactNode; defaultOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={`${card} !p-0`}>
      <button type="button" className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className="min-w-0">
          <span className="text-[15px] font-semibold text-slate-950 dark:text-slate-50">{title}</span>
          {summary && <span className="ml-3 text-[13px] text-slate-500">{summary}</span>}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="border-t border-black/10 px-5 pb-5 pt-4 dark:border-white/10">{children}</div>}
    </section>
  );
}

/** Pole wyszukiwania z ikoną i przyciskiem czyszczenia. */
export function SearchBox({ value, onChange, placeholder, className = '' }: { value: string; onChange: (v: string) => void; placeholder: string; className?: string }) {
  return (
    <div className={`relative min-w-[12rem] ${className}`}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={`${field} w-full py-2 pl-9 pr-8`} />
      {value && (
        <button type="button" aria-label="Wyczyść" className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700" onClick={() => onChange('')}>
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

/**
 * Pasek narzędzi listy: wyszukiwanie + główny przełącznik (`primary`) po lewej, akcje po prawej,
 * a filtry dodatkowe (`extra`) schowane pod przyciskiem „Filtry” ze znacznikiem, ile jest aktywnych.
 */
export function FilterBar({
  query,
  onQuery,
  placeholder,
  primary,
  extra,
  activeFilters = 0,
  onReset,
  actions,
}: {
  query: string;
  onQuery: (v: string) => void;
  placeholder: string;
  primary?: ReactNode;
  extra?: ReactNode;
  activeFilters?: number;
  onReset?: () => void;
  actions?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <SearchBox value={query} onChange={onQuery} placeholder={placeholder} className="w-full sm:w-72" />
        {primary}
        {extra && (
          <button type="button" className={btn} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
            <SlidersHorizontal className="h-4 w-4" /> Filtry
            {activeFilters > 0 && <span className="rounded-full bg-brand-600 px-1.5 py-0.5 text-[11px] leading-none text-white">{activeFilters}</span>}
          </button>
        )}
        {activeFilters > 0 && onReset && (
          <button type="button" className="text-sm font-semibold text-slate-500 underline hover:text-slate-800 dark:hover:text-slate-200" onClick={onReset}>
            Wyczyść filtry
          </button>
        )}
        {actions && <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {open && extra && <div className={`${inner} flex flex-wrap items-end gap-3 p-3`}>{extra}</div>}
    </div>
  );
}

/** Podpisane pole filtra do panelu „Filtry”. */
export function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex min-w-[10rem] flex-col gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
      {label}
      {children}
    </label>
  );
}

/** Znaczek statusu w wierszu listy. */
export function Pill({ tone = 'info', children }: { tone?: keyof typeof toneText | 'neutral'; children: ReactNode }) {
  const cls = tone === 'neutral' ? 'bg-black/[0.07] text-slate-600 dark:bg-white/10 dark:text-slate-300' : `${toneBox[tone]} ${toneText[tone]} border`;
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>{children}</span>;
}
