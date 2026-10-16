import { AlertTriangle, CheckCircle2, Copy, Database, HelpCircle, Loader2, RefreshCw, ShieldAlert, XCircle } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { checkMigrations, type MigrationResult, type MigrationState } from '../lib/migrationStatus';
import { showToast } from '../lib/toast';

const STATE_META: Record<MigrationState, { label: string; cls: string; icon: typeof CheckCircle2 }> = {
  ok: { label: 'Wgrana', cls: 'bg-emerald-500/15 text-emerald-300', icon: CheckCircle2 },
  missing: { label: 'Do wgrania', cls: 'bg-rose-500/15 text-rose-300', icon: XCircle },
  partial: { label: 'Częściowo', cls: 'bg-amber-500/15 text-amber-300', icon: AlertTriangle },
  'no-access': { label: 'Brak dostępu', cls: 'bg-orange-500/15 text-orange-300', icon: ShieldAlert },
  error: { label: 'Błąd sprawdzenia', cls: 'bg-orange-500/15 text-orange-300', icon: AlertTriangle },
  manual: { label: 'Nie do sprawdzenia', cls: 'bg-slate-600/30 text-slate-300', icon: HelpCircle },
};

type Filter = 'todo' | 'all' | 'ok';

const ORDER: Record<MigrationState, number> = { missing: 0, partial: 1, 'no-access': 2, error: 3, manual: 4, ok: 5 };

/** Zakładka Logów: które migracje bazy są wgrane, a które trzeba jeszcze uruchomić w Supabase. */
export function MigrationsStatusView() {
  const [results, setResults] = useState<MigrationResult[] | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [filter, setFilter] = useState<Filter>('todo');
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    setError(null);
    setProgress({ done: 0, total: 1 });
    try {
      const res = await checkMigrations((done, total) => setProgress({ done, total }));
      setResults(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się sprawdzić migracji');
    } finally {
      setProgress(null);
    }
  }, []);

  useEffect(() => {
    void run();
  }, [run]);

  const counts = useMemo(() => {
    const c: Record<MigrationState, number> = { ok: 0, missing: 0, partial: 0, 'no-access': 0, error: 0, manual: 0 };
    for (const r of results ?? []) c[r.state]++;
    return c;
  }, [results]);

  const shown = useMemo(() => {
    const list = [...(results ?? [])].filter((r) => {
      if (filter === 'ok') return r.state === 'ok';
      if (filter === 'todo') return r.state !== 'ok' && r.state !== 'manual';
      return true;
    });
    return list.sort((a, b) => ORDER[a.state] - ORDER[b.state] || a.probe.file.localeCompare(b.probe.file));
  }, [results, filter]);

  const todo = counts.missing + counts.partial + counts['no-access'] + counts.error;

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-base font-bold text-slate-50">
              <Database className="h-4 w-4" /> Migracje bazy danych
            </h3>
            <p className="mt-1 max-w-3xl text-xs text-slate-400">
              Sprawdzamy próbnymi zapytaniami, czy tabele i kolumny z plików <code>supabase/migration-*.sql</code> istnieją w bazie.
              Niewgrane migracje uruchom w Supabase → SQL Editor (pliki są w folderze <code>supabase</code>). Funkcje SQL i polityki dostępu nie są sprawdzane.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void run()}
            disabled={progress !== null}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-600 px-3 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-800 disabled:opacity-50"
          >
            {progress ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {progress ? `Sprawdzam ${progress.done}/${progress.total}` : 'Sprawdź ponownie'}
          </button>
        </div>
        {results && (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Wgrane" value={counts.ok} tone="text-emerald-300" />
            <Stat label="Do wgrania" value={counts.missing + counts.partial} tone="text-rose-300" />
            <Stat label="Problem z dostępem / błąd" value={counts['no-access'] + counts.error} tone="text-orange-300" />
            <Stat label="Nie do sprawdzenia" value={counts.manual} tone="text-slate-300" />
          </div>
        )}
      </section>

      {error && <p className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</p>}

      {results && (
        <>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['todo', `Do zrobienia (${todo})`],
                ['ok', `Wgrane (${counts.ok})`],
                ['all', `Wszystkie (${results.length})`],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={`rounded-xl border px-3 py-1.5 text-sm font-semibold ${
                  filter === key ? 'border-brand-500 bg-brand-500/15 text-brand-300' : 'border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <ul className="divide-y divide-slate-800 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/40">
            {shown.map((r) => {
              const meta = STATE_META[r.state];
              const Icon = meta.icon;
              const bad = r.objects.filter((o) => o.state !== 'ok');
              return (
                <li key={r.probe.file} className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${meta.cls}`}>
                      <Icon className="h-3.5 w-3.5" /> {meta.label}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-mono text-sm text-slate-100">{r.probe.file}</span>
                      {r.probe.title && <span className="block truncate text-xs text-slate-500">{r.probe.title}</span>}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard?.writeText(r.probe.file);
                        showToast(`Skopiowano nazwę: ${r.probe.file}`, 'ok');
                      }}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                    >
                      <Copy className="h-3.5 w-3.5" /> Kopiuj nazwę
                    </button>
                  </div>
                  {(bad.length > 0 || r.state === 'manual') && (
                    <div className="mt-2 flex flex-wrap gap-1.5 pl-1 text-[11px]">
                      {r.state === 'manual' && (
                        <span className="text-slate-500">Ta migracja nie tworzy tabel ani kolumn (funkcje / polityki) — nie da się jej sprawdzić automatycznie.</span>
                      )}
                      {bad.map((o) => (
                        <span
                          key={o.name}
                          title={o.message}
                          className={`rounded-full px-2 py-0.5 font-mono ${o.state === 'missing' ? 'bg-rose-500/15 text-rose-300' : 'bg-orange-500/15 text-orange-300'}`}
                        >
                          {o.kind === 'table' ? 'tabela' : 'kolumna'} {o.name}: {o.state === 'missing' ? 'brak' : o.state === 'no-access' ? 'brak dostępu' : 'błąd'}
                        </span>
                      ))}
                    </div>
                  )}
                  {bad.some((o) => o.state === 'no-access' || o.state === 'error') && (
                    <p className="mt-1 pl-1 text-[11px] text-orange-300/80">
                      {bad.find((o) => o.message)?.message}
                    </p>
                  )}
                </li>
              );
            })}
            {shown.length === 0 && <li className="px-4 py-8 text-center text-sm text-slate-400">Brak pozycji w tym widoku.</li>}
          </ul>
        </>
      )}
      {!results && !error && progress && <p className="text-sm text-slate-400">Sprawdzam bazę…</p>}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`text-xl font-bold tabular-nums ${tone}`}>{value}</p>
    </div>
  );
}
