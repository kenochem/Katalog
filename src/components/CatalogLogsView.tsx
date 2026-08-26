import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  DatabaseZap,
  Info,
  RefreshCw,
  Search,
  Trash2,
  XCircle,
} from 'lucide-react';
import {
  clearCatalogLogs,
  listCatalogLogs,
  subscribeCatalogLogs,
  type CatalogLogEntry,
  type CatalogLogLevel,
} from '../lib/catalogLogs';
import { getLatestStockSync, type StockSyncRequest } from '../lib/stockSync';

interface CatalogLogsViewProps {
  userId?: string;
}

const LEVEL_LABELS: Record<CatalogLogLevel, string> = {
  info: 'Info',
  success: 'Sukces',
  warning: 'Uwaga',
  error: 'Błąd',
};

const LEVEL_STYLES: Record<CatalogLogLevel, string> = {
  info: 'border-sky-200 bg-sky-50 text-sky-950 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-100',
  success:
    'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100',
  warning:
    'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100',
  error:
    'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100',
};

function levelIcon(level: CatalogLogLevel) {
  if (level === 'success') return <CheckCircle2 className="h-4 w-4" />;
  if (level === 'warning') return <AlertTriangle className="h-4 w-4" />;
  if (level === 'error') return <XCircle className="h-4 w-4" />;
  return <Info className="h-4 w-4" />;
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'brak daty';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function latestTone(status: StockSyncRequest['status']): CatalogLogLevel {
  if (status === 'done') return 'success';
  if (status === 'error') return 'error';
  return 'info';
}

type FriendlyStat = {
  label: string;
  value: string | number;
  help: string;
  tone?: 'good' | 'warn' | 'neutral';
};

type FriendlyLog = {
  title: string;
  body: string;
  stats: FriendlyStat[];
  notes: string[];
  technical?: string;
};

function findNumber(raw: string, pattern: RegExp): number | undefined {
  const match = raw.match(pattern);
  if (!match?.[1]) return undefined;
  const value = Number(match[1].replace(/\s/g, ''));
  return Number.isFinite(value) ? value : undefined;
}

function humanScope(scope: string | null | undefined) {
  if (!scope || scope === 'all') return 'oba katalogi';
  if (scope === 'shop') return 'Produkty';
  if (scope === 'accessories') return 'Akcesoria';
  return scope;
}

function friendlySyncSummary(message: string | null | undefined, details?: CatalogLogEntry['details']): FriendlyLog {
  const detailRecord = details ?? {};
  const visibleMessage = (message ?? '').trim();
  const technicalFromDetails =
    typeof detailRecord['Raport techniczny'] === 'string'
      ? String(detailRecord['Raport techniczny']).trim()
      : '';
  const raw = technicalFromDetails || visibleMessage;
  const looksLikeSyncReport =
    /Tryb WAPRO|Zaktualizowano:|SKU z SQL|nowe SKU z Mag|brak w WAPRO/i.test(raw);
  const fromDetails = (label: string) => {
    const v = detailRecord[label];
    return typeof v === 'number' ? v : undefined;
  };

  const newSku =
    findNumber(raw, /nowe SKU z Mag:\s*(\d+)/i) ?? fromDetails('Nowe SKU z Mag');
  const updated = findNumber(raw, /Zaktualizowano:\s*(\d+)/i);
  const unchanged = findNumber(raw, /bez zmian:\s*(\d+)/i);
  const manualStock = findNumber(raw, /reczne stan:\s*(\d+)/i);
  const missingWapro = findNumber(raw, /brak w WAPRO:\s*(\d+)/i);
  const filledPrices = findNumber(raw, /uzupelnione pola cen:\s*(\d+)/i);
  const sqlSku = findNumber(raw, /SKU z SQL:\s*(\d+)/i);
  const bootstrapped =
    findNumber(raw, /odkryte[^:]*:\s*(\d+)/i) ?? fromDetails('Odkryte stany/ceny');
  const warnings = findNumber(raw, /ostrzezenia:\s*(\d+)/i) ?? fromDetails('Ostrzeżenia');
  const altSku =
    findNumber(raw, /dopasowane po (?:legacy|alt)[^:]*:\s*(\d+)/i) ??
    fromDetails('Dopasowane po alt SKU');
  const scope = raw.match(/Zakres:\s*([^.,]+)/i)?.[1]?.trim();
  const report = raw.match(/raport brakow:\s*([^.,]+)/i)?.[1]?.trim();

  const stats: FriendlyStat[] = [];
  if (newSku !== undefined) {
    stats.push({
      label: 'Nowe produkty',
      value: newSku,
      help: 'Dopisane do katalogu z Mag WAPRO',
      tone: newSku > 0 ? 'good' : 'neutral',
    });
  }
  if (updated !== undefined) {
    stats.push({
      label: 'Odświeżone',
      value: updated,
      help: 'Produkty z aktualnym stanem lub ceną',
      tone: updated > 0 ? 'good' : 'neutral',
    });
  }
  if (filledPrices !== undefined) {
    stats.push({
      label: 'Ceny uzupełnione',
      value: filledPrices,
      help: 'Puste pola cenowe uzupełnione z WAPRO',
      tone: filledPrices > 0 ? 'good' : 'neutral',
    });
  }
  if (bootstrapped !== undefined) {
    stats.push({
      label: 'Pierwsze dane',
      value: bootstrapped,
      help: 'Pozycje, które pierwszy raz dostały stan lub cenę',
      tone: bootstrapped > 0 ? 'good' : 'neutral',
    });
  }
  if (missingWapro !== undefined) {
    stats.push({
      label: 'Do sprawdzenia',
      value: missingWapro,
      help: 'Produkty z katalogu bez odpowiednika w WAPRO',
      tone: missingWapro > 0 ? 'warn' : 'neutral',
    });
  }
  if (warnings !== undefined) {
    stats.push({
      label: 'Ostrzeżenia',
      value: warnings,
      help: 'Pozycje porządkowe wymagające uwagi',
      tone: warnings > 0 ? 'warn' : 'neutral',
    });
  }

  const notes: string[] = [];
  if (manualStock && manualStock > 0) {
    notes.push(`${manualStock} pozycji ma ręcznie ustawiony stan, więc sync go nie nadpisywał.`);
  }
  if (altSku && altSku > 0) {
    notes.push(`${altSku} pozycji dopasowano po alternatywnym lub historycznym SKU.`);
  }
  if (report) {
    notes.push(`Raport pozycji do sprawdzenia: ${report}.`);
  }
  if (sqlSku !== undefined) {
    notes.push(`WAPRO zwróciło ${sqlSku} SKU dla tego przebiegu.`);
  }
  if (unchanged !== undefined && unchanged > 0) {
    notes.push(`${unchanged} pozycji nie wymagało zmian.`);
  }

  let title = 'Synchronizacja zakończona';
  let body = `Zakres: ${humanScope(scope)}.`;
  if ((newSku ?? 0) > 0) {
    title = 'Dopisano nowe produkty z WAPRO';
    body = `Do katalogu trafiło ${newSku} nowych indeksów. Teraz warto sprawdzić zdjęcia, opisy i kategorie.`;
  } else if ((updated ?? 0) > 0 || (filledPrices ?? 0) > 0 || (bootstrapped ?? 0) > 0) {
    title = 'Odświeżono dane katalogu';
    body = `Sync zaktualizował stany lub ceny w zakresie: ${humanScope(scope)}.`;
  } else if ((warnings ?? 0) > 0 || (missingWapro ?? 0) > 0) {
    title = 'Sync zakończony z pozycjami do sprawdzenia';
    body = 'Dane zostały przetworzone, ale część pozycji wymaga ręcznej kontroli.';
  }

  if (!looksLikeSyncReport && stats.length === 0) {
    const isStart = /zlecenie|zlecono|czekam/i.test(visibleMessage);
    return {
      title: isStart ? 'Sync został zlecony' : 'Komunikat katalogu',
      body: visibleMessage || 'Ten wpis nie zawiera jeszcze technicznego raportu.',
      stats,
      notes,
    };
  }

  return { title, body, stats, notes, technical: looksLikeSyncReport ? raw : undefined };
}

function statToneClass(tone: FriendlyStat['tone']) {
  if (tone === 'good') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100';
  }
  if (tone === 'warn') {
    return 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100';
  }
  return 'border-slate-200 bg-slate-50 text-slate-950 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100';
}

