import { supabase } from './supabase';

export const CRM_TIMELINE_CHANGED = 'katalog-crm-timeline-changed';

export type ClientTimelineKind =
  | 'order'
  | 'note'
  | 'chat'
  | 'invoice'
  | 'inbox';

export interface ClientTimelineEntry {
  id: string;
  clientId: string;
  at: string;
  kind: ClientTimelineKind;
  title: string;
  body?: string;
  actorName?: string;
}

/**
 * Notatki/oś czasu klienta — Supabase (crm_client_notes), prywatne per handlowiec.
 * Cache per-klient w pamieci, zeby listClientTimeline() zostal synchroniczny.
 */
const cacheByClient = new Map<string, ClientTimelineEntry[]>();
const loadedClients = new Set<string>();
const inFlightClients = new Map<string, Promise<void>>();

function mapRow(row: Record<string, unknown>): ClientTimelineEntry {
  return {
    id: String(row.id),
    clientId: String(row.client_id),
    at: String(row.at || row.created_at || ''),
    kind: (row.kind as ClientTimelineKind) || 'note',
    title: String(row.title || ''),
    body: row.body ? String(row.body) : undefined,
    actorName: row.actor_name ? String(row.actor_name) : undefined,
  };
}

async function refreshClient(clientId: string): Promise<void> {
  if (!supabase) {
    loadedClients.add(clientId);
    return;
  }
  const { data, error } = await supabase
    .from('crm_client_notes')
    .select('*')
    .eq('client_id', clientId)
    .order('at', { ascending: false })
    .limit(200);
  if (!error && data) {
    cacheByClient.set(clientId, data.map((r) => mapRow(r as Record<string, unknown>)));
  }
  loadedClients.add(clientId);
  window.dispatchEvent(new CustomEvent(CRM_TIMELINE_CHANGED));
}

function ensureClientLoaded(clientId: string): void {
  if (loadedClients.has(clientId) || inFlightClients.has(clientId)) return;
  const p = refreshClient(clientId).finally(() => inFlightClients.delete(clientId));
  inFlightClients.set(clientId, p);
}

export function appendClientTimeline(
  entry: Omit<ClientTimelineEntry, 'id' | 'at'> & { at?: string },
): ClientTimelineEntry {
  const full: ClientTimelineEntry = {
    ...entry,
    id: crypto.randomUUID(),
    at: entry.at ?? new Date().toISOString(),
  };
  const list = cacheByClient.get(full.clientId) ?? [];
  cacheByClient.set(full.clientId, [full, ...list]);
  loadedClients.add(full.clientId);
  window.dispatchEvent(new CustomEvent(CRM_TIMELINE_CHANGED));

  void supabase?.auth.getUser().then(({ data }) => {
    const user = data?.user;
    if (!user || !supabase) return;
    void supabase.from('crm_client_notes').insert({
      id: full.id,
      user_id: user.id,
      client_id: full.clientId,
      kind: full.kind,
      title: full.title,
      body: full.body || null,
      actor_name: full.actorName || null,
      at: full.at,
    });
  });
  return full;
}

export function listClientTimeline(clientId: string): ClientTimelineEntry[] {
  ensureClientLoaded(clientId);
  return cacheByClient.get(clientId) ?? [];
}

export function seedClientTimelineNote(clientId: string, clientName: string) {
  ensureClientLoaded(clientId);
  const existing = cacheByClient.get(clientId);
  if (existing && existing.length > 0) return;
  if (!loadedClients.has(clientId)) return; // poczekaj na pierwsze zaladowanie
  appendClientTimeline({
    clientId,
    kind: 'note',
    title: 'Profil klienta',
    body: `Obsługa ${clientName} — tutaj zbieramy notatki, zamówienia i wiadomości.`,
    actorName: 'System',
  });
}
