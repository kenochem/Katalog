import { supabase, isSupabaseConfigured } from './supabase';
import { APP_PRODUCT } from '../app/moduleRegistry';

/**
 * Dziennik aktywności (audit log) — kto, co i kiedy zmienił. Zapis jest „strzel i zapomnij”:
 * błąd logowania nigdy nie blokuje właściwej operacji. Odczyt tylko dla admina (RLS).
 */

export interface AuditActor {
  id: string;
  label: string;
  role: string;
}

export interface AuditChange {
  from?: unknown;
  to?: unknown;
}

export interface AuditDevice {
  browser?: string;
  os?: string;
  type?: string;
  screen?: string;
  lang?: string;
  tz?: string;
  pwa?: boolean;
  ua?: string;
}

export interface AuditEntry {
  ip?: string;
  device?: AuditDevice;
  id: string;
  createdAt: string;
  userId: string;
  userLabel: string;
  userRole: string;
  app: string;
  action: string;
  entityType: string;
  entityId: string;
  entityLabel: string;
  summary: string;
  changes?: Record<string, AuditChange>;
}

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  'auth.login': 'Logowanie',
  'product.create': 'Dodanie produktu',
  'product.update': 'Edycja produktu',
  'product.delete': 'Usunięcie produktu',
  'product.stock': 'Zmiana stanu',
  'product.price': 'Zmiana ceny',
  'product.image': 'Zdjęcia produktu',
  'product.category': 'Kategoria / producent',
  'kit.save': 'Zapis zestawu',
  'kit.delete': 'Usunięcie zestawu',
  'user.create': 'Nowe konto',
  'user.update': 'Zmiana konta',
  'user.password': 'Reset hasła',
  'roles.matrix': 'Uprawnienia ról',
};

let actor: AuditActor | null = null;

export function setAuditActor(next: AuditActor | null): void {
  actor = next;
}

/** Dane urządzenia z przeglądarki (IP ustala serwer — patrz audit_log_write). */
export function collectDeviceInfo(): AuditDevice {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /OPR\//.test(ua)
      ? 'Opera'
      : /Firefox\//.test(ua)
        ? 'Firefox'
        : /Chrome\//.test(ua)
          ? 'Chrome'
          : /Safari\//.test(ua)
            ? 'Safari'
            : 'inna';
  const os = /Windows NT/.test(ua)
    ? 'Windows'
    : /Android/.test(ua)
      ? 'Android'
      : /iPhone|iPad|iPod/.test(ua)
        ? 'iOS'
        : /Mac OS X/.test(ua)
          ? 'macOS'
          : /Linux/.test(ua)
            ? 'Linux'
            : 'inny';
  const type = /Mobi|Android|iPhone|iPod/.test(ua) ? 'telefon' : /iPad|Tablet/.test(ua) ? 'tablet' : 'komputer';
  let pwa = false;
  try {
    pwa = window.matchMedia('(display-mode: standalone)').matches;
  } catch {
    /* ignore */
  }
  let tz = '';
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    /* ignore */
  }
  return {
    browser,
    os,
    type,
    screen: typeof screen !== 'undefined' ? `${screen.width}x${screen.height}` : undefined,
    lang: typeof navigator !== 'undefined' ? navigator.language : undefined,
    tz,
    pwa,
    ua: ua.slice(0, 300),
  };
}

export function hasAuditActor(): boolean {
  return actor != null;
}

export interface AuditInput {
  action: string;
  entityType?: string;
  entityId?: string;
  entityLabel?: string;
  summary?: string;
  changes?: Record<string, AuditChange>;
}

function clip(value: unknown): unknown {
  if (typeof value === 'string') return value.length > 300 ? `${value.slice(0, 300)}…` : value;
  if (value && typeof value === 'object') {
    const json = JSON.stringify(value);
    return json.length > 300 ? `${json.slice(0, 300)}…` : value;
  }
  return value;
}

export function logAudit(input: AuditInput): void {
  if (!isSupabaseConfigured || !supabase || !actor) return;
  // Zapis przez funkcję SQL: user_id/nazwa/rola z sesji, IP z nagłówków żądania (serwer).
  const row = {
    p_app: APP_PRODUCT,
    p_action: input.action,
    p_entity_type: input.entityType ?? '',
    p_entity_id: input.entityId ?? '',
    p_entity_label: input.entityLabel ?? '',
    p_summary: input.summary ?? '',
    p_device: input.action === 'auth.login' ? collectDeviceInfo() : null,
    p_changes: input.changes
      ? Object.fromEntries(
          Object.entries(input.changes).map(([k, v]) => [
            k,
            { from: clip(v.from), to: clip(v.to) },
          ]),
        )
      : null,
  };
  void supabase.rpc('audit_log_write', row).then(({ error }) => {
      if (error) console.warn('audit_log', error.message);
    });
}

/** Porównuje dwa obiekty po wskazanych kluczach; zwraca tylko realne różnice. */
export function diffFields(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown>,
): Record<string, AuditChange> {
  const out: Record<string, AuditChange> = {};
  for (const [key, to] of Object.entries(after)) {
    const from = before?.[key];
    if (JSON.stringify(from ?? null) !== JSON.stringify(to ?? null)) {
      out[key] = { from, to };
    }
  }
  return out;
}

function mapRow(r: Record<string, unknown>): AuditEntry {
  return {
    id: String(r.id),
    createdAt: String(r.created_at ?? ''),
    userId: String(r.user_id ?? ''),
    userLabel: String(r.user_label ?? ''),
    userRole: String(r.user_role ?? ''),
    app: String(r.app ?? ''),
    action: String(r.action ?? ''),
    entityType: String(r.entity_type ?? ''),
    entityId: String(r.entity_id ?? ''),
    entityLabel: String(r.entity_label ?? ''),
    summary: String(r.summary ?? ''),
    ip: r.ip ? String(r.ip) : undefined,
    device: r.device && typeof r.device === 'object' ? (r.device as AuditDevice) : undefined,
    changes:
      r.changes && typeof r.changes === 'object'
        ? (r.changes as Record<string, AuditChange>)
        : undefined,
  };
}

export interface AuditQuery {
  userId?: string;
  action?: string;
  search?: string;
  since?: string;
  limit?: number;
  before?: string;
}

export async function fetchAuditLog(q: AuditQuery = {}): Promise<AuditEntry[]> {
  if (!supabase) return [];
  let query = supabase
    .from('audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(q.limit ?? 200);
  if (q.userId) query = query.eq('user_id', q.userId);
  if (q.action) query = query.eq('action', q.action);
  if (q.since) query = query.gte('created_at', q.since);
  if (q.before) query = query.lt('created_at', q.before);
  const term = q.search?.trim().replace(/[%,()]/g, ' ');
  if (term) {
    query = query.or(
      `entity_id.ilike.%${term}%,entity_label.ilike.%${term}%,summary.ilike.%${term}%`,
    );
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
}
