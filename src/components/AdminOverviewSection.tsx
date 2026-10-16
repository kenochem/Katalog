import { Activity, AlertTriangle, Database, Gauge, KeyRound, Link2, Loader2, LogIn, ShieldCheck, Users } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { fetchAuditLog, type AuditEntry } from '../lib/auditLog';
import { ROLE_LABELS, type AppRole } from '../lib/roles';
import { checkMigrations } from '../lib/migrationStatus';
import { APP_VERSION } from '../lib/appVersion';
import { ChartCard, Donut, HBars, Kpi, PALETTE, Trend, type SeriesPoint } from './progress/ChartCards';

interface ProfileRow {
  id: string;
  email: string;
  display_name: string | null;
  role: string;
  active: boolean | null;
  created_at: string | null;
}

const ROLE_COLORS: Record<string, string> = {
  admin: PALETTE.violet,
  operator: PALETTE.sky,
  handlowiec: PALETTE.green,
  magazynier: PALETTE.amber,
};

const DAYS = 14;

export type AdminShortcut = 'users' | 'permissions' | 'baselinker' | 'activity' | 'migrations' | 'system';

/** Przegląd administracyjny: konta, role, aktywność zespołu, logowania i stan bazy. */
export function AdminOverviewSection({
  onGo,
  canGo,
}: {
  onGo: (tab: AdminShortcut) => void;
  canGo: Partial<Record<AdminShortcut, boolean>>;
}) {
  const [profiles, setProfiles] = useState<ProfileRow[] | null>(null);
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [migrations, setMigrations] = useState<{ todo: number; total: number } | 'busy' | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (supabase) {
          const { data, error: pe } = await supabase.from('profiles').select('id,email,display_name,role,active,created_at');
          if (pe) throw new Error(pe.message);
          if (alive) setProfiles((data ?? []) as ProfileRow[]);
        }
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : 'Nie udało się pobrać kont');
      }
      try {
        const since = new Date(Date.now() - DAYS * 86_400_000).toISOString();
        const all: AuditEntry[] = [];
        let before: string | undefined;
        for (let page = 0; page < 4; page++) {
          const batch = await fetchAuditLog({ since, limit: 1000, before });
          all.push(...batch);
          if (batch.length < 1000) break;
          before = batch[batch.length - 1].createdAt;
        }
        if (alive) setEntries(all);
      } catch {
        if (alive) setEntries([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function runMigrations() {
    setMigrations('busy');
    try {
      const res = await checkMigrations();
      const todo = res.filter((r) => r.state === 'missing' || r.state === 'partial' || r.state === 'no-access' || r.state === 'error').length;
      setMigrations({ todo, total: res.length });
    } catch {
      setMigrations(null);
    }
  }

  const accounts = useMemo(() => {
    const list = profiles ?? [];
    const byRole = new Map<string, number>();
    for (const p of list) if (p.active !== false) byRole.set(p.role, (byRole.get(p.role) ?? 0) + 1);
    return {
      total: list.length,
      active: list.filter((p) => p.active !== false).length,
      inactive: list.filter((p) => p.active === false).length,
      pie: [...byRole.entries()].map(([role, value]) => ({
        name: ROLE_LABELS[role as AppRole] ?? role,
        value,
        color: ROLE_COLORS[role] ?? PALETTE.slate,
      })),
    };
  }, [profiles]);

  const activity = useMemo(() => {
    const rows = entries ?? [];
    const index = new Map<string, SeriesPoint>();
    const days: SeriesPoint[] = [];
    for (let i = DAYS - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const p: SeriesPoint = { label: d.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' }), logins: 0, actions: 0 };
      days.push(p);
      index.set(d.toISOString().slice(0, 10), p);
    }
    const perUser = new Map<string, number>();
    const today = new Date().toISOString().slice(0, 10);
    let loginsToday = 0;
    const activeUsers = new Set<string>();
    for (const e of rows) {
      const p = index.get(e.createdAt.slice(0, 10));
      const isLogin = e.action === 'auth.login';
      if (p) {
        if (isLogin) p.logins = (p.logins as number) + 1;
        else p.actions = (p.actions as number) + 1;
      }
      if (isLogin && e.createdAt.slice(0, 10) === today) loginsToday++;
      if (!isLogin) perUser.set(e.userLabel || 'nieznany', (perUser.get(e.userLabel || 'nieznany') ?? 0) + 1);
      activeUsers.add(e.userId);
    }
    return {
      days,
      loginsToday,
      activeUsers: activeUsers.size,
      total: rows.length,
      top: [...perUser.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8),
      logins: rows.filter((e) => e.action === 'auth.login').slice(0, 10),
    };
  }, [entries]);

  const shortcuts: { id: AdminShortcut; label: string; desc: string; icon: ReactNode }[] = [
    { id: 'users', label: 'Użytkownicy', desc: 'Konta, role, reset haseł', icon: <Users className="h-5 w-5" /> },
    { id: 'permissions', label: 'Uprawnienia', desc: 'Macierz ról i suwaki dostępu', icon: <KeyRound className="h-5 w-5" /> },
    { id: 'baselinker', label: 'BaseLinker', desc: 'Synchronizacja, import, ustawienia', icon: <Link2 className="h-5 w-5" /> },
    { id: 'activity', label: 'Aktywność', desc: 'Dziennik: kto, co i kiedy zmienił', icon: <Activity className="h-5 w-5" /> },
    { id: 'migrations', label: 'Migracje bazy', desc: 'Które migracje są wgrane', icon: <Database className="h-5 w-5" /> },
    { id: 'system', label: 'Status systemów', desc: 'Agenci WAPRO, synchronizacje, alerty', icon: <Gauge className="h-5 w-5" /> },
  ];

  return (
    <div className="space-y-4">
      {error && <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">Konta: {error}</p>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Konta" value={profiles ? accounts.total : '…'} sub={profiles ? `${accounts.active} aktywnych · ${accounts.inactive} wyłączonych` : undefined} tone="text-violet-300" />
        <Kpi label="Aktywni (14 dni)" value={entries ? activity.activeUsers : '…'} sub="osoby z wpisem w dzienniku" tone="text-sky-300" />
        <Kpi label="Logowania dziś" value={entries ? activity.loginsToday : '…'} tone="text-emerald-300" />
        <Kpi label="Zdarzenia (14 dni)" value={entries ? activity.total.toLocaleString('pl-PL') : '…'} tone="text-amber-300" />
        <Kpi label="Wersja aplikacji" value={`v${APP_VERSION}`} />
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Migracje bazy</p>
          {migrations === 'busy' ? (
            <p className="mt-2 inline-flex items-center gap-2 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> sprawdzam…</p>
          ) : migrations ? (
            <p className={`mt-1 text-2xl font-bold tabular-nums ${migrations.todo ? 'text-rose-300' : 'text-emerald-300'}`}>
              {migrations.todo ? `${migrations.todo} do zrobienia` : 'Wszystko OK'}
            </p>
          ) : (
            <button type="button" onClick={() => void runMigrations()} className="mt-2 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800">
              Sprawdź teraz
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="Aktywność zespołu" subtitle="Logowania i działania dziennie (ostatnie 14 dni)" className="lg:col-span-2">
          {entries ? (
            <Trend
              data={activity.days}
              series={[
                { key: 'actions', name: 'Działania', color: PALETTE.sky },
                { key: 'logins', name: 'Logowania', color: PALETTE.green },
              ]}
            />
          ) : (
            <p className="inline-flex items-center gap-2 py-10 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Wczytuję…</p>
          )}
        </ChartCard>
        <ChartCard title="Konta wg ról" subtitle="Tylko aktywne konta">
          {profiles ? <Donut data={accounts.pie} center={{ top: String(accounts.active), bottom: 'aktywnych' }} /> : <p className="py-10 text-sm text-slate-400">Wczytuję…</p>}
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="Najaktywniejsi" subtitle="Liczba działań (bez logowań), 14 dni">
          <HBars data={activity.top} color={PALETTE.violet} />
          {entries && activity.top.length === 0 && <p className="text-sm text-slate-500">Brak działań w tym okresie.</p>}
        </ChartCard>
        <ChartCard title="Ostatnie logowania" subtitle="Kto, kiedy i z jakiego urządzenia" className="lg:col-span-2" action={<LogIn className="h-4 w-4 text-slate-500" />}>
          <ul className="divide-y divide-slate-800">
            {activity.logins.map((e) => (
              <li key={e.id} className="flex items-center gap-3 py-2 text-sm">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-800 text-[11px] font-bold uppercase text-slate-300">{(e.userLabel || '?').slice(0, 2)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-slate-100">{e.userLabel || e.entityId}</span>
                  <span className="block truncate text-[11px] text-slate-500">
                    {[e.device?.browser, e.device?.os, e.device?.type, e.ip].filter(Boolean).join(' · ') || 'brak danych o urządzeniu'}
                  </span>
                </span>
                <span className="shrink-0 text-[11px] text-slate-500">
                  {new Date(e.createdAt).toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </span>
              </li>
            ))}
            {entries && activity.logins.length === 0 && (
              <li className="flex items-center gap-2 py-6 text-sm text-slate-500">
                <AlertTriangle className="h-4 w-4" /> Brak logowań w dzienniku (dziennik aktywności odczytuje tylko administrator).
              </li>
            )}
          </ul>
        </ChartCard>
      </div>

      <section>
        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <ShieldCheck className="h-3.5 w-3.5" /> Skróty administracyjne
        </p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {shortcuts
            .filter((s) => canGo[s.id])
            .map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => onGo(s.id)}
                className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/50 p-4 text-left transition hover:border-violet-500/50 hover:bg-slate-900"
              >
                <span className="rounded-xl bg-violet-500/15 p-2.5 text-violet-300">{s.icon}</span>
                <span>
                  <span className="block text-sm font-semibold text-slate-100">{s.label}</span>
                  <span className="block text-xs text-slate-500">{s.desc}</span>
                </span>
              </button>
            ))}
        </div>
      </section>
    </div>
  );
}
