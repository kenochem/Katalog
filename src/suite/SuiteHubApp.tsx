import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  ExternalLink,
  FileText,
  Home,
  Info,
  Loader2,
  RefreshCw,
  Settings2,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { roleCan } from '../lib/roles';
import { canAccessAdminPanel } from '../lib/adminAccess';
import { LoginGate } from '../components/LoginGate';
import { AppProfileMenu } from '../components/AppProfileMenu';
import { ThemeSwitcher } from '../components/ThemeSwitcher';
import { HubGuideKenochemView } from '../components/hub/HubGuideKenochemView';
import {
  buildFeed,
  fetchMyDocsStats,
  fetchSyncStats,
  formatAgo,
  type FeedLevel,
  type SuiteFeedItem,
  type SuiteMyDocsStats,
  type SuiteSyncStats,
  type SyncRunInfo,
} from './suiteData';
import { toolsForRole, toolUrl, type SuiteTool } from './suiteTools';

const AdminHubPanel = lazy(() =>
  import('../components/AdminHubPanel').then((m) => ({ default: m.AdminHubPanel })),
);

type SuiteView = 'start' | 'guide' | 'admin';

const FEED_STYLE: Record<FeedLevel, { box: string; icon: typeof Info }> = {
  danger: { box: 'border-red-500/40 bg-red-500/[0.07] text-red-300', icon: XCircle },
  warn: { box: 'border-amber-500/40 bg-amber-500/[0.07] text-amber-300', icon: AlertTriangle },
  info: { box: 'border-brand-500/30 bg-brand-500/[0.06] text-brand-300', icon: Info },
};

