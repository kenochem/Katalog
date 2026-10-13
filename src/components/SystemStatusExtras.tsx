import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Loader2,
  PlugZap,
  RefreshCw,
  Tag,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { roleCan } from '../lib/roleMatrixStore';
import { supabase } from '../lib/supabase';
import { requestWaproStockSync } from '../lib/stockSync';
import { requestWaproSalesSync } from '../lib/salesSync';
import { pingBaselinker, promoTickBaselinker, refreshBaselinkerLinks } from '../lib/baselinkerApi';
import { BUCKET_MS, ackAlerts, fetchUptime, type SystemAlert } from '../lib/systemAlerts';
import { formatAgo, minutesSince, AGENT_DOWN_MIN, type AgentBeat } from '../lib/systemStatus';
import { showToast } from '../lib/toast';

// =============================================================================================
// Aktywne alerty
// =============================================================================================

const ALERT_STYLE = {
  error: { icon: XCircle, box: 'border-red-500/50 bg-red-500/10', text: 'text-red-300' },
  warning: { icon: AlertTriangle, box: 'border-amber-500/40 bg-amber-500/10', text: 'text-amber-300' },
  info: { icon: Info, box: 'border-sky-500/30 bg-sky-500/10', text: 'text-sky-300' },
} as const;

export function AlertsPanel({
  alerts,
  who,
  onChanged,
}: {
  alerts: SystemAlert[];
  who: string;
  onChanged: () => void;
}) {
  if (alerts.length === 0) return null;
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
      <h3 className="mb-2 text-sm font-semibold text-slate-100">Aktywne alarmy ({alerts.length})</h3>
      <ul className="space-y-2">
        {alerts.map((a) => {
          const S = ALERT_STYLE[a.level];
          const Icon = S.icon;
          return (
            <li key={a.id} className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 ${S.box}`}>
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${S.text}`} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-100">{a.title}</p>
                <p className="mt-0.5 text-xs text-slate-300">{a.message}</p>
                <p className="mt-1 text-[11px] text-slate-500">
                  od {formatAgo(a.firstSeen)}
                  {a.ackAt ? ` · przyjął(a): ${a.ackBy ?? '—'}, ${formatAgo(a.ackAt)}` : ''}
                </p>
              </div>
              {!a.ackAt && a.level !== 'info' && (
                <button
                  type="button"
                  onClick={() => void ackAlerts([a.id], who).then(onChanged)}
                  className="shrink-0 rounded-lg border border-slate-600 bg-slate-900 px-2.5 py-1 text-xs font-semibold text-slate-100 hover:bg-slate-800"
                >
                  Przyjąłem
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// =============================================================================================
// Dostępność agentów (historia sygnałów „żyję”)
// =============================================================================================

const AGENTS = [
  { id: 'stock', label: 'Agent stanów, cen i sprzedaży' },
  { id: 'orders', label: 'Agent zamówień, rezerwacji i promocji' },
] as const;

const DAY_NAMES = ['niedz.', 'pon.', 'wt.', 'śr.', 'czw.', 'pt.', 'sob.'];

function floorBucket(t: number): number {
  return Math.floor(t / BUCKET_MS) * BUCKET_MS;
}

export function AvailabilityPanel() {
  const [data, setData] = useState<Map<string, Set<number>> | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setData(await fetchUptime(8));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 5 * 60_000);
    return () => clearInterval(t);
  }, [load]);

  const nowBucket = floorBucket(Date.now());

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-100">Dostępność agentów na serwerze WAPRO</h3>
        <span className="text-[11px] text-slate-500">
          Każdy kwadrat = 15 minut. <span className="text-emerald-400">zielony</span> = agent dał znak,{' '}
          <span className="text-red-400">czerwony</span> = cisza (serwer wyłączony / konto wylogowane).
        </span>
      </div>
      {loading && !data ? (
        <div className="flex justify-center py-6 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <div className="space-y-5">
          {AGENTS.map((ag) => (
            <AgentUptime key={ag.id} label={ag.label} set={data?.get(ag.id) ?? new Set()} nowBucket={nowBucket} />
          ))}
        </div>
      )}
    </section>
  );
}

function AgentUptime({ label, set, nowBucket }: { label: string; set: Set<number>; nowBucket: number }) {
  const first = useMemo(() => (set.size ? Math.min(...set) : null), [set]);

  function cellState(t: number): 'up' | 'down' | 'nodata' | 'future' {
    if (t > nowBucket) return 'future';
    if (set.has(t)) return 'up';
    if (first == null || t < first) return 'nodata';
    return 'down';
  }

  function pct(from: number, to: number): string {
    let total = 0;
    let up = 0;
    for (let t = from; t <= to; t += BUCKET_MS) {
      const st = cellState(t);
      if (st === 'up') {
        up++;
        total++;
      } else if (st === 'down') total++;
    }
    return total ? `${Math.round((up / total) * 100)}%` : '—';
  }

  // ostatnie 24 h (96 przedziałów, kończąc na bieżącym)
  const start24 = nowBucket - 95 * BUCKET_MS;
  const cells24 = Array.from({ length: 96 }, (_, i) => start24 + i * BUCKET_MS);

  // ostatnie 7 dni kalendarzowych (od północy czasu lokalnego)
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (6 - i));
    return d;
  });

  const color = {
    up: 'bg-emerald-500',
    down: 'bg-red-500/80',
    nodata: 'bg-slate-800',
    future: 'bg-transparent',
  } as const;

  return (
    <div>
      <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-slate-200">{label}</p>
        <p className="text-xs text-slate-400">
          24 h: <b className="text-slate-100">{pct(start24, nowBucket)}</b> · 7 dni:{' '}
          <b className="text-slate-100">{pct(days[0].getTime(), nowBucket)}</b>
          {first == null && <span className="ml-2 text-amber-300">(brak danych — skopiuj nową wersję agenta)</span>}
        </p>
      </div>

      <div className="flex gap-px">
        {cells24.map((t) => (
          <span
            key={t}
            title={`${new Date(t).toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} — ${
              { up: 'agent działał', down: 'brak sygnału', nodata: 'brak danych', future: '' }[cellState(t)]
            }`}
            className={`h-5 flex-1 rounded-[2px] ${color[cellState(t)]}`}
          />
        ))}
      </div>
      <div className="mt-0.5 flex justify-between text-[10px] text-slate-500">
        <span>24 h temu</span>
        <span>teraz</span>
      </div>

      <details className="mt-2">
        <summary className="cursor-pointer text-xs text-slate-400 hover:text-slate-200">Ostatnie 7 dni (dzień po dniu)</summary>
        <div className="mt-2 space-y-1">
          {days.map((d) => {
            const dayStart = floorBucket(d.getTime());
            const cells = Array.from({ length: 96 }, (_, i) => dayStart + i * BUCKET_MS);
            return (
              <div key={d.getTime()} className="flex items-center gap-2">
                <span className="w-16 shrink-0 text-[11px] text-slate-400">
                  {DAY_NAMES[d.getDay()]} {d.getDate()}.{String(d.getMonth() + 1).padStart(2, '0')}
                </span>
                <div className="flex flex-1 gap-px">
                  {cells.map((t) => (
                    <span
                      key={t}
                      title={`${new Date(t).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })} — ${
                        { up: 'agent działał', down: 'brak sygnału', nodata: 'brak danych', future: '' }[cellState(t)]
                      }`}
                      className={`h-3 flex-1 rounded-[1px] ${color[cellState(t)]}`}
                    />
                  ))}
                </div>
                <span className="w-9 shrink-0 text-right text-[11px] tabular-nums text-slate-400">
                  {pct(dayStart, Math.min(nowBucket, dayStart + 95 * BUCKET_MS))}
                </span>
              </div>
            );
          })}
          <div className="flex items-center gap-2 pl-[4.5rem] text-[10px] text-slate-600">
            <span className="flex-1">0:00</span>
            <span className="flex-1 text-center">12:00</span>
            <span className="flex-1 text-right">24:00</span>
            <span className="w-9" />
          </div>
        </div>
      </details>
    </div>
  );
}

