import { supabase } from '../lib/supabase';
import type { AppRole } from '../lib/roles';
import { roleCan } from '../lib/roles';
import type { SuiteTool } from './suiteTools';

/** Lekkie zapytania (liczniki i ostatnie wiersze) — Suite nie ładuje katalogu produktów. */

export type SyncRunStatus = 'pending' | 'running' | 'done' | 'error';

export interface SyncRunInfo {
  status: SyncRunStatus;
  requestedAt: string;
  finishedAt?: string;
  message?: string;
}

export interface SuiteSyncStats {
  stock?: SyncRunInfo;
  sales?: SyncRunInfo;
  lastChangeAt?: string;
  changesLast24h: number;
  newProducts7d: number;
}

export interface SuiteMyDocsStats {
  quotesMonth: number;
  ordersMonth: number;
  quotesNetMonth: number;
  recentQuotes: {
    id: string;
    number?: string;
    client: string;
    totalNet?: number;
    createdAt: string;
  }[];
  overdueTasks: number;
}

export type FeedLevel = 'danger' | 'warn' | 'info';

export interface SuiteFeedItem {
  id: string;
  level: FeedLevel;
  title: string;
  detail?: string;
  toolId: SuiteTool['id'];
  at?: string;
}

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

async function lastRun(table: 'stock_sync_requests' | 'sales_sync_requests'): Promise<SyncRunInfo | undefined> {
  if (!supabase) return undefined;
  const { data, error } = await supabase
    .from(table)
    .select('status,requested_at,finished_at,message')
    .order('requested_at', { ascending: false })
    .limit(1);
  if (error || !data?.length) return undefined;
  const r = data[0] as Record<string, unknown>;
  return {
    status: (r.status as SyncRunStatus) ?? 'pending',
    requestedAt: String(r.requested_at ?? ''),
    finishedAt: r.finished_at ? String(r.finished_at) : undefined,
    message: r.message ? String(r.message) : undefined,
  };
}

export async function fetchSyncStats(): Promise<SuiteSyncStats> {
  const empty: SuiteSyncStats = { changesLast24h: 0, newProducts7d: 0 };
  if (!supabase) return empty;
  const sb = supabase;
  const [stock, sales, lastChange, changes24, newProducts] = await Promise.all([
    lastRun('stock_sync_requests'),
    lastRun('sales_sync_requests'),
    sb
      .from('product_sync_changes')
      .select('changed_at')
      .order('changed_at', { ascending: false })
      .limit(1),
    sb
      .from('product_sync_changes')
      .select('id', { count: 'exact', head: true })
      .gte('changed_at', isoDaysAgo(1)),
    sb
      .from('products')
      .select('id', { count: 'exact', head: true })
      .contains('product_meta', { waproImport: true })
      .gte('product_meta->>waproImportedAt', isoDaysAgo(7)),
  ]);
  return {
    stock,
    sales,
    lastChangeAt: lastChange.data?.[0]?.changed_at
      ? String(lastChange.data[0].changed_at)
      : undefined,
    changesLast24h: changes24.count ?? 0,
    newProducts7d: newProducts.count ?? 0,
  };
}

/** Własne oferty/zamówienia (RLS zwraca tylko wiersze zalogowanego) i zaległe zadania CRM. */
export async function fetchMyDocsStats(): Promise<SuiteMyDocsStats> {
  const empty: SuiteMyDocsStats = {
    quotesMonth: 0,
    ordersMonth: 0,
    quotesNetMonth: 0,
    recentQuotes: [],
    overdueTasks: 0,
  };
  if (!supabase) return empty;
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const today = new Date().toISOString().slice(0, 10);

  const [month, recent, tasks] = await Promise.all([
    supabase
      .from('crm_orders')
      .select('kind,quote_total_net')
      .gte('created_at', monthStart.toISOString()),
    supabase
      .from('crm_orders')
      .select('id,client_name,quote_number,quote_total_net,created_at')
      .eq('kind', 'quote')
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('crm_tasks')
      .select('id', { count: 'exact', head: true })
      .eq('done', false)
      .lt('due_date', today),
  ]);

  const rows = (month.data ?? []) as { kind: string; quote_total_net: number | null }[];
  const quotes = rows.filter((r) => r.kind === 'quote');
  return {
    quotesMonth: quotes.length,
    ordersMonth: rows.length - quotes.length,
    quotesNetMonth: quotes.reduce((s, r) => s + (Number(r.quote_total_net) || 0), 0),
    recentQuotes: ((recent.data ?? []) as Record<string, unknown>[]).map((r) => ({
      id: String(r.id),
      number: r.quote_number ? String(r.quote_number) : undefined,
      client: String(r.client_name || '(bez klienta)'),
      totalNet: r.quote_total_net != null ? Number(r.quote_total_net) : undefined,
      createdAt: String(r.created_at ?? ''),
    })),
    overdueTasks: tasks.count ?? 0,
  };
}