function FriendlySyncBlock({
  message,
  details,
  compact = false,
}: {
  message: string | null | undefined;
  details?: CatalogLogEntry['details'];
  compact?: boolean;
}) {
  const summary = friendlySyncSummary(message, details);
  return (
    <div className="mt-2 space-y-3">
      <div>
        <p className="text-sm font-semibold text-slate-950 dark:text-slate-50">
          {summary.title}
        </p>
        <p className="mt-1 text-sm leading-6 text-slate-700 dark:text-slate-300">
          {summary.body}
        </p>
      </div>
      {summary.stats.length > 0 && (
        <dl className={`grid gap-2 ${compact ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3'}`}>
          {summary.stats.map((stat) => (
            <div
              key={stat.label}
              className={`rounded-xl border px-3 py-2 ${statToneClass(stat.tone)}`}
            >
              <dt className="text-[10px] font-semibold uppercase tracking-wide opacity-75">
                {stat.label}
              </dt>
              <dd className="mt-1 text-xl font-bold leading-none">{stat.value}</dd>
              <p className="mt-1 text-[11px] leading-snug opacity-80">{stat.help}</p>
            </div>
          ))}
        </dl>
      )}
      {summary.notes.length > 0 && (
        <ul className="space-y-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          {summary.notes.map((note) => (
            <li key={note}>• {note}</li>
          ))}
        </ul>
      )}
      {summary.technical && (
        <details className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-950">
          <summary className="cursor-pointer font-semibold text-slate-700 dark:text-slate-300">
            Raport techniczny
          </summary>
          <p className="mt-2 whitespace-pre-wrap leading-5 text-slate-600 dark:text-slate-400">
            {summary.technical}
          </p>
        </details>
      )}
    </div>
  );
}

