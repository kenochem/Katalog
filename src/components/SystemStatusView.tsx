import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Info,
  Loader2,
  RefreshCw,
  Search,
  XCircle,
} from 'lucide-react';
import {
  SOURCE_LABEL,
  buildStatusCards,
  fetchSystemData,
  formatAgo,
  type CardTone,
  type SysEvent,
  type SysLevel,
  type SysSource,
  type SystemData,
} from '../lib/systemStatus';

const PAGE = 80;
const REFRESH_MS = 60_000;

const TONE_STYLE: Record<CardTone, { ring: string; pill: string; label: string; dot: string }> = {
  ok: { ring: 'border-emerald-500/30', pill: 'bg-emerald-500/15 text-emerald-300', label: 'Działa', dot: 'bg-emerald-400' },
  warn: { ring: 'border-amber-500/50', pill: 'bg-amber-500/20 text-amber-200', label: 'Uwaga', dot: 'bg-amber-400' },
  down: { ring: 'border-red-500/60', pill: 'bg-red-600 text-white', label: 'Problem', dot: 'bg-red-500' },
  unknown: { ring: 'border-slate-700', pill: 'bg-slate-700 text-slate-200', label: 'Brak danych', dot: 'bg-slate-500' },
};

const LEVEL_STYLE: Record<SysLevel, { icon: typeof Info; cls: string; label: string }> = {
  info: { icon: Info, cls: 'text-sky-300', label: 'Info' },
  success: { icon: CheckCircle2, cls: 'text-emerald-400', label: 'OK' },
  warning: { icon: AlertTriangle, cls: 'text-amber-300', label: 'Uwaga' },
  error: { icon: XCircle, cls: 'text-red-400', label: 'Błąd' },
};

const SOURCE_BADGE: Record<SysSource, string> = {
  stock: 'bg-brand-500/15 text-brand-300',
  sales: 'bg-violet-500/15 text-violet-300',
  orders: 'bg-sky-500/15 text-sky-300',
  reserved: 'bg-amber-500/15 text-amber-300',
  baselinker: 'bg-blue-600/20 text-blue-300',
  promotions: 'bg-red-500/15 text-red-300',
  system: 'bg-slate-700 text-slate-300',
};

const RANGES = [
  { id: 1, label: 'Ostatnie 24 h' },
  { id: 3, label: '3 dni' },
  { id: 7, label: '7 dni' },
  { id: 30, label: '30 dni' },
] as const;

