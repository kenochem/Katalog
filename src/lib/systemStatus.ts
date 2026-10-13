import { supabase } from './supabase';

/**
 * Status systemów i wspólny strumień zdarzeń (Logi → Status systemów).
 * Źródła: zdarzenia agentów (system_events), sygnały „agent żyje” (agent_heartbeats) oraz istniejące
 * tabele — zlecenia stanów i sprzedaży, zamówienia do WAPRO, wysyłki do BaseLinkera, kampanie promocji.
 */

export type SysSource = 'stock' | 'sales' | 'orders' | 'reserved' | 'baselinker' | 'promotions' | 'system';
export type SysLevel = 'info' | 'success' | 'warning' | 'error';

export interface SysEvent {
  id: string;
  at: string;
  source: SysSource;
  level: SysLevel;
  title: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface AgentBeat {
  agent: string;
  lastRunAt: string | null;
  lastOkAt: string | null;
  status: string;
  message: string;
}

export const SOURCE_LABEL: Record<SysSource, string> = {
  stock: 'Stany i ceny',
  sales: 'Sprzedaż',
  orders: 'Zamówienia → WAPRO',
  reserved: 'Rezerwacje',
  baselinker: 'BaseLinker',
  promotions: 'Promocje',
  system: 'System',
};

const KIND_TITLE: Record<string, string> = {
  'sync-auto': 'Automatyczna synchronizacja stanów i cen',
  'sync-manual': 'Synchronizacja stanów i cen (na zlecenie)',
  'sync-error': 'Błąd synchronizacji stanów i cen',
  'sales-sync': 'Synchronizacja sprzedaży',
  'sales-error': 'Błąd synchronizacji sprzedaży',
  'reserved-sync': 'Odczyt rezerwacji (R) z WAPRO',
  'order-states': 'Realizacja zamówień odczytana z WAPRO',
  'promo-apply': 'Start promocji',
  'promo-end': 'Koniec promocji',
};

const BL_FIELD_TITLE: Record<string, string> = {
  stock: 'Wysyłka stanów do BaseLinkera',
  price: 'Wysyłka cen do BaseLinkera',
  'stock+price': 'Wysyłka stanów i cen do BaseLinkera',
  images: 'Dokładanie zdjęć w BaseLinkerze',
  promo: 'Promocje w BaseLinkerze',
};

function toLevel(v: unknown): SysLevel {
  return v === 'success' || v === 'warning' || v === 'error' ? v : 'info';
}

const dayAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

export interface SystemData {
  events: SysEvent[];
  beats: AgentBeat[];
  /** Komunikaty o brakujących tabelach itp. */
  notes: string[];
}

export async function fetchSystemData(days: number): Promise<SystemData> {
  const out: SystemData = { events: [], beats: [], notes: [] };
  if (!supabase) return out;
  const sb = supabase;
  const since = dayAgo(days);
  const missing = new Set<string>();

  async function safe<T>(label: string, run: () => PromiseLike<{ data: T | null; error: { message: string } | null }>) {
    try {
      const { data, error } = await run();
      if (error) {
        missing.add(label);
        return null;
      }
      return data;
    } catch {
      missing.add(label);
      return null;
    }
  }

  const [sysEv, beats, stockReq, salesReq, orderReq, blLog, promos] = await Promise.all([
    safe('system_events', () =>
      sb.from('system_events').select('*').gte('created_at', since).order('created_at', { ascending: false }).limit(600),
    ),
    safe('agent_heartbeats', () => sb.from('agent_heartbeats').select('*')),
    safe('stock_sync_requests', () =>
      sb
        .from('stock_sync_requests')
        .select('id,status,requested_at,finished_at,message,catalog')
        .gte('requested_at', since)
        .order('requested_at', { ascending: false })
        .limit(150),
    ),
    safe('sales_sync_requests', () =>
      sb
        .from('sales_sync_requests')
        .select('id,status,requested_at,finished_at,message')
        .gte('requested_at', since)
        .order('requested_at', { ascending: false })
        .limit(100),
    ),
    safe('wapro_order_requests', () =>
      sb
        .from('wapro_order_requests')
        .select('id,status,requested_at,finished_at,message,wapro_order_number')
        .gte('requested_at', since)
        .order('requested_at', { ascending: false })
        .limit(150),
    ),
    safe('baselinker_sync_log', () =>
      sb.from('baselinker_sync_log').select('*').gte('created_at', since).order('created_at', { ascending: false }).limit(200),
    ),
    safe('promo_campaigns', () =>
      sb.from('promo_campaigns').select('id,name,last_error,updated_at').neq('last_error', '').gte('updated_at', since).limit(50),
    ),
  ]);

  const events: SysEvent[] = [];

  let firstStock = Infinity;
  let firstSales = Infinity;
  for (const r of (sysEv ?? []) as Record<string, unknown>[]) {
    const source = (String(r.source) in SOURCE_LABEL ? r.source : 'system') as SysSource;
    const at = String(r.created_at);
    const t = new Date(at).getTime();
    if (source === 'stock') firstStock = Math.min(firstStock, t);
    if (source === 'sales') firstSales = Math.min(firstSales, t);
    const kind = String(r.kind ?? '');
    events.push({
      id: `ev-${r.id}`,
      at,
      source,
      level: toLevel(r.level),
      title: String(r.title || KIND_TITLE[kind] || kind || 'Zdarzenie'),
      message: String(r.message ?? ''),
      details: (r.details && typeof r.details === 'object' ? r.details : undefined) as Record<string, unknown> | undefined,
    });
  }

  // zlecenia z aplikacji: tylko starsze niż pierwsze zdarzenie agenta (nowsze są już w system_events)
  for (const r of (stockReq ?? []) as Record<string, unknown>[]) {
    const at = String(r.finished_at || r.requested_at);
    const done = r.status === 'done' || r.status === 'error';
    if (done && new Date(at).getTime() >= firstStock) continue;
    events.push({
      id: `ss-${r.id}`,
      at,
      source: 'stock',
      level: r.status === 'error' ? 'error' : r.status === 'done' ? 'success' : 'info',
      title:
        r.status === 'pending' || r.status === 'running'
          ? 'Zlecenie synchronizacji stanów (czeka na agenta)'
          : 'Synchronizacja stanów i cen (na zlecenie)',
      message: String(r.message ?? ''),
    });
  }
  for (const r of (salesReq ?? []) as Record<string, unknown>[]) {
    const at = String(r.finished_at || r.requested_at);
    const done = r.status === 'done' || r.status === 'error';
    if (done && new Date(at).getTime() >= firstSales) continue;
    events.push({
      id: `sa-${r.id}`,
      at,
      source: 'sales',
      level: r.status === 'error' ? 'error' : r.status === 'done' ? 'success' : 'info',
      title: 'Synchronizacja sprzedaży (na zlecenie)',
      message: String(r.message ?? ''),
    });
  }
  for (const r of (orderReq ?? []) as Record<string, unknown>[]) {
    const at = String(r.finished_at || r.requested_at);
    events.push({
      id: `or-${r.id}`,
      at,
      source: 'orders',
      level: r.status === 'error' ? 'error' : r.status === 'done' ? 'success' : 'info',
      title:
        r.status === 'done'
          ? `Zamówienie utworzone w WAPRO${r.wapro_order_number ? ` (${r.wapro_order_number})` : ''}`
          : r.status === 'error'
            ? 'Zamówienie do WAPRO — błąd'
            : 'Zamówienie CRM czeka na agenta',
      message: String(r.message ?? ''),
    });
  }
  for (const r of (blLog ?? []) as Record<string, unknown>[]) {
    const status = String(r.status);
    events.push({
      id: `bl-${r.id}`,
      at: String(r.created_at),
      source: 'baselinker',
      level: status === 'error' ? 'error' : status === 'ok' ? 'success' : 'warning',
      title: `${BL_FIELD_TITLE[String(r.field)] ?? 'BaseLinker'}${r.trigger === 'auto' ? ' (automat)' : ''}`,
      message: [
        r.requested != null ? `Wysłano: ${r.updated ?? 0} z ${r.requested}${r.skipped ? `, pominięto ${r.skipped}` : ''}` : '',
        String(r.note ?? ''),
        r.user_label ? `Kto: ${r.user_label}` : '',
      ]
        .filter(Boolean)
        .join(' · '),
    });
  }
  for (const r of (promos ?? []) as Record<string, unknown>[]) {
    events.push({
      id: `pc-${r.id}`,
      at: String(r.updated_at),
      source: 'promotions',
      level: 'error',
      title: `Promocja „${r.name}” — błąd`,
      message: String(r.last_error ?? ''),
    });
  }

  events.sort((a, b) => b.at.localeCompare(a.at));
  out.events = events;
  out.beats = ((beats ?? []) as Record<string, unknown>[]).map((b) => ({
    agent: String(b.agent),
    lastRunAt: b.last_run_at ? String(b.last_run_at) : null,
    lastOkAt: b.last_ok_at ? String(b.last_ok_at) : null,
    status: String(b.last_status ?? 'ok'),
    message: String(b.message ?? ''),
  }));
  if (missing.has('system_events') || missing.has('agent_heartbeats')) {
    out.notes.push('Brak tabel statusu systemów — uruchom w Supabase plik migration-system-status.sql.');
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Karty statusu
// ---------------------------------------------------------------------------------------------

/** Po ilu minutach bez sygnału agenta pokazujemy ostrzeżenie / alarm. */
export const AGENT_WARN_MIN = 10;
export const AGENT_DOWN_MIN = 30;

export type CardTone = 'ok' | 'warn' | 'down' | 'unknown';

export interface StatusCard {
  id: string;
  label: string;
  hint: string;
  tone: CardTone;
  headline: string;
  lastAt: string | null;
  lastMessage: string;
  runs24h: number;
  problems24h: number;
}

interface CardDef {
  id: string;
  label: string;
  hint: string;
  sources: SysSource[];
  /** Agent, którego sygnał „żyje” dotyczy tej karty (null = brak agenta, np. BaseLinker). */
  agent: 'stock' | 'orders' | null;
  /** Karty bez częstych przebiegów (np. sprzedaż raz dziennie) nie alarmują o ciszy. */
  quietOk?: boolean;
}

export const CARD_DEFS: CardDef[] = [
  { id: 'stock', label: 'Stany i ceny z WAPRO', hint: 'Agent synchronizacji co kilka minut', sources: ['stock'], agent: 'stock' },
  { id: 'sales', label: 'Sprzedaż z WAPRO', hint: 'Odświeżanie statystyk sprzedaży (zwykle raz dziennie)', sources: ['sales'], agent: null, quietOk: true },
  { id: 'orders', label: 'Zamówienia CRM → WAPRO', hint: 'Agent tworzy ZO z koszyka CRM', sources: ['orders'], agent: 'orders', quietOk: true },
  { id: 'reserved', label: 'Rezerwacje (R) i realizacja ZO', hint: 'Odczyt z WAPRO co kilka minut', sources: ['reserved'], agent: 'orders', quietOk: true },
  { id: 'baselinker', label: 'BaseLinker', hint: 'Wysyłki stanów, cen, zdjęć i promocji', sources: ['baselinker'], agent: null, quietOk: true },
  { id: 'promotions', label: 'Promocje', hint: 'Start i koniec kampanii wg dat', sources: ['promotions'], agent: 'orders', quietOk: true },
];

export function minutesSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? Math.max(0, (Date.now() - t) / 60_000) : null;
}

export function formatAgo(iso: string | null | undefined): string {
  const m = minutesSince(iso);
  if (m == null) return 'brak danych';
  if (m < 1) return 'przed chwilą';
  if (m < 60) return `${Math.round(m)} min temu`;
  if (m < 60 * 36) return `${Math.round(m / 60)} godz. temu`;
  return `${Math.round(m / 1440)} dni temu`;
}

export function buildStatusCards(data: SystemData): StatusCard[] {
  const day = Date.now() - 86_400_000;
  return CARD_DEFS.map((def) => {
    const mine = data.events.filter((e) => def.sources.includes(e.source));
    const last = mine.find((e) => e.level !== 'info') ?? mine[0] ?? null;
    const recent = mine.filter((e) => new Date(e.at).getTime() >= day);
    const beat = def.agent ? data.beats.find((b) => b.agent === def.agent) : undefined;
    const beatAge = beat ? minutesSince(beat.lastRunAt) : null;

    let tone: CardTone = 'ok';
    let headline = 'Działa';
    if (def.agent && !beat) {
      tone = 'unknown';
      headline = 'Brak sygnału agenta (jeszcze niewdrożony?)';
    } else if (def.agent && beatAge != null && beatAge >= AGENT_DOWN_MIN) {
      tone = 'down';
      headline = `Brak sygnału od ${Math.round(beatAge)} min — sprawdź serwer WAPRO`;
    } else if (def.agent && beatAge != null && beatAge >= AGENT_WARN_MIN) {
      tone = 'warn';
      headline = `Agent milczy od ${Math.round(beatAge)} min`;
    } else if (last?.level === 'error') {
      tone = 'down';
      headline = 'Ostatni przebieg zakończony błędem';
    } else if (last?.level === 'warning') {
      tone = 'warn';
      headline = 'Ostatni przebieg z ostrzeżeniami';
    } else if (!last) {
      tone = def.quietOk || def.agent ? 'ok' : 'unknown';
      headline = def.quietOk ? 'Brak zdarzeń w wybranym okresie' : 'Brak danych';
    }

    return {
      id: def.id,
      label: def.label,
      hint: def.hint,
      tone,
      headline,
      lastAt: last?.at ?? null,
      lastMessage: last ? last.message || last.title : '',
      runs24h: recent.length,
      problems24h: recent.filter((e) => e.level === 'error' || e.level === 'warning').length,
    };
  });
}
