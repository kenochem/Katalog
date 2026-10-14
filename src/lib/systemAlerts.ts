import { useCallback, useSyncExternalStore } from 'react';
import { supabase } from './supabase';

/** Alerty systemowe (tabela system_alerts; tworzy je funkcja `system-alerts`). */

export type AlertLevel = 'info' | 'warning' | 'error';

export interface SystemAlert {
  id: string;
  key: string;
  level: AlertLevel;
  title: string;
  message: string;
  firstSeen: string;
  lastSeen: string;
  ackBy: string | null;
  ackAt: string | null;
}

const LEVEL_ORDER: Record<AlertLevel, number> = { error: 0, warning: 1, info: 2 };

export async function fetchActiveAlerts(): Promise<SystemAlert[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('system_alerts').select('*').is('resolved_at', null);
  if (error) return [];
  return ((data ?? []) as Record<string, unknown>[])
    .map((r) => ({
      id: String(r.id),
      key: String(r.key),
      level: (['info', 'warning', 'error'].includes(String(r.level)) ? r.level : 'error') as AlertLevel,
      title: String(r.title ?? ''),
      message: String(r.message ?? ''),
      firstSeen: String(r.first_seen ?? ''),
      lastSeen: String(r.last_seen ?? ''),
      ackBy: r.ack_by ? String(r.ack_by) : null,
      ackAt: r.ack_at ? String(r.ack_at) : null,
    }))
    .sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level] || b.lastSeen.localeCompare(a.lastSeen));
}

export async function ackAlerts(ids: string[], label: string): Promise<void> {
  if (!supabase || ids.length === 0) return;
  await supabase
    .from('system_alerts')
    .update({ ack_by: label || 'użytkownik', ack_at: new Date().toISOString() })
    .in('id', ids);
}

/** Zleca serwerowi ocenę stanu systemu (tworzy / zamyka alerty, wysyła Discord). Błędy ignorujemy. */
export async function runAlertCheck(): Promise<void> {
  if (!supabase) return;
  try {
    await supabase.functions.invoke('system-alerts', { body: { action: 'check' } });
  } catch {
    /* funkcja niewdrożona / brak sieci */
  }
}

// Jeden wspólny mechanizm dla wszystkich użytkowników hooka (baner + strona Status systemów):
// jedno sprawdzanie co ~2 min niezależnie od liczby otwartych widoków.
let sharedAlerts: SystemAlert[] = [];
const alertListeners = new Set<() => void>();
let alertTimer: ReturnType<typeof setInterval> | null = null;
let alertInflight: Promise<void> | null = null;

function emitAlerts() {
  alertListeners.forEach((fn) => fn());
}

async function refreshSharedAlerts(): Promise<void> {
  if (alertInflight) return alertInflight;
  alertInflight = (async () => {
    await runAlertCheck();
    sharedAlerts = await fetchActiveAlerts();
    emitAlerts();
  })().finally(() => {
    alertInflight = null;
  });
  return alertInflight;
}

function onAlertsVisible() {
  if (document.visibilityState === 'visible') void refreshSharedAlerts();
}

function subscribeAlerts(fn: () => void): () => void {
  alertListeners.add(fn);
  if (alertListeners.size === 1) {
    void refreshSharedAlerts();
    alertTimer = setInterval(() => void refreshSharedAlerts(), 120_000);
    document.addEventListener('visibilitychange', onAlertsVisible);
  }
  return () => {
    alertListeners.delete(fn);
    if (alertListeners.size === 0) {
      if (alertTimer) clearInterval(alertTimer);
      alertTimer = null;
      document.removeEventListener('visibilitychange', onAlertsVisible);
    }
  };
}

const NO_ALERTS: SystemAlert[] = [];

/** Hook: aktywne alerty (wspólne sprawdzanie na serwerze co ~2 min). */
export function useSystemAlerts(enabled: boolean): { alerts: SystemAlert[]; refresh: () => Promise<void> } {
  const alerts = useSyncExternalStore(
    enabled ? subscribeAlerts : () => () => {},
    () => (enabled ? sharedAlerts : NO_ALERTS),
    () => NO_ALERTS,
  );
  const refresh = useCallback(async () => {
    if (enabled) await refreshSharedAlerts();
  }, [enabled]);
  return { alerts, refresh };
}

// ---------------------------------------------------------------------------------------------
// Historia dostępności agentów
// ---------------------------------------------------------------------------------------------

export const BUCKET_MS = 15 * 60_000;

/** Pobiera przedziały 15-minutowe, w których agent dawał znak życia (ostatnie `days` dni). */
export async function fetchUptime(days: number): Promise<Map<string, Set<number>>> {
  const out = new Map<string, Set<number>>();
  if (!supabase) return out;
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  for (let from = 0; from < 20_000; from += 1000) {
    const { data, error } = await supabase
      .from('agent_uptime')
      .select('agent,bucket')
      .gte('bucket', since)
      .order('bucket', { ascending: true })
      .range(from, from + 999);
    if (error) break;
    for (const r of data ?? []) {
      const agent = String((r as { agent: string }).agent);
      const t = new Date(String((r as { bucket: string }).bucket)).getTime();
      if (!Number.isFinite(t)) continue;
      let set = out.get(agent);
      if (!set) {
        set = new Set();
        out.set(agent, set);
      }
      set.add(Math.round(t / BUCKET_MS) * BUCKET_MS);
    }
    if (!data || data.length < 1000) break;
  }
  return out;
}
