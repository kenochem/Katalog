import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Loader2, RefreshCw, Search } from 'lucide-react';
import {
  AUDIT_ACTION_LABELS,
  fetchAuditLog,
  type AuditEntry,
} from '../lib/auditLog';
import { downloadCsv, stampFile } from '../lib/exportReport';
import { supabase } from '../lib/supabase';

const PAGE = 200;

const RANGES = [
  { id: '1', label: 'Ostatnie 24 h', days: 1 },
  { id: '7', label: '7 dni', days: 7 },
  { id: '30', label: '30 dni', days: 30 },
  { id: '0', label: 'Wszystko', days: 0 },
] as const;

const ACTION_TONE: Record<string, string> = {
  'product.delete': 'bg-red-500/15 text-red-300',
  'kit.delete': 'bg-red-500/15 text-red-300',
  'user.create': 'bg-violet-500/15 text-violet-300',
  'user.update': 'bg-violet-500/15 text-violet-300',
  'user.password': 'bg-violet-500/15 text-violet-300',
  'roles.matrix': 'bg-violet-500/15 text-violet-300',
  'auth.login': 'bg-slate-800 text-slate-400',
  'product.price': 'bg-amber-500/15 text-amber-300',
  'product.stock': 'bg-sky-500/15 text-sky-300',
};

function fmtValue(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'tak' : 'nie';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function fmtWhen(iso: string): string {
  return new Date(iso).toLocaleString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

interface ProfileOption {
  id: string;
  label: string;
}

export function AdminAuditSection() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [users, setUsers] = useState<ProfileOption[]>([]);
  const [userId, setUserId] = useState('');
  const [action, setAction] = useState('');
  const [range, setRange] = useState<(typeof RANGES)[number]['id']>('7');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    void supabase
      .from('profiles')
      .select('id,display_name,email')
      .order('display_name')
      .then(({ data }) =>
        setUsers(
          (data ?? []).map((r) => ({
            id: String(r.id),
            label: String(r.display_name || r.email),
          })),
        ),
      );
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setQuery(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const since = useMemo(() => {
    const days = RANGES.find((r) => r.id === range)?.days ?? 0;
    return days ? new Date(Date.now() - days * 86_400_000).toISOString() : undefined;
  }, [range]);

  const load = useCallback(
    async (append = false) => {
      setLoading(true);
      setError(null);
      try {
        const rows = await fetchAuditLog({
          userId: userId || undefined,
          action: action || undefined,
          search: query,
          since,
          limit: PAGE,
          before: append ? entries[entries.length - 1]?.createdAt : undefined,
        });
        setEntries((prev) => (append ? [...prev, ...rows] : rows));
        setHasMore(rows.length === PAGE);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Błąd';
        setError(
          /audit_log/.test(msg)
            ? 'Brak tabeli audit_log — uruchom supabase/migration-audit-log.sql w SQL Editorze.'
            : msg,
        );
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId, action, query, since],
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  function exportCsv() {
    downloadCsv(
      stampFile('dziennik_aktywnosci'),
      ['Data', 'Użytkownik', 'Rola', 'Aplikacja', 'Akcja', 'Obiekt', 'Nazwa', 'Zmiany'],
      entries.map((e) => [
        fmtWhen(e.createdAt),
        e.userLabel,
        e.userRole,
        e.app,
        AUDIT_ACTION_LABELS[e.action] ?? e.action,
        e.entityId,
        e.entityLabel,
        e.changes
          ? Object.entries(e.changes)
              .map(([k, v]) => `${k}: ${fmtValue(v.from)} → ${fmtValue(v.to)}`)
              .join(' | ')
          : e.summary,
      ]),
    );
  }

  return (
    <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <select
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          className="input-field text-sm"
          aria-label="Użytkownik"
        >
          <option value="">Wszyscy użytkownicy</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.label}
            </option>
          ))}
        </select>
        <select
          value={action}
          onChange={(e) => setAction(e.target.value)}
          className="input-field text-sm"
          aria-label="Typ akcji"
        >
          <option value="">Wszystkie akcje</option>
          {Object.entries(AUDIT_ACTION_LABELS).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
        <select
          value={range}
          onChange={(e) => setRange(e.target.value as typeof range)}
          className="input-field text-sm"
          aria-label="Okres"
        >
          {RANGES.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </select>
        <div className="relative sm:col-span-2 lg:col-span-1">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="SKU, nazwa, opis…"
            className="input-field pl-9 text-sm"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void load(false)}
            disabled={loading}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Odśwież
          </button>
          <button
            type="button"
            onClick={exportCsv}
            disabled={!entries.length}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            CSV
          </button>
        </div>
      </div>

      {error && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      {!error && !loading && entries.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-700 py-8 text-center text-sm text-slate-500">
          Brak wpisów dla wybranych filtrów. Dziennik zapisuje zmiany od momentu wdrożenia.
        </p>
      )}

      <ul className="divide-y divide-slate-800 rounded-xl border border-slate-800">
        {entries.map((e) => {
          const open = openId === e.id;
          const changeCount = e.changes ? Object.keys(e.changes).length : 0;
          return (
            <li key={e.id}>
              <button
                type="button"
                onClick={() => setOpenId(open ? null : e.id)}
                className="flex w-full flex-col gap-1 px-3 py-2.5 text-left hover:bg-slate-800/40 sm:flex-row sm:items-center sm:gap-3"
              >
                <span className="shrink-0 text-xs tabular-nums text-slate-500 sm:w-40">
                  {fmtWhen(e.createdAt)}
                </span>
                <span className="shrink-0 text-sm font-medium text-slate-200 sm:w-40 sm:truncate">
                  {e.userLabel || '—'}
                </span>
                <span
                  className={`inline-block w-fit shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    ACTION_TONE[e.action] ?? 'bg-brand-500/15 text-brand-300'
                  }`}
                >
                  {AUDIT_ACTION_LABELS[e.action] ?? e.action}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-slate-300">
                  {e.entityId && <span className="font-mono text-brand-300">{e.entityId}</span>}
                  {e.entityLabel && <span className="text-slate-400"> · {e.entityLabel}</span>}
                  {!e.entityId && e.summary}
                </span>
                {changeCount > 0 && (
                  <span className="shrink-0 text-xs text-slate-500">{e.summary}</span>
                )}
              </button>
              {open && (
                <div className="space-y-1 border-t border-slate-800 bg-slate-950/50 px-3 py-2.5 text-xs">
                  <p className="text-slate-500">
                    {e.userLabel} ({e.userRole || 'brak roli'}) · aplikacja: {e.app || '—'} ·{' '}
                    {e.summary}
                  </p>
                  {e.changes &&
                    Object.entries(e.changes).map(([field, v]) => (
                      <p key={field} className="break-all text-slate-300">
                        <span className="font-medium text-slate-100">{field}:</span>{' '}
                        <span className="text-red-300/90">{fmtValue(v.from)}</span>
                        {' → '}
                        <span className="text-emerald-300">{fmtValue(v.to)}</span>
                      </p>
                    ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {loading && (
        <div className="flex justify-center py-2 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}
      {hasMore && !loading && (
        <button
          type="button"
          onClick={() => void load(true)}
          className="w-full rounded-xl border border-slate-700 py-2 text-sm text-slate-300 hover:bg-slate-800"
        >
          Pokaż starsze
        </button>
      )}
    </div>
  );
}
