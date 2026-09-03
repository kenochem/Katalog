import { supabase } from './supabase';

export type CalendarEventType =
  | 'visit'
  | 'delivery'
  | 'finance'
  | 'team'
  | 'task'
  | 'integration';

export interface CalendarEvent {
  id: string;
  title: string;
  type: CalendarEventType;
  date: string;
  time: string;
  endTime?: string;
  allDay?: boolean;
  owner: string;
  location?: string;
  note?: string;
  app?: 'crm' | 'ops' | 'talk' | 'logistics' | 'catalog' | 'suite';
}

const CHANGED_EVENT = 'kenochem-calendar-events-changed';

/**
 * Kalendarz jest wspolny dla calego zespolu (Supabase, tabela crm_calendar_events) —
 * nie localStorage. Trzymamy prosty cache w pamieci + odswiezamy go asynchronicznie,
 * zeby loadCalendarEvents() mogl zostac synchroniczny (uzywany w useState(() => ...))
 * bez przepisywania wszystkich komponentow na async/await.
 */
let cache: CalendarEvent[] = [];
let cacheReady = false;
let inFlight: Promise<void> | null = null;

function mapRow(row: Record<string, unknown>): CalendarEvent {
  return {
    id: String(row.id),
    title: String(row.title || ''),
    type: (row.type as CalendarEventType) || 'task',
    date: String(row.date || '').slice(0, 10),
    time: String(row.time || '09:00'),
    endTime: row.end_time ? String(row.end_time) : undefined,
    allDay: Boolean(row.all_day),
    owner: String(row.owner || ''),
    location: row.location ? String(row.location) : undefined,
    note: row.note ? String(row.note) : undefined,
    app: (row.app as CalendarEvent['app']) || undefined,
  };
}

async function refreshCache(): Promise<void> {
  if (!supabase) {
    cacheReady = true;
    return;
  }
  const { data, error } = await supabase
    .from('crm_calendar_events')
    .select('*')
    .order('date', { ascending: true })
    .order('time', { ascending: true })
    .limit(1000);
  if (!error && data) {
    cache = data.map((r) => mapRow(r as Record<string, unknown>));
  }
  cacheReady = true;
  window.dispatchEvent(new CustomEvent(CHANGED_EVENT));
}

/** Wywolaj raz przy starcie widoku kalendarza, zeby wczytac swieze dane z Supabase. */
export function ensureCalendarLoaded(): void {
  if (cacheReady || inFlight) return;
  inFlight = refreshCache().finally(() => {
    inFlight = null;
  });
}

export function loadCalendarEvents(): CalendarEvent[] {
  ensureCalendarLoaded();
  return cache;
}

export async function saveCalendarEvents(events: CalendarEvent[]): Promise<void> {
  if (!supabase) return;
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  if (!user) return;

  const prevIds = new Set(cache.map((e) => e.id));
  const nextIds = new Set(events.map((e) => e.id));
  const removed = [...prevIds].filter((id) => !nextIds.has(id));

  cache = events;
  window.dispatchEvent(new CustomEvent(CHANGED_EVENT));

  const ops: PromiseLike<unknown>[] = [];
  if (removed.length) {
    ops.push(supabase.from('crm_calendar_events').delete().in('id', removed));
  }
  for (const e of events) {
    const row = {
      id: e.id,
      user_id: user.id,
      title: e.title,
      type: e.type,
      date: e.date,
      time: e.time,
      end_time: e.endTime || null,
      all_day: e.allDay ?? false,
      owner: e.owner,
      location: e.location || null,
      note: e.note || null,
      app: e.app || null,
      updated_at: new Date().toISOString(),
    };
    if (prevIds.has(e.id)) {
      const { id, ...patch } = row;
      ops.push(supabase.from('crm_calendar_events').update(patch).eq('id', id));
    } else {
      ops.push(supabase.from('crm_calendar_events').insert(row));
    }
  }
  await Promise.all(ops);
}

export function createCalendarEvent(input: Omit<CalendarEvent, 'id'>): CalendarEvent {
  return {
    ...input,
    id: crypto.randomUUID(),
  };
}

export function calendarEventTypeLabel(type: CalendarEventType): string {
  const map: Record<CalendarEventType, string> = {
    visit: 'Wizyta',
    delivery: 'Dostawa',
    finance: 'Finanse',
    team: 'Zespol',
    task: 'Zadanie',
    integration: 'Sync',
  };
  return map[type];
}

export function calendarEventTypeTone(type: CalendarEventType): string {
  const map: Record<CalendarEventType, string> = {
    visit: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    delivery: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
    finance: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
    team: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    task: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    integration: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
  };
  return map[type];
}

export function todayIso(): string {
  return todayOffset(0);
}

function todayOffset(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}