// =============================================================================================
// Szybkie akcje + test połączeń
// =============================================================================================

interface CheckRow {
  label: string;
  ok: boolean;
  detail: string;
}

export function QuickActionsPanel({ beats, onDone }: { beats: AgentBeat[]; onDone: () => void }) {
  const { role } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);
  const [checks, setChecks] = useState<CheckRow[] | null>(null);

  const canStock = roleCan(role, 'editStock');
  const canBl = roleCan(role, 'manageBaselinker');
  const canPromo = roleCan(role, 'managePromotions') || canBl;

  async function run(id: string, fn: () => Promise<string>) {
    setBusy(id);
    try {
      showToast(await fn(), 'ok', 7000);
      onDone();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Nie udało się wykonać akcji', 'error', 8000);
    } finally {
      setBusy(null);
    }
  }

  async function testConnections() {
    setBusy('test');
    const rows: CheckRow[] = [];
    // Supabase
    try {
      const t0 = Date.now();
      const { error } = supabase
        ? await supabase.from('agent_heartbeats').select('agent').limit(1)
        : { error: { message: 'brak konfiguracji' } };
      rows.push({
        label: 'Baza danych (Supabase)',
        ok: !error,
        detail: error ? error.message : `odpowiada (${Date.now() - t0} ms)`,
      });
    } catch (e) {
      rows.push({ label: 'Baza danych (Supabase)', ok: false, detail: e instanceof Error ? e.message : 'błąd' });
    }
    // agenci
    for (const [agent, label] of [
      ['stock', 'Agent stanów i cen (serwer WAPRO)'],
      ['orders', 'Agent zamówień i promocji (serwer WAPRO)'],
    ] as const) {
      const b = beats.find((x) => x.agent === agent);
      const age = b ? minutesSince(b.lastRunAt) : null;
      rows.push({
        label,
        ok: age != null && age < AGENT_DOWN_MIN,
        detail: !b ? 'brak sygnału — agent niewdrożony lub nigdy nie działał' : `ostatni sygnał ${formatAgo(b.lastRunAt)}`,
      });
    }
    // BaseLinker
    if (canBl) {
      try {
        const r = await pingBaselinker();
        rows.push({
          label: 'API BaseLinker',
          ok: true,
          detail: `odpowiada (${r.ms} ms), katalogów: ${r.inventories}${r.inventoryId ? `, używany #${r.inventoryId}` : ''}`,
        });
      } catch (e) {
        rows.push({ label: 'API BaseLinker', ok: false, detail: e instanceof Error ? e.message : 'błąd' });
      }
    }
    setChecks(rows);
    setBusy(null);
  }

  const btn =
    'inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-100 hover:bg-slate-800 disabled:opacity-50';

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
      <h3 className="mb-2 text-sm font-semibold text-slate-100">Szybkie akcje</h3>
      <div className="flex flex-wrap gap-2">
        {canStock && (
          <button
            type="button"
            disabled={busy !== null}
            className={btn}
            onClick={() =>
              void run('stock', async () => {
                const r = await requestWaproStockSync('all');
                if (!r.ok) throw new Error(r.error || 'Nie udało się zlecić synchronizacji');
                return 'Zlecono synchronizację stanów i cen — agent podejmie ją w ciągu ok. 2 minut.';
              })
            }
          >
            {busy === 'stock' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Synchronizuj stany i ceny teraz
          </button>
        )}
        {canStock && (
          <button
            type="button"
            disabled={busy !== null}
            className={btn}
            onClick={() =>
              void run('sales', async () => {
                const r = await requestWaproSalesSync();
                if (!r.ok) throw new Error(r.error || 'Nie udało się zlecić synchronizacji sprzedaży');
                return 'Zlecono odświeżenie sprzedaży — agent podejmie je przy najbliższym przebiegu.';
              })
            }
          >
            {busy === 'sales' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Odśwież sprzedaż teraz
          </button>
        )}
        {canPromo && (
          <button
            type="button"
            disabled={busy !== null}
            className={btn}
            onClick={() =>
              void run('promo', async () => {
                const r = await promoTickBaselinker();
                return r.results.length
                  ? `Promocje: obsłużono kampanii: ${r.results.length}.`
                  : 'Promocje sprawdzone — żadna kampania nie wymaga teraz startu ani końca.';
              })
            }
          >
            {busy === 'promo' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Tag className="h-3.5 w-3.5" />}
            Sprawdź promocje teraz
          </button>
        )}
        {canBl && (
          <button
            type="button"
            disabled={busy !== null}
            className={btn}
            onClick={() =>
              void run('links', async () => {
                const r = await refreshBaselinkerLinks();
                return r.skipped
                  ? 'Powiązania z BaseLinkerem były odświeżone niedawno.'
                  : `Odświeżono powiązania z BaseLinkerem (w BL: ${r.bl ?? '?'}, dopasowano: ${r.matched ?? '?'}).`;
              })
            }
          >
            {busy === 'links' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Odśwież powiązania BaseLinker (B/W)
          </button>
        )}
        <button type="button" disabled={busy !== null} className={btn} onClick={() => void testConnections()}>
          {busy === 'test' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlugZap className="h-3.5 w-3.5" />}
          Test połączeń
        </button>
      </div>

      {checks && (
        <ul className="mt-3 space-y-1.5">
          {checks.map((c) => (
            <li key={c.label} className="flex items-start gap-2 text-sm">
              {c.ok ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
              ) : (
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
              )}
              <span className="text-slate-200">
                <b>{c.label}:</b> <span className={c.ok ? 'text-slate-300' : 'text-red-300'}>{c.detail}</span>
              </span>
            </li>
          ))}
          <li className="text-[11px] text-slate-500">
            Połączenia z samym SQL WAPRO nie da się sprawdzić z przeglądarki — o jego stanie świadczy sygnał agentów.
          </li>
        </ul>
      )}
    </section>
  );
}
