import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  DatabaseZap,
  Info,
  ListTree,
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
import { buildSyncLogSummary, type SyncDetailLine } from '../lib/syncLogSummary';
import {
  getRecentProductSyncChanges,
  groupProductSyncChangesByRun,
  PRODUCT_SYNC_CHANGE_FIELD_LABELS,
  type ProductSyncChange,
  type ProductSyncChangeField,
} from '../lib/productSyncChanges';
import { formatPricePln, formatStock } from '../lib/format';

const PRICE_FIELDS = new Set<ProductSyncChangeField>([
  'price_purchase_net',
  'price_sale_net',
  'price_sale_gross',
]);

function formatChangeValue(field: ProductSyncChangeField, value: number | null): string {
  if (value == null) return '—';
  return PRICE_FIELDS.has(field) ? formatPricePln(value) : formatStock(value);
}

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
  info: 'catalog-log-level catalog-log-level--info',
  success: 'catalog-log-level catalog-log-level--success',
  warning: 'catalog-log-level catalog-log-level--warning',
  error: 'catalog-log-level catalog-log-level--error',
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

function lineToneClass(tone: SyncDetailLine['tone']) {
  if (tone === 'good') return 'catalog-log-detail catalog-log-detail--good';
  if (tone === 'warn') return 'catalog-log-detail catalog-log-detail--warn';
  if (tone === 'info') return 'catalog-log-detail catalog-log-detail--info';
  return 'catalog-log-detail catalog-log-detail--neutral';
}