/** Zlecenia „zamówienie → WAPRO” czekające lub zakończone błędem (admin). */
async function fetchWaproOrderIssues(): Promise<{ pending: number; error: number }> {
  if (!supabase) return { pending: 0, error: 0 };
  const [pending, error] = await Promise.all([
    supabase
      .from('wapro_order_requests')
      .select('id', { count: 'exact', head: true })
      .in('status', ['pending', 'running'])
      .lt('requested_at', new Date(Date.now() - 15 * 60_000).toISOString()),
    supabase
      .from('wapro_order_requests')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'error')
      .gte('requested_at', isoDaysAgo(7)),
  ]);
  return { pending: pending.count ?? 0, error: error.count ?? 0 };
}

/**
 * Zbiorcze powiadomienia z narzędzi — wyliczane z bazy (a nie z lokalnego stanu
 * poszczególnych aplikacji, bo każda ma własny origin i własny localStorage).
 */
export async function buildFeed(
  role: AppRole,
  sync: SuiteSyncStats,
  docs: SuiteMyDocsStats | null,
): Promise<SuiteFeedItem[]> {
  const items: SuiteFeedItem[] = [];
  const now = Date.now();

  for (const [kind, run] of [
    ['Stany/ceny', sync.stock],
    ['Sprzedaż', sync.sales],
  ] as const) {
    if (!run) continue;
    const age = now - new Date(run.requestedAt).getTime();
    if (run.status === 'error') {
      items.push({
        id: `sync-error-${kind}`,
        level: 'danger',
        title: `Sync WAPRO (${kind}) zakończył się błędem`,
        detail: run.message?.slice(0, 160),
        toolId: 'catalog',
        at: run.finishedAt ?? run.requestedAt,
      });
    } else if ((run.status === 'pending' || run.status === 'running') && age > 15 * 60_000) {
      items.push({
        id: `sync-stuck-${kind}`,
        level: 'warn',
        title: `Sync WAPRO (${kind}) czeka ponad 15 min`,
        detail: 'Agent na serwerze WAPRO może nie działać — sprawdź harmonogram i sync.log.',
        toolId: 'catalog',
        at: run.requestedAt,
      });
    }
  }

  if (sync.newProducts7d > 0) {
    items.push({
      id: 'new-products',
      level: 'info',
      title: `Nowe produkty z WAPRO: ${sync.newProducts7d} (7 dni)`,
      detail: 'Do uzupełnienia: zdjęcie, kategoria, opis.',
      toolId: 'catalog',
    });
  }

  if (docs && docs.overdueTasks > 0) {
    items.push({
      id: 'crm-overdue',
      level: 'warn',
      title: `Zaległe zadania CRM: ${docs.overdueTasks}`,
      toolId: 'sell',
    });
  }

  if (roleCan(role, 'manageUsers')) {
    const issues = await fetchWaproOrderIssues();
    if (issues.error > 0) {
      items.push({
        id: 'wapro-orders-error',
        level: 'danger',
        title: `Zamówienia do WAPRO z błędem: ${issues.error}`,
        toolId: 'sell',
      });
    }
    if (issues.pending > 0) {
      items.push({
        id: 'wapro-orders-pending',
        level: 'warn',
        title: `Zamówienia do WAPRO czekają na agenta: ${issues.pending}`,
        detail: 'Agent zamówień nie jest wdrożony lub nie działa.',
        toolId: 'sell',
      });
    }
  }

  const rank: Record<FeedLevel, number> = { danger: 0, warn: 1, info: 2 };
  return items.sort((a, b) => rank[a.level] - rank[b.level]);
}

export function formatAgo(iso?: string): string {
  if (!iso) return 'brak danych';
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return 'brak danych';
  const min = Math.max(0, Math.round((Date.now() - t) / 60_000));
  if (min < 1) return 'przed chwilą';
  if (min < 60) return `${min} min temu`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} godz. temu`;
  const d = Math.round(h / 24);
  return `${d} ${d === 1 ? 'dzień' : 'dni'} temu`;
}
