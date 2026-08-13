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

const KEY = 'kenochem-calendar-events-v1';

const demoEvents: CalendarEvent[] = [
  {
    id: 'demo-visit',
    title: 'Wizyta u klienta B2B',
    type: 'visit',
    date: todayOffset(0),
    time: '09:30',
    owner: 'Handlowiec',
    location: 'Rejon Polnoc',
    app: 'crm',
    note: 'Docelowo zaciagane z CRM: klient, trasa, notatki i zamowienie.',
  },
  {
    id: 'demo-finance',
    title: 'Kontrola platnosci i raport dzienny',
    type: 'finance',
    date: todayOffset(0),
    time: '12:00',
    owner: 'Biuro',
    app: 'ops',
    note: 'Miejsce na cykliczne raporty z Operacji.',
  },
  {
    id: 'demo-delivery',
    title: 'Okno dostaw magazynowych',
    type: 'delivery',
    date: todayOffset(1),
    time: '08:00',
    owner: 'Magazyn',
    location: 'Magazyn Kenochem',
    app: 'logistics',
    note: 'Docelowo statusy paczek, trasy i kompletacja.',
  },
  {
    id: 'demo-team',
    title: 'Odprawa zespolu',
    type: 'team',
    date: todayOffset(2),
    time: '10:00',
    owner: 'Zespol',
    app: 'talk',
    note: 'Powiazanie z Talk: przypomnienie i watek rozmowy.',
  },
];

export function loadCalendarEvents(): CalendarEvent[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return demoEvents;
    const parsed = JSON.parse(raw) as CalendarEvent[];
    return Array.isArray(parsed) ? parsed : demoEvents;
  } catch {
    return demoEvents;
  }
}

export function saveCalendarEvents(events: CalendarEvent[]) {
  localStorage.setItem(KEY, JSON.stringify(events.slice(0, 500)));
  window.dispatchEvent(new CustomEvent('kenochem-calendar-events-changed'));
}

export function createCalendarEvent(input: Omit<CalendarEvent, 'id'>): CalendarEvent {
  return {
    ...input,
    id: `cal-${Date.now()}-${Math.random().toString(16).slice(2)}`,
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
