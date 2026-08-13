const KEY = 'katalog-crm-client-timeline';
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

function readAll(): ClientTimelineEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ClientTimelineEntry[]) : [];
  } catch {
    return [];
  }
}

function writeAll(entries: ClientTimelineEntry[]) {
  localStorage.setItem(KEY, JSON.stringify(entries.slice(0, 500)));
  window.dispatchEvent(new CustomEvent(CRM_TIMELINE_CHANGED));
}

export function appendClientTimeline(
  entry: Omit<ClientTimelineEntry, 'id' | 'at'> & { at?: string },
): ClientTimelineEntry {
  const full: ClientTimelineEntry = {
    ...entry,
    id: `tl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    at: entry.at ?? new Date().toISOString(),
  };
  writeAll([full, ...readAll()]);
  return full;
}

export function listClientTimeline(clientId: string): ClientTimelineEntry[] {
  return readAll()
    .filter((e) => e.clientId === clientId)
    .sort((a, b) => b.at.localeCompare(a.at));
}

export function seedClientTimelineNote(clientId: string, clientName: string) {
  const existing = readAll().some((e) => e.clientId === clientId);
  if (existing) return;
  appendClientTimeline({
    clientId,
    kind: 'note',
    title: 'Profil klienta',
    body: `Obsługa ${clientName} — tutaj zbieramy notatki, zamówienia i wiadomości.`,
    actorName: 'System',
  });
}