export function CatalogLogsView({ userId }: CatalogLogsViewProps) {
  const [logs, setLogs] = useState<CatalogLogEntry[]>(() => listCatalogLogs(userId));
  const [latest, setLatest] = useState<StockSyncRequest | null>(null);
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const refresh = () => setLogs(listCatalogLogs(userId));
    refresh();
    return subscribeCatalogLogs(refresh);
  }, [userId]);

  async function refreshLatest() {
    setRefreshing(true);
    try {
      setLatest(await getLatestStockSync());
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void refreshLatest();
  }, []);

  const filteredLogs = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter((entry) =>
      [entry.title, entry.message, entry.source, JSON.stringify(entry.details ?? {})]
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }, [logs, query]);

  const latestLevel = latest ? latestTone(latest.status) : 'info';

  return (
    <section className="catalog-logs-view mx-auto max-w-6xl space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
              Historia katalogu
            </p>
            <h2 className="mt-1 text-2xl font-bold text-slate-950 dark:text-slate-50">
              Logi synchronizacji i powiadomień
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-700 dark:text-slate-300">
              Tu trafiają najważniejsze komunikaty po synchronizacji WAPRO: nowe produkty,
              ostrzeżenia, błędy oraz podsumowania, które wcześniej znikały razem z toastem.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void refreshLatest()}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Odśwież status
            </button>
            <button
              type="button"
              onClick={() => clearCatalogLogs(userId)}
              className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 dark:border-rose-500/30 dark:bg-slate-900 dark:text-rose-200 dark:hover:bg-rose-500/10"
            >
              <Trash2 className="h-4 w-4" />
              Wyczyść lokalne
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-start gap-3">
            <span
              className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${LEVEL_STYLES[latestLevel]}`}
            >
              <DatabaseZap className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-950 dark:text-slate-50">
                Ostatni wynik sync z Supabase
              </p>
              {latest ? (
                <>
                  <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                    Status: <strong>{latest.status}</strong> · zakres:{' '}
                    <strong>{latest.catalog ?? 'all'}</strong> · zlecono:{' '}
                    {formatDate(latest.requested_at)}
                  </p>
                  <FriendlySyncBlock message={latest.message} compact />
                </>
              ) : (
                <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                  Nie znaleziono jeszcze zlecenia sync albo Supabase nie zwrócił danych.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
              <Clock3 className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-950 dark:text-slate-50">
                Lokalne wpisy
              </p>
              <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                {logs.length} zapisanych wpisów na tym urządzeniu. Nowe wpisy pojawiają się
                po zakończonym syncu z przycisku w katalogu.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-950 dark:text-slate-50">
              Ostatnie zdarzenia
            </h3>
            <p className="text-sm text-slate-700 dark:text-slate-300">
              Najnowsze komunikaty z katalogu i synchronizacji.
            </p>
          </div>
          <label className="relative block w-full sm:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Szukaj w logach..."
              className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm font-medium text-slate-950 outline-none placeholder:text-slate-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50 dark:placeholder:text-slate-400"
            />
          </label>
        </div>

        <div className="divide-y divide-slate-200 dark:divide-slate-800">
          {filteredLogs.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm font-semibold text-slate-950 dark:text-slate-50">
                Brak wpisów do pokazania
              </p>
              <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                Uruchom sync WAPRO, a wynik zostanie zapisany tutaj.
              </p>
            </div>
          ) : (
            filteredLogs.map((entry) => (
              <article key={entry.id} className="p-4">
                <div className="flex gap-3">
                  <span
                    className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${LEVEL_STYLES[entry.level]}`}
                  >
                    {levelIcon(entry.level)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-sm font-bold text-slate-950 dark:text-slate-50">
                        {entry.title}
                      </h4>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                        {LEVEL_LABELS[entry.level]}
                      </span>
                      <span className="text-xs text-slate-600 dark:text-slate-400">
                        {formatDate(entry.createdAt)}
                      </span>
                    </div>
                    {entry.source === 'sync-wapro' && entry.message ? (
                      <FriendlySyncBlock message={entry.message} details={entry.details} />
                    ) : (
                      <p className="mt-1 text-sm leading-6 text-slate-800 dark:text-slate-200">
                        {entry.message}
                      </p>
                    )}
                    {entry.source !== 'sync-wapro' &&
                      entry.details &&
                      Object.keys(entry.details).length > 0 && (
                      <dl className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                        {Object.entries(entry.details).map(([key, value]) => (
                          <div
                            key={key}
                            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900"
                          >
                            <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                              {key}
                            </dt>
                            <dd className="mt-1 text-sm font-bold text-slate-950 dark:text-slate-50">
                              {value ?? '-'}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    )}
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