function money(n: number): string {
  return n.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function syncLabel(run?: SyncRunInfo): { text: string; tone: string } {
  if (!run) return { text: 'brak danych', tone: 'text-slate-500' };
  if (run.status === 'error') return { text: 'błąd', tone: 'text-red-400' };
  if (run.status === 'done') return { text: 'OK', tone: 'text-emerald-400' };
  return { text: run.status === 'running' ? 'trwa' : 'w kolejce', tone: 'text-amber-400' };
}

function ToolTile({ tool }: { tool: SuiteTool }) {
  const body = (
    <>
      <img src={tool.icon} alt="" className="h-12 w-12 shrink-0 rounded-xl" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-base font-semibold text-slate-100">
          {tool.name}
          {tool.soon ? (
            <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-400">
              wkrótce
            </span>
          ) : (
            <ExternalLink className="h-3.5 w-3.5 text-slate-500" />
          )}
        </span>
        <span className="block text-xs font-medium text-brand-300">{tool.tagline}</span>
        <span className="mt-1 block text-xs leading-relaxed text-slate-400">
          {tool.description}
        </span>
      </span>
    </>
  );
  const cls =
    'flex items-start gap-3 rounded-2xl border border-slate-800 bg-slate-900/80 p-4 text-left transition';
  if (tool.soon) return <div className={`${cls} opacity-60`}>{body}</div>;
  return (
    <a
      href={tool.url}
      className={`${cls} hover:border-brand-500/50 hover:bg-slate-800/80`}
      rel="noopener"
    >
      {body}
    </a>
  );
}

function StatCard({
  label,
  value,
  sub,
  tone = 'text-slate-100',
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 px-3.5 py-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-0.5 text-xl font-bold ${tone}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

function StartView() {
  const { role, mode, displayLabel } = useAuth();
  const signedIn = mode === 'signed_in';
  const tools = useMemo(() => toolsForRole(role), [role]);
  const showMyDocs = signedIn && roleCan(role, 'useCrm');

  const [sync, setSync] = useState<SuiteSyncStats | null>(null);
  const [docs, setDocs] = useState<SuiteMyDocsStats | null>(null);
  const [feed, setFeed] = useState<SuiteFeedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshedAt, setRefreshedAt] = useState<string>();

  async function load() {
    if (!signedIn) return;
    setLoading(true);
    try {
      const [s, d] = await Promise.all([
        fetchSyncStats(),
        showMyDocs ? fetchMyDocsStats() : Promise.resolve(null),
      ]);
      setSync(s);
      setDocs(d);
      setFeed(await buildFeed(role, s, d));
      setRefreshedAt(new Date().toISOString());
    } catch (err) {
      console.warn('Suite stats', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn, showMyDocs]);

  const stock = syncLabel(sync?.stock);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-5 sm:px-6">
      <div>
        <h1 className="text-xl font-bold text-slate-50">
          {signedIn ? `Cześć, ${displayLabel}` : 'Kenochem Suite'}
        </h1>
        <p className="text-sm text-slate-400">
          Wybierz narzędzie. Każde działa jako osobna aplikacja, a logujesz się tym samym kontem.
        </p>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tools.map((t) => (
          <ToolTile key={t.id} tool={t} />
        ))}
      </section>

      {signedIn && (
        <>
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                Powiadomienia z narzędzi
              </h2>
              <button
                type="button"
                onClick={() => void load()}
                disabled={loading}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                title={refreshedAt ? `Odświeżono ${formatAgo(refreshedAt)}` : undefined}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                Odśwież
              </button>
            </div>
            {feed.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-700 px-4 py-5 text-center text-sm text-slate-500">
                {loading ? 'Sprawdzam…' : 'Brak nowych powiadomień — wszystko w porządku.'}
              </p>
            ) : (
              <ul className="space-y-2">
                {feed.map((item) => {
                  const { box, icon: Icon } = FEED_STYLE[item.level];
                  return (
                    <li key={item.id}>
                      <a
                        href={toolUrl(item.toolId)}
                        className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 ${box}`}
                      >
                        <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium">{item.title}</span>
                          {item.detail && (
                            <span className="block text-xs opacity-80">{item.detail}</span>
                          )}
                        </span>
                        {item.at && (
                          <span className="shrink-0 text-[11px] opacity-70">
                            {formatAgo(item.at)}
                          </span>
                        )}
                      </a>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
              Stan syncu WAPRO
            </h2>
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              <StatCard
                label="Stany i ceny"
                value={stock.text}
                tone={stock.tone}
                sub={sync?.stock ? formatAgo(sync.stock.finishedAt ?? sync.stock.requestedAt) : undefined}
              />
              <StatCard
                label="Sprzedaż (Ops)"
                value={syncLabel(sync?.sales).text}
                tone={syncLabel(sync?.sales).tone}
                sub={sync?.sales ? formatAgo(sync.sales.finishedAt ?? sync.sales.requestedAt) : undefined}
              />
              <StatCard
                label="Zmiany (24 h)"
                value={String(sync?.changesLast24h ?? 0)}
                sub={`ostatnia: ${formatAgo(sync?.lastChangeAt)}`}
              />
              <StatCard
                label="Nowe produkty (7 dni)"
                value={String(sync?.newProducts7d ?? 0)}
                sub="dopisane z Mag"
              />
            </div>
          </section>

          {showMyDocs && docs && (
            <section>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
                Moje oferty i zamówienia (ten miesiąc)
              </h2>
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                <StatCard label="Oferty PDF" value={String(docs.quotesMonth)} />
                <StatCard label="Wartość ofert (netto)" value={`${money(docs.quotesNetMonth)} zł`} />
                <StatCard label="Zamówienia" value={String(docs.ordersMonth)} />
                <StatCard
                  label="Zaległe zadania"
                  value={String(docs.overdueTasks)}
                  tone={docs.overdueTasks > 0 ? 'text-amber-400' : 'text-slate-100'}
                />
              </div>
              {docs.recentQuotes.length > 0 && (
                <ul className="mt-3 divide-y divide-slate-800 rounded-xl border border-slate-800 bg-slate-900/70">
                  {docs.recentQuotes.map((q) => (
                    <li key={q.id}>
                      <a
                        href={toolUrl('sell')}
                        className="flex items-center gap-3 px-3.5 py-2.5 hover:bg-slate-800/60"
                      >
                        <FileText className="h-4 w-4 shrink-0 text-brand-400" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-slate-100">
                            {q.number ? `${q.number} · ` : ''}
                            {q.client}
                          </span>
                          <span className="block text-xs text-slate-500">
                            {formatAgo(q.createdAt)}
                          </span>
                        </span>
                        {q.totalNet != null && (
                          <span className="shrink-0 text-sm font-medium text-slate-200">
                            {money(q.totalNet)} zł
                          </span>
                        )}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </>
      )}

      {!signedIn && (
        <p className="rounded-xl border border-dashed border-slate-700 px-4 py-4 text-sm text-slate-400">
          Jesteś w trybie gościa — widzisz katalog i przewodnik. Zaloguj się, żeby zobaczyć
          pozostałe narzędzia, powiadomienia i statystyki.
        </p>
      )}
    </div>
  );
}

export function SuiteHubApp() {
  const { mode, role } = useAuth();
  const [view, setView] = useState<SuiteView>('start');
  const canAdmin = canAccessAdminPanel(role);

  if (mode === 'loading') {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-brand-400" />
      </div>
    );
  }
  if (mode === 'gate') return <LoginGate />;

  const tab = (id: SuiteView, label: string, icon: React.ReactNode) => (
    <button
      type="button"
      onClick={() => setView(id)}
      className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition ${
        view === id
          ? 'bg-brand-500/15 text-brand-300'
          : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
      }`}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div className="flex min-h-dvh flex-col bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/95 px-4 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 py-2.5">
          <div className="flex min-w-0 items-center gap-3">
            <img src="/icons/suite-icon-192.png" alt="" className="h-9 w-9 rounded-xl" />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-100">Kenochem Suite</p>
              <p className="truncate text-[11px] text-slate-500">Centrum narzędzi firmy</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <ThemeSwitcher />
            <AppProfileMenu
              onOpenAdmin={() => setView('admin')}
              adminActive={view === 'admin'}
            />
          </div>
        </div>
        <nav className="mx-auto flex w-full max-w-6xl gap-1 pb-2">
          {tab('start', 'Start', <Home className="h-4 w-4" />)}
          {tab('guide', 'Przewodnik', <BookOpen className="h-4 w-4" />)}
          {canAdmin && tab('admin', 'Admin', <Settings2 className="h-4 w-4" />)}
        </nav>
      </header>

      <main className="flex min-h-0 flex-1 flex-col">
        {view === 'start' && <StartView />}
        {view === 'guide' && <HubGuideKenochemView />}
        {view === 'admin' && canAdmin && (
          <div className="mx-auto w-full max-w-6xl flex-1 p-4">
            <Suspense
              fallback={
                <div className="flex justify-center py-10">
                  <Loader2 className="h-6 w-6 animate-spin text-brand-400" />
                </div>
              }
            >
              <AdminHubPanel onBack={() => setView('start')} />
            </Suspense>
          </div>
        )}
      </main>
    </div>
  );
}
