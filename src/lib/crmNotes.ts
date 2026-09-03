import { supabase } from './supabase';

export const CRM_NOTES_CHANGED = 'katalog-crm-notes-changed';

export interface CrmNote {
  id: string;
  title: string;
  body?: string;
  clientId?: string;
  leadId?: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Notatki wlasne handlowca (crm_notes), opcjonalnie oznaczone klientem/leadem.
 * Ten sam wzorzec cache co reszta CRM libow — synchroniczny odczyt, zapis w tle. */
let cache: CrmNote[] = [];
let cacheReady = false;
let inFlight: Promise<void> | null = null;

function mapRow(row: Record<string, unknown>): CrmNote {
  return {
    id: String(row.id),
    title: String(row.title || ''),
    body: row.body ? String(row.body) : undefined,
    clientId: row.client_id ? String(row.client_id) : undefined,
    leadId: row.lead_id ? String(row.lead_id) : undefined,
    pinned: Boolean(row.pinned),
    createdAt: String(row.created_at || ''),
    updatedAt: String(row.updated_at || ''),
  };
}

async function refreshCache(): Promise<void> {
  if (!supabase) {
    cacheReady = true;
    return;
  }
  const { data, error } = await supabase
    .from('crm_notes')
    .select('*')
    .order('pinned', { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(300);
  if (!error && data) {
    cache = data.map((r) => mapRow(r as Record<string, unknown>));
  }
  cacheReady = true;
  window.dispatchEvent(new CustomEvent(CRM_NOTES_CHANGED));
}

function ensureLoaded(): void {
  if (cacheReady || inFlight) return;
  inFlight = refreshCache().finally(() => {
    inFlight = null;
  });
}

function emit() {
  window.dispatchEvent(new CustomEvent(CRM_NOTES_CHANGED));
}

export function loadNotes(): CrmNote[] {
  ensureLoaded();
  return cache;
}

export function getNotesForClient(clientId: string): CrmNote[] {
  return loadNotes().filter((n) => n.clientId === clientId);
}

export function createNote(input: {
  title: string;
  body?: string;
  clientId?: string;
  leadId?: string;
}): CrmNote {
  const now = new Date().toISOString();
  const note: CrmNote = {
    id: crypto.randomUUID(),
    title: input.title.trim(),
    body: input.body?.trim() || undefined,
    clientId: input.clientId,
    leadId: input.leadId,
    pinned: false,
    createdAt: now,
    updatedAt: now,
  };
  cache = [note, ...cache];
  emit();
  void supabase?.auth.getUser().then(({ data }) => {
    const user = data?.user;
    if (!user || !supabase) return;
    void supabase.from('crm_notes').insert({
      id: note.id,
      user_id: user.id,
      title: note.title,
      body: note.body || null,
      client_id: note.clientId || null,
      lead_id: note.leadId || null,
      pinned: false,
      created_at: note.createdAt,
      updated_at: note.updatedAt,
    });
  });
  return note;
}

export function togglePinNote(id: string) {
  const now = new Date().toISOString();
  let pinned = false;
  cache = cache.map((n) => {
    if (n.id !== id) return n;
    pinned = !n.pinned;
    return { ...n, pinned, updatedAt: now };
  });
  emit();
  void supabase?.from('crm_notes').update({ pinned, updated_at: now }).eq('id', id);
}

export function deleteNote(id: string) {
  cache = cache.filter((n) => n.id !== id);
  emit();
  void supabase?.from('crm_notes').delete().eq('id', id);
}