function chipToneClass(tone: SyncDetailLine['tone']) {
  if (tone === 'good') return 'catalog-log-chip catalog-log-chip--good';
  if (tone === 'warn') return 'catalog-log-chip catalog-log-chip--warn';
  if (tone === 'info') return 'catalog-log-chip catalog-log-chip--info';
  return 'catalog-log-chip catalog-log-chip--neutral';
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
  const summary = buildSyncLogSummary(message, details);

  if (compact) {
    // Zwarty pasek: tytuł + chipy z liczbami, bez opisów każdej linijki — to
    // samo co pełny widok, ale bez rozciągania strony na cały ekran. Notatki i
    // surowy raport zostają w trybie pełnym (np. w "Ostatnie zdarzenia").
    return (
      <div className="mt-1.5 space-y-2">
        <p className="text-sm text-slate-700 dark:text-slate-300">{summary.body}</p>
        {summary.lines.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {summary.lines.map((line) => (
              <span key={line.id} className={`${chipToneClass(line.tone)} rounded-full px-2.5 py-1 text-xs font-medium`}>
                {line.label}:{' '}
                <strong className="font-bold tabular-nums">
                  {typeof line.value === 'number' ? line.value.toLocaleString('pl-PL') : line.value}
                </strong>
              </span>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-3">
      <div>
        <p className="text-sm font-semibold">{summary.title}</p>
        <p className="catalog-log-detail-desc mt-1 text-sm leading-6">{summary.body}</p>
      </div>

      {summary.lines.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide opacity-60">
            Szczegóły przebiegu
          </p>
          <ul className="space-y-2">
            {summary.lines.map((line) => (
              <li key={line.id} className={`rounded-xl px-3 py-2.5 ${lineToneClass(line.tone)}`}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                  <span className="text-sm font-semibold">{line.label}</span>
                  {typeof line.value === 'number' ? (
                    <span className="text-lg font-bold tabular-nums">{line.value.toLocaleString('pl-PL')}</span>
                  ) : (
                    <span className="text-sm font-medium">{line.value}</span>
                  )}
                </div>
                <p className="catalog-log-detail-desc mt-1.5 text-xs leading-relaxed">{line.description}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {summary.notes.length > 0 && (
        <ul className="catalog-log-detail catalog-log-detail--neutral space-y-1 rounded-xl px-3 py-2 text-xs leading-5">
          {summary.notes.map((note) => (
            <li key={note}>• {note}</li>
          ))}
        </ul>
      )}

      {summary.technical && (
        <details className="catalog-log-detail catalog-log-detail--neutral rounded-xl px-3 py-2 text-xs">
          <summary className="cursor-pointer font-semibold">Raport techniczny (surowy)</summary>
          <p className="catalog-log-detail-desc mt-2 whitespace-pre-wrap leading-5">{summary.technical}</p>
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
  const [changes, setChanges] = useState<ProductSyncChange[]>([]);
  const [changesLoading, setChangesLoading] = useState(true);

  useEffect(() => {
    const refresh = () => setLogs(listCatalogLogs(userId));
    refresh();
    return subscribeCatalogLogs(refresh);
  }, [userId]);

  async function refreshLatest() {
    setRefreshing(true);
    try {
      const [latestSync, recentChanges] = await Promise.all([
        getLatestStockSync(),
        getRecentProductSyncChanges({ limit: 1500 }),
      ]);
      setLatest(latestSync);
      setChanges(recentChanges);
    } finally {
      setRefreshing(false);
      setChangesLoading(false);
    }
  }

  useEffect(() => {
    void refreshLatest();
  }, []);

  // Ten sam przebieg sync jest już pokazany w karcie "Ostatni wynik sync" wyżej
  // — nie powielamy go jeszcze raz jako pierwszy wpis na liście poniżej.
  const latestLocalId = latest ? `sync-done-${latest.id}` : null;
  const dedupedLogs = useMemo(
    () => (latestLocalId ? logs.filter((entry) => entry.id !== latestLocalId) : logs),
    [logs, latestLocalId],
  );

  const filteredLogs = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return dedupedLogs;
    return dedupedLogs.filter((entry) =>
      [entry.title, entry.message, entry.source, JSON.stringify(entry.details ?? {})]
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }, [dedupedLogs, query]);

  const filteredChanges = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return changes;
    return changes.filter((c) =>
      [c.sku, c.display_name ?? '', PRODUCT_SYNC_CHANGE_FIELD_LABELS[c.field]]
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }, [changes, query]);

  // Każdy przebieg syncu = osobna, zwijalna sekcja — starsze przebiegi nie
  // znikają pod nowszym, tylko czekają zwinięte niżej na liście.
  const changeRuns = useMemo(() => groupProductSyncChangesByRun(filteredChanges), [filteredChanges]);
  const [expandedRuns, setExpandedRuns] = useState<Set<string>>(new Set());
  const isSearching = query.trim().length > 0;

  // Domyslnie tylko najnowszy przebieg jest rozwiniety — ustawiamy to raz, gdy
  // dane sie zaladuja (pozniejsze toggle przez usera juz tego nie nadpisuje).
  const [defaultRunApplied, setDefaultRunApplied] = useState(false);
  useEffect(() => {
    if (defaultRunApplied || changeRuns.length === 0) return;
    setExpandedRuns(new Set([changeRuns[0].changedAt]));
    setDefaultRunApplied(true);
  }, [changeRuns, defaultRunApplied]);

  function toggleRun(changedAt: string) {
    setExpandedRuns((prev) => {
      const next = new Set(prev);
      if (next.has(changedAt)) next.delete(changedAt);
      else next.add(changedAt);
      return next;
    });
  }

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
              Każdy wpis pokazuje pełny kontekst: co się zmieniło, ile pozycji wymaga uwagi i gdzie
              szukać raportów na serwerze. Surowy raport techniczny jest na dole do rozwinięcia.
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
                {logs.length} zapisanych wpisów na tym urządzeniu. Nowe wpisy pojawiają się po
                zakończonym syncu z przycisku w katalogu.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
              <ListTree className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-base font-bold text-slate-950 dark:text-slate-50">
                Szczegółowe zmiany produktów
              </h3>
              <p className="text-sm text-slate-700 dark:text-slate-300">
                Który SKU, które pole (stan / cena) i jaka była stara i nowa wartość — z
                ostatnich przebiegów syncu WAPRO. Filtruj wyszukiwarką obok po SKU lub nazwie.
              </p>
            </div>
          </div>
          <label className="relative block w-full sm:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Szukaj po SKU, nazwie, treści logu..."
              className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm font-medium text-slate-950 outline-none placeholder:text-slate-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50 dark:placeholder:text-slate-400"
            />
          </label>
        </div>

        <div className="max-h-[32rem] overflow-y-auto">
          {changesLoading ? (
            <p className="p-8 text-center text-sm text-slate-600 dark:text-slate-400">
              Wczytuję zmiany…
            </p>
          ) : filteredChanges.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm font-semibold text-slate-950 dark:text-slate-50">
                Brak zarejestrowanych zmian
              </p>
              <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                {changes.length === 0
                  ? 'Jeszcze żaden sync nie zapisał szczegółowego logu (albo migration-product-sync-changes.sql nie została uruchomiona w Supabase).'
                  : 'Nic nie pasuje do wyszukiwania.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {changeRuns.map((run) => {
                const expanded = isSearching || expandedRuns.has(run.changedAt);
                return (
                  <div key={run.changedAt}>
                    <button
                      type="button"
                      onClick={() => toggleRun(run.changedAt)}
                      className="catalog-log-row flex w-full items-center gap-2 px-4 py-2.5 text-left"
                    >
                      {expanded ? (
                        <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" />
                      ) : (
                        <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" />
                      )}
                      <span className="text-sm font-semibold text-slate-950 dark:text-slate-50">
                        Sync {formatDate(run.changedAt)}
                      </span>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                        {run.items.length} {run.items.length === 1 ? 'zmiana' : 'zmian'}
                      </span>
                    </button>
                    {expanded && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                          <thead className="bg-slate-50 dark:bg-slate-900">
                            <tr className="text-[11px] uppercase tracking-wide text-slate-600 dark:text-slate-400">
                              <th className="px-4 py-2 font-semibold">SKU / produkt</th>
                              <th className="px-4 py-2 font-semibold">Pole</th>
                              <th className="px-4 py-2 font-semibold text-right">Było → Jest</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                            {run.items.map((c) => (
                              <tr key={c.id} className="catalog-log-row">
                                <td className="px-4 py-2.5">
                                  <p className="font-mono text-xs text-emerald-700 dark:text-emerald-300">
                                    {c.sku}
                                  </p>
                                  {c.display_name && (
                                    <p className="mt-0.5 max-w-xs truncate text-xs text-slate-600 dark:text-slate-400">
                                      {c.display_name}
                                    </p>
                                  )}
                                </td>
                                <td className="px-4 py-2.5 text-xs text-slate-700 dark:text-slate-300">
                                  {PRODUCT_SYNC_CHANGE_FIELD_LABELS[c.field]}
                                </td>
                                <td className="px-4 py-2.5 text-right text-xs tabular-nums">
                                  <span className="text-slate-500 dark:text-slate-400">
                                    {formatChangeValue(c.field, c.old_value)}
                                  </span>
                                  <ArrowRight className="mx-1.5 inline h-3 w-3 text-slate-400" />
                                  <span className="font-semibold text-slate-950 dark:text-slate-50">
                                    {formatChangeValue(c.field, c.new_value)}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
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
                      <FriendlySyncBlock message={entry.message} details={entry.details} compact />
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