function exactTime(iso: string): string {
  return new Date(iso).toLocaleString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/** Status systemów (karty) + wspólny strumień zdarzeń z serwera. */
export function SystemStatusView() {
  const [days, setDays] = useState<number>(3);
  const [data, setData] = useState<SystemData | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [source, setSource] = useState<SysSource | 'all'>('all');
  const [onlyProblems, setOnlyProblems] = useState(false);
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const [openId, setOpenId] = useState<string | null>(null);
  const [, setTick] = useState(0);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        setData(await fetchSystemData(days));
        setUpdatedAt(new Date());
      } finally {
        setLoading(false);
      }
    },
    [days],
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  // automatyczne odświeżanie + przeliczanie „x min temu”
  useEffect(() => {
    const t = setInterval(() => void load(true), REFRESH_MS);
    const tick = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => {
      clearInterval(t);
      clearInterval(tick);
    };
  }, [load]);

  const cards = useMemo(() => (data ? buildStatusCards(data) : []), [data]);
  const problems = cards.filter((c) => c.tone === 'down' || c.tone === 'warn');

  const counts = useMemo(() => {
    const m = new Map<SysSource, number>();
    for (const e of data?.events ?? []) m.set(e.source, (m.get(e.source) ?? 0) + 1);
    return m;
  }, [data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.events ?? []).filter((e) => {
      if (source !== 'all' && e.source !== source) return false;
      if (onlyProblems && e.level !== 'error' && e.level !== 'warning') return false;
      if (q && !`${e.title} ${e.message} ${SOURCE_LABEL[e.source]}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data, source, onlyProblems, search]);

  const visible = filtered.slice(0, limit);

  return (
    <section className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-50">Status systemów</h2>
          <p className="mt-1 text-sm text-slate-400">
            Co działa, co nie i co się właśnie wydarzyło — także w automatycznych przebiegach na serwerze WAPRO.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {updatedAt && (
            <span className="text-xs text-slate-500">
              Aktualizacja: {updatedAt.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })} (co minutę)
            </span>
          )}
          <button
            type="button"
            onClick={() => void load(false)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Odśwież
          </button>
        </div>
      </div>

      {data?.notes.map((n) => (
        <p key={n} className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          {n}
        </p>
      ))}

      {/* podsumowanie problemów */}
      {data && (
        <div
          className={`rounded-2xl border px-4 py-3 ${
            problems.length ? 'border-red-500/50 bg-red-500/10' : 'border-emerald-500/30 bg-emerald-500/10'
          }`}
        >
          {problems.length === 0 ? (
            <p className="flex items-center gap-2 text-sm font-semibold text-emerald-300">
              <CheckCircle2 className="h-5 w-5" />
              Wszystko działa — brak alarmów.
            </p>
          ) : (
            <div>
              <p className="flex items-center gap-2 text-sm font-bold text-red-200">
                <AlertTriangle className="h-5 w-5" />
                Wymaga uwagi ({problems.length})
              </p>
              <ul className="mt-1.5 space-y-0.5 text-sm text-slate-200">
                {problems.map((c) => (
                  <li key={c.id}>
                    <b>{c.label}:</b> {c.headline}
                    {c.lastAt ? ` (ostatnio ${formatAgo(c.lastAt)})` : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* karty */}
      {loading && !data ? (
        <div className="flex justify-center py-12 text-slate-500">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((c) => {
            const t = TONE_STYLE[c.tone];
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  const id = c.id === 'reserved' ? 'reserved' : (c.id as SysSource);
                  setSource(source === id ? 'all' : id);
                  setLimit(PAGE);
                }}
                className={`rounded-2xl border bg-slate-900/70 p-4 text-left transition hover:bg-slate-900 ${t.ring} ${
                  source === c.id ? 'ring-2 ring-brand-500/60' : ''
                }`}
                title="Kliknij, żeby filtrować strumień zdarzeń"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                      <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${t.dot}`} />
                      <span className="truncate">{c.label}</span>
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500">{c.hint}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${t.pill}`}>{t.label}</span>
                </div>
                <p className="mt-3 text-sm font-medium text-slate-200">
                  {c.tone === 'unknown' && <CircleHelp className="mr-1 inline h-4 w-4 text-slate-400" />}
                  {c.headline}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Ostatnio: <b className="text-slate-200">{formatAgo(c.lastAt)}</b>
                </p>
                {c.lastMessage && <p className="mt-1 line-clamp-2 text-xs text-slate-500">{c.lastMessage}</p>}
                <p className="mt-2 text-[11px] text-slate-500">
                  Ostatnie 24 h: {c.runs24h} zdarzeń
                  {c.problems24h > 0 && <span className="font-semibold text-amber-300"> · {c.problems24h} z problemem</span>}
                </p>
              </button>
            );
          })}
        </div>
      )}

      {/* strumień zdarzeń */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h3 className="mr-2 text-sm font-semibold text-slate-100">Zdarzenia</h3>
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              onClick={() => setSource('all')}
              className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                source === 'all' ? 'bg-brand-600 text-white' : 'border border-slate-700 text-slate-300 hover:bg-slate-800'
              }`}
            >
              Wszystkie ({data?.events.length ?? 0})
            </button>
            {(Object.keys(SOURCE_LABEL) as SysSource[])
              .filter((s) => counts.get(s))
              .map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setSource(source === s ? 'all' : s);
                    setLimit(PAGE);
                  }}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    source === s ? 'bg-brand-600 text-white' : 'border border-slate-700 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  {SOURCE_LABEL[s]} ({counts.get(s)})
                </button>
              ))}
          </div>
        </div>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={onlyProblems}
              onChange={(e) => setOnlyProblems(e.target.checked)}
              className="h-4 w-4 accent-brand-500"
            />
            tylko błędy i ostrzeżenia
          </label>
          <select
            value={days}
            onChange={(e) => {
              setDays(Number(e.target.value));
              setLimit(PAGE);
            }}
            className="input-field w-40 text-xs"
            aria-label="Okres"
          >
            {RANGES.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
          <div className="relative min-w-[10rem] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Szukaj w zdarzeniach…"
              className="input-field with-icon text-sm"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-700 py-8 text-center text-sm text-slate-500">
            {data && data.events.length === 0
              ? 'Brak zdarzeń w tym okresie. Jeśli to nowa funkcja: uruchom migrację migration-system-status.sql i skopiuj nowe wersje agentów na serwer.'
              : 'Brak zdarzeń dla wybranych filtrów.'}
          </p>
        ) : (
          <ul className="divide-y divide-slate-800 overflow-hidden rounded-xl border border-slate-800">
            {visible.map((e) => (
              <EventRow key={e.id} e={e} open={openId === e.id} onToggle={() => setOpenId(openId === e.id ? null : e.id)} />
            ))}
          </ul>
        )}
        {filtered.length > visible.length && (
          <button
            type="button"
            onClick={() => setLimit((l) => l + PAGE)}
            className="mt-3 w-full rounded-xl border border-slate-700 py-2 text-sm text-slate-300 hover:bg-slate-800"
          >
            Pokaż więcej ({filtered.length - visible.length})
          </button>
        )}
      </div>
    </section>
  );
}

function EventRow({ e, open, onToggle }: { e: SysEvent; open: boolean; onToggle: () => void }) {
  const L = LEVEL_STYLE[e.level];
  const Icon = L.icon;
  const hasMore = e.message.length > 120 || (e.details && Object.keys(e.details).length > 0);
  return (
    <li className={e.level === 'error' ? 'bg-red-500/5' : ''}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-slate-800/40"
      >
        <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${L.cls}`} aria-label={L.label} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="text-sm font-semibold text-slate-100">{e.title}</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${SOURCE_BADGE[e.source]}`}>
              {SOURCE_LABEL[e.source]}
            </span>
          </div>
          {e.message && (
            <p className={`mt-0.5 text-xs text-slate-400 ${open ? 'whitespace-pre-wrap break-words' : 'line-clamp-2'}`}>
              {e.message}
            </p>
          )}
        </div>
        <span className="shrink-0 text-right text-xs tabular-nums text-slate-500" title={exactTime(e.at)}>
          {formatAgo(e.at)}
        </span>
        {hasMore ? (
          open ? (
            <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
          ) : (
            <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
          )
        ) : (
          <span className="w-4 shrink-0" />
        )}
      </button>
      {open && (
        <div className="space-y-1 border-t border-slate-800 bg-slate-950/50 px-4 py-2.5 text-xs text-slate-400">
          <p>
            <span className="text-slate-500">Czas:</span> {exactTime(e.at)}
          </p>
          {e.details &&
            Object.entries(e.details).map(([k, v]) => (
              <p key={k}>
                <span className="text-slate-500">{k}:</span> <span className="text-slate-200">{String(v)}</span>
              </p>
            ))}
        </div>
      )}
    </li>
  );
}
