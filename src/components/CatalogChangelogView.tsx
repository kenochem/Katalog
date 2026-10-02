import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Wrench, Sparkle, Gauge } from 'lucide-react';
import { APP_CHANGELOG, type AppChangelogEntry } from '../data/appChangelog';

const TAG_STYLE: Record<
  NonNullable<AppChangelogEntry['tag']>,
  { label: string; icon: typeof Sparkle; className: string }
> = {
  nowość: {
    label: 'Nowość',
    icon: Sparkle,
    className: 'bg-brand-500/15 text-brand-300 border-brand-500/30',
  },
  poprawka: {
    label: 'Poprawka',
    icon: Wrench,
    className: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  },
  wydajność: {
    label: 'Wydajność',
    icon: Gauge,
    className: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  },
};

function formatEntryDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });
}

interface ChangelogDay {
  date: string;
  entries: AppChangelogEntry[];
}

function groupByDay(entries: AppChangelogEntry[]): ChangelogDay[] {
  const byDate = new Map<string, AppChangelogEntry[]>();
  for (const e of entries) {
    const bucket = byDate.get(e.date);
    if (bucket) bucket.push(e);
    else byDate.set(e.date, [e]);
  }
  return Array.from(byDate.entries())
    .map(([date, es]) => ({ date, entries: es }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

// UWAGA: celowo NIE toISOString() — ta liczy w UTC, więc przy CEST (UTC+2)
// lokalna północ danego dnia wychodziła jako poprzedni dzień w ISO, przez co
// komórka "dziś" trafiała pod jutrzejszą datę i wyglądała na zablokowaną
// "przyszłość". Budujemy string ręcznie z lokalnych składowych daty.
function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const WEEKDAY_LABELS = ['pon', '', 'śr', '', 'pt', '', ''];

/** Siatka tygodni (jak wykres aktywności na GitHubie) — kolumny to tygodnie
 * (pon–niedz), komórka ciemnieje z liczbą wpisów danego dnia. */
function ActivityHeatmap({
  countByDate,
  weeks = 14,
  selected,
  onSelect,
}: {
  countByDate: Map<string, number>;
  weeks?: number;
  selected: string | null;
  onSelect: (date: string) => void;
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // Cofnij do poniedziałku bieżącego tygodnia, potem o `weeks` tygodni wstecz.
  const mondayOffset = (today.getDay() + 6) % 7;
  const gridEnd = new Date(today);
  gridEnd.setDate(today.getDate() - mondayOffset + 6);
  const gridStart = new Date(gridEnd);
  gridStart.setDate(gridEnd.getDate() - weeks * 7 + 1);

  const columns: { date: string; count: number; inFuture: boolean }[][] = [];
  const cursor = new Date(gridStart);
  for (let w = 0; w < weeks; w++) {
    const col: { date: string; count: number; inFuture: boolean }[] = [];
    for (let d = 0; d < 7; d++) {
      const iso = toIsoDate(cursor);
      col.push({ date: iso, count: countByDate.get(iso) ?? 0, inFuture: cursor > today });
      cursor.setDate(cursor.getDate() + 1);
    }
    columns.push(col);
  }

  function cellClass(count: number, inFuture: boolean, isSelected: boolean): string {
    if (inFuture) return 'bg-transparent';
    let base = 'bg-slate-800/70';
    if (count >= 6) base = 'bg-brand-400';
    else if (count >= 4) base = 'bg-brand-500';
    else if (count >= 2) base = 'bg-brand-600/80';
    else if (count >= 1) base = 'bg-brand-700/60';
    return isSelected ? `${base} ring-2 ring-offset-1 ring-offset-slate-950 ring-brand-300` : base;
  }

  return (
    <div className="overflow-x-auto">
      <div className="flex items-start gap-2">
        <div className="mt-4 flex flex-col gap-[3px] text-[9px] leading-none text-slate-600">
          {WEEKDAY_LABELS.map((label, i) => (
            <span key={i} className="h-3">
              {label}
            </span>
          ))}
        </div>
        <div className="flex gap-[3px]">
          {columns.map((col, wi) => (
            <div key={wi} className="flex flex-col gap-[3px]">
              {col.map((cell) => (
                <button
                  key={cell.date}
                  type="button"
                  disabled={cell.inFuture}
                  onClick={() => onSelect(cell.date)}
                  title={`${formatEntryDate(cell.date)} — ${cell.count} ${
                    cell.count === 1 ? 'wpis' : 'wpisów'
                  }`}
                  className={`h-3 w-3 rounded-sm transition hover:ring-1 hover:ring-brand-300 disabled:cursor-default disabled:hover:ring-0 ${cellClass(
                    cell.count,
                    cell.inFuture,
                    cell.date === selected,
                  )}`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-[10px] text-slate-600">
        <span>mniej</span>
        <span className="h-3 w-3 rounded-sm bg-slate-800/70" />
        <span className="h-3 w-3 rounded-sm bg-brand-700/60" />
        <span className="h-3 w-3 rounded-sm bg-brand-600/80" />
        <span className="h-3 w-3 rounded-sm bg-brand-500" />
        <span className="h-3 w-3 rounded-sm bg-brand-400" />
        <span>więcej</span>
      </div>
    </div>
  );
}

export function CatalogChangelogView() {
  const days = useMemo(() => groupByDay(APP_CHANGELOG), []);
  const countByDate = useMemo(() => {
    const m = new Map<string, number>();
    for (const day of days) m.set(day.date, day.entries.length);
    return m;
  }, [days]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [lastSelected, setLastSelected] = useState<string | null>(null);

  function toggle(date: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  }

  function selectFromHeatmap(date: string) {
    setLastSelected(date);
    if (!countByDate.has(date)) return;
    setExpanded((prev) => new Set(prev).add(date));
    requestAnimationFrame(() => {
      document.getElementById(`changelog-day-${date}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        Co ostatnio zmieniło się w katalogu — nowe funkcje i poprawki, pogrupowane dniami.
      </p>

      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Aktywność
        </p>
        <ActivityHeatmap
          countByDate={countByDate}
          selected={lastSelected}
          onSelect={selectFromHeatmap}
        />
      </div>

      {days.length === 0 ? (
        <div className="py-16 text-center text-slate-500">Brak wpisów.</div>
      ) : (
        <div className="space-y-2">
          {days.map((day) => {
            const isOpen = expanded.has(day.date);
            const tagCounts = new Map<string, number>();
            for (const e of day.entries) {
              if (!e.tag) continue;
              tagCounts.set(e.tag, (tagCounts.get(e.tag) ?? 0) + 1);
            }
            return (
              <div
                key={day.date}
                id={`changelog-day-${day.date}`}
                className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/40 scroll-mt-3"
              >
                <button
                  type="button"
                  onClick={() => toggle(day.date)}
                  className="catalog-log-row flex w-full items-center gap-2.5 px-4 py-3 text-left"
                >
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" />
                  )}
                  <span className="flex-1 text-sm font-semibold text-slate-100">
                    {formatEntryDate(day.date)}
                  </span>
                  <span className="shrink-0 text-xs text-slate-500">
                    {day.entries.length} {day.entries.length === 1 ? 'wpis' : 'wpisów'}
                  </span>
                  <span className="hidden shrink-0 flex-wrap items-center gap-1 sm:flex">
                    {Array.from(tagCounts.entries()).map(([tag, count]) => {
                      const info = TAG_STYLE[tag as NonNullable<AppChangelogEntry['tag']>];
                      return (
                        <span
                          key={tag}
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${info.className}`}
                        >
                          {count}× {info.label}
                        </span>
                      );
                    })}
                  </span>
                </button>

                {isOpen && (
                  <ul className="space-y-2 border-t border-slate-800 p-3 pt-2.5">
                    {day.entries.map((entry, i) => {
                      const tagInfo = entry.tag ? TAG_STYLE[entry.tag] : null;
                      const TagIcon = tagInfo?.icon;
                      return (
                        <li
                          key={`${entry.date}-${i}`}
                          className="rounded-lg border border-slate-800 bg-slate-950/40 p-3"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-semibold text-slate-100">
                              {entry.title}
                            </h3>
                            {tagInfo && TagIcon && (
                              <span
                                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${tagInfo.className}`}
                              >
                                <TagIcon className="h-3 w-3" />
                                {tagInfo.label}
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-sm text-slate-400">{entry.description}</p>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
