import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  MapPin,
  MessageCircle,
  Pencil,
  Plus,
  RefreshCw,
  Route,
  Save,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import type { HubView } from '../../app/hubNavigation';
import {
  calendarEventTypeLabel,
  calendarEventTypeTone,
  createCalendarEvent,
  loadCalendarEvents,
  saveCalendarEvents,
  todayIso,
  type CalendarEvent,
  type CalendarEventType,
} from '../../lib/calendarStore';
import { showToast } from '../../lib/toast';
import { ContextHelp } from '../ContextHelp';

const TYPES: CalendarEventType[] = [
  'visit',
  'delivery',
  'finance',
  'team',
  'task',
  'integration',
];

interface CalendarKenochemViewProps {
  standalone?: boolean;
  onNavigate?: (view: HubView) => void;
}

export function CalendarKenochemView({
  standalone = false,
  onNavigate,
}: CalendarKenochemViewProps) {
  const [events, setEvents] = useState<CalendarEvent[]>(() => loadCalendarEvents());
  const [query, setQuery] = useState('');
  const [type, setType] = useState<CalendarEventType>('task');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(todayIso());
  const [time, setTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [allDay, setAllDay] = useState(false);
  const [owner, setOwner] = useState('');
  const [location, setLocation] = useState('');
  const [note, setNote] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [monthCursor, setMonthCursor] = useState(() => todayIso().slice(0, 7));
  const formRef = useRef<HTMLElement | null>(null);
  const titleInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const sync = () => setEvents(loadCalendarEvents());
    window.addEventListener('kenochem-calendar-events-changed', sync);
    return () => window.removeEventListener('kenochem-calendar-events-changed', sync);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events
      .filter((event) => {
        if (!q) return true;
        return [event.title, event.owner, event.location, event.note]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(q));
      })
      .sort((a, b) =>
        `${a.date} ${a.time || '00:00'}`.localeCompare(`${b.date} ${b.time || '00:00'}`),
      );
  }, [events, query]);

  const todayEvents = filtered.filter((event) => event.date === todayIso());
  const weekEvents = filtered.filter((event) => {
    const delta = daysFromToday(event.date);
    return delta >= 0 && delta <= 6;
  });
  const visitCount = events.filter((event) => event.type === 'visit').length;
  const integratedCount = events.filter((event) => Boolean(event.app)).length;

  const monthDays = useMemo(
    () => buildMonthGrid(monthCursor, events),
    [events, monthCursor],
  );

  const selectedEvents = filtered.filter((event) => event.date === selectedDate);

  const resetForm = (dateOverride = date) => {
    setEditingId(null);
    setTitle('');
    setDate(dateOverride);
    setTime('09:00');
    setEndTime('10:00');
    setAllDay(false);
    setType('task');
    setOwner('');
    setLocation('');
    setNote('');
  };

  const focusForm = () => {
    window.setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      titleInputRef.current?.focus();
    }, 50);
  };

  const startNewEvent = (dateOverride = selectedDate) => {
    resetForm(dateOverride);
    setDate(dateOverride);
    setSelectedDate(dateOverride);
    setMonthCursor(dateOverride.slice(0, 7));
    focusForm();
  };

  const saveEvent = (dateOverride = date, mode: 'upsert' | 'create' = 'upsert') => {
    const input = {
      title: title.trim() || 'Bez tytulu',
      type,
      date: dateOverride,
      time: allDay ? '' : time,
      endTime: allDay ? undefined : endTime,
      allDay,
      owner: owner.trim(),
      location: location.trim() || undefined,
      app: appForType(type),
      note: note.trim() || undefined,
    };
    const shouldUpdate = editingId && mode === 'upsert';
    const updated = shouldUpdate
      ? events.map((event) => (event.id === editingId ? { ...event, ...input } : event))
      : [...events, createCalendarEvent(input)];
    setEvents(updated);
    saveCalendarEvents(updated);
    setSelectedDate(dateOverride);
    setMonthCursor(dateOverride.slice(0, 7));
    resetForm(dateOverride);
    showToast(
      shouldUpdate ? 'Wydarzenie zaktualizowane' : 'Wydarzenie dodane do kalendarza',
      'ok',
    );
  };

  const removeEvent = (id: string) => {
    const updated = events.filter((event) => event.id !== id);
    setEvents(updated);
    saveCalendarEvents(updated);
    if (editingId === id) resetForm(selectedDate);
    showToast('Wydarzenie usuniete z kalendarza', 'info');
  };

  const editEvent = (event: CalendarEvent) => {
    setEditingId(event.id);
    setTitle(event.title);
    setType(event.type);
    setDate(event.date);
    setTime(event.time || '09:00');
    setEndTime(event.endTime || '10:00');
    setAllDay(Boolean(event.allDay));
    setOwner(event.owner || '');
    setLocation(event.location ?? '');
    setNote(event.note ?? '');
    setSelectedDate(event.date);
    setMonthCursor(event.date.slice(0, 7));
    focusForm();
  };

  return (
    <div className={`w-full ${standalone ? 'min-h-dvh bg-slate-950' : ''}`}>
      <div className="mx-auto w-full max-w-7xl px-3 py-5 sm:px-5 sm:py-8">
        <section className="overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-950 to-emerald-950/30 p-4 shadow-xl shadow-slate-950/20 sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-400">
                Kenochem Kalendarz
              </p>
              <h1 className="mt-1 inline-flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-50 sm:text-3xl">
                Plan firmy, wizyt, dostaw i raportow
                <ContextHelp id="calendar" side="left" />
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                Jeden kalendarz dla CRM, Talk, Operacji, Magazynu i Logistyki. Na start lokalny plan pracy,
                pozniej wspolny kalendarz Supabase oraz integracje Google/Outlook.
              </p>
            </div>
            <div className="w-full lg:max-w-[28rem]">
              <div className="grid grid-cols-3 gap-2">
                <CalendarMetric label="Dzis" value={String(todayEvents.length)} />
                <CalendarMetric label="Tydzien" value={String(weekEvents.length)} />
                <CalendarMetric label="Wizyty" value={String(visitCount)} />
              </div>
              <a
                href="https://kenochem-calendar.web.app/"
                className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-3 text-sm font-semibold text-white transition hover:bg-brand-500"
              >
                Otworz pelny Kalendarz
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </div>
        </section>

        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_26rem]">
        <section className="rounded-3xl border border-slate-800 bg-slate-950 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Siatka kalendarza
              </p>
              <h2 className="mt-1 inline-flex items-center gap-2 text-lg font-semibold text-slate-50">
                {monthLabel(monthCursor)}
                <ContextHelp id="calendarGrid" />
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setMonthCursor(addMonths(monthCursor, -1))}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800 text-slate-400 hover:bg-slate-900 hover:text-slate-100"
                aria-label="Poprzedni miesiac"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  const today = todayIso();
                  setMonthCursor(today.slice(0, 7));
                  setSelectedDate(today);
                  setDate(today);
                }}
                className="h-10 rounded-xl border border-slate-800 px-3 text-sm font-semibold text-slate-300 hover:bg-slate-900 hover:text-slate-100"
              >
                Dzis
              </button>
              <button
                type="button"
                onClick={() => setMonthCursor(addMonths(monthCursor, 1))}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800 text-slate-400 hover:bg-slate-900 hover:text-slate-100"
                aria-label="Nastepny miesiac"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <CalendarMonthGrid
            days={monthDays}
            selectedDate={selectedDate}
            onSelectDate={(nextDate) => {
              setSelectedDate(nextDate);
              setDate(nextDate);
            }}
            onQuickAdd={(nextDate) => {
              startNewEvent(nextDate);
            }}
          />

          <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Wybrany dzien
                </p>
                <p className="text-sm font-semibold text-slate-100">{selectedDate}</p>
              </div>
              <button
                type="button"
                onClick={() => startNewEvent(selectedDate)}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-brand-600 px-3 text-sm font-semibold text-white hover:bg-brand-500"
              >
                <Plus className="h-4 w-4" />
                Nowe wydarzenie
              </button>
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {selectedEvents.length ? (
                selectedEvents.map((event) => (
                  <CalendarEventRow
                    key={event.id}
                    event={event}
                    compact
                    onEdit={() => editEvent(event)}
                    onRemove={() => removeEvent(event.id)}
                  />
                ))
              ) : (
                <p className="rounded-xl border border-dashed border-slate-800 px-3 py-4 text-sm text-slate-500">
                  Brak wydarzen w tym dniu. Kliknij dzien dwa razy albo uzyj "Nowe wydarzenie", zeby wypelnic wlasny wpis w panelu obok.
                </p>
              )}
            </div>
          </div>
        </section>

          <section ref={formRef} className="rounded-3xl border border-slate-800 bg-slate-950 p-4 xl:sticky xl:top-24 xl:self-start">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Szczegoly wydarzenia
                </p>
                <h2 className="mt-1 inline-flex items-center gap-2 text-lg font-semibold text-slate-50">
                  {editingId ? 'Edytuj wpis' : 'Nowy wpis w kalendarzu'}
                  <ContextHelp id="calendar" side="left" />
                </h2>
                <p className="mt-1 text-xs font-semibold text-brand-300">{selectedDate}</p>
              </div>
              <button
                type="button"
                onClick={() => saveEvent()}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-600 px-3 text-sm font-semibold text-white hover:bg-brand-500"
              >
                {editingId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                {editingId ? 'Zapisz' : 'Dodaj'}
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {editingId && (
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-brand-500/30 bg-brand-500/10 px-3 py-2">
                  <p className="text-xs font-semibold text-brand-200">Edytujesz wydarzenie</p>
                  <button
                    type="button"
                    onClick={() => resetForm(selectedDate)}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-slate-100"
                  >
                    <X className="h-3.5 w-3.5" />
                    Anuluj
                  </button>
                </div>
              )}
              <label className="block">
                <span className="text-xs text-slate-500">Tytul</span>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  ref={titleInputRef}
                  placeholder="Dodaj tytul"
                  className="mt-1 h-11 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-brand-500"
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label>
                  <span className="text-xs text-slate-500">Data</span>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => {
                      setDate(e.target.value);
                      setSelectedDate(e.target.value);
                      setMonthCursor(e.target.value.slice(0, 7));
                    }}
                    className="mt-1 h-11 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 text-sm text-slate-100 outline-none focus:border-brand-500"
                  />
                </label>
                <label>
                  <span className="text-xs text-slate-500">Godzina</span>
                  <input
                    type="time"
                    value={time}
                    disabled={allDay}
                    onChange={(e) => setTime(e.target.value)}
                    className="mt-1 h-11 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 text-sm text-slate-100 outline-none focus:border-brand-500 disabled:opacity-45"
                  />
                </label>
              </div>
              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <label>
                  <span className="text-xs text-slate-500">Koniec</span>
                  <input
                    type="time"
                    value={endTime}
                    disabled={allDay}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="mt-1 h-11 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 text-sm text-slate-100 outline-none focus:border-brand-500 disabled:opacity-45"
                  />
                </label>
                <label className="mt-5 flex h-11 items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3 text-sm font-semibold text-slate-300">
                  <input
                    type="checkbox"
                    checked={allDay}
                    onChange={(e) => setAllDay(e.target.checked)}
                    className="h-4 w-4 accent-brand-500"
                  />
                  Caly dzien
                </label>
              </div>
              <div>
                <span className="text-xs text-slate-500">Kolor / typ</span>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {TYPES.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setType(item)}
                    className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                      type === item
                        ? calendarEventTypeTone(item)
                        : 'border-slate-800 bg-slate-900 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    {calendarEventTypeLabel(item)}
                  </button>
                ))}
              </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <label>
                  <span className="text-xs text-slate-500">Osoba / dzial</span>
                  <input
                    value={owner}
                    onChange={(e) => setOwner(e.target.value)}
                    placeholder="Kto odpowiada?"
                    className="mt-1 h-11 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-brand-500"
                  />
                </label>
                <label>
                  <span className="text-xs text-slate-500">Miejsce</span>
                  <input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Lokalizacja / rejon / online"
                    className="mt-1 h-11 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-brand-500"
                  />
                </label>
              </div>
              <label className="block">
                <span className="text-xs text-slate-500">Notatka</span>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={4}
                  placeholder="Szczegoly, ustalenia, rzeczy do zrobienia..."
                  className="mt-1 w-full resize-none rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-brand-500"
                />
              </label>
            </div>

            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <CalendarAction
                icon={<Route className="h-4 w-4" />}
                label="Plan wizyt"
                detail="CRM"
                onClick={() => onNavigate?.('crm')}
              />
              <CalendarAction
                icon={<MessageCircle className="h-4 w-4" />}
                label="Odprawa"
                detail="Talk"
                onClick={() => onNavigate?.('comms')}
              />
              <CalendarAction
                icon={<RefreshCw className="h-4 w-4" />}
                label="Sync danych"
                detail="Integracje"
                onClick={() => onNavigate?.('integrations')}
              />
              <CalendarAction
                icon={<CalendarDays className="h-4 w-4" />}
                label="Raporty"
                detail="Operacje"
                onClick={() => onNavigate?.('ops')}
              />
            </div>
          </section>
        </div>

          <section className="mt-4 rounded-3xl border border-slate-800 bg-slate-950 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Agenda
                </p>
                <h2 className="mt-1 text-lg font-semibold text-slate-50">
                  Najblizsze zdarzenia
                </h2>
              </div>
              <label className="relative block sm:w-72">
                <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Szukaj w kalendarzu..."
                  className="h-10 w-full rounded-xl border border-slate-800 bg-slate-900 pl-9 pr-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-brand-500"
                />
              </label>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <CalendarMetric label="Powiazane" value={String(integratedCount)} compact />
              <CalendarMetric label="Typy" value={String(TYPES.length)} compact />
              <CalendarMetric label="Wszystkie" value={String(events.length)} compact />
            </div>

            <div className="mt-4 space-y-2">
              {filtered.length ? (
                filtered.map((event) => (
                  <CalendarEventRow
                    key={event.id}
                    event={event}
                    onEdit={() => editEvent(event)}
                    onRemove={() => removeEvent(event.id)}
                  />
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-800 p-8 text-center">
                  <CalendarDays className="mx-auto h-8 w-8 text-slate-600" />
                  <p className="mt-2 text-sm font-semibold text-slate-300">
                    Brak zdarzen
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Dodaj pierwsza wizyte, dostawe, raport albo zadanie.
                  </p>
                </div>
              )}
            </div>
          </section>
      </div>
    </div>
  );
}

function CalendarMetric({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <div className={`rounded-2xl border border-slate-800 bg-slate-900/60 ${compact ? 'px-3 py-2' : 'px-4 py-3'}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 text-xl font-bold tabular-nums text-slate-100">{value}</p>
    </div>
  );
}

function CalendarAction({
  icon,
  label,
  detail,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-14 items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-3 text-left transition hover:border-brand-500/50 hover:bg-slate-900"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-500/15 text-brand-300">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-slate-100">{label}</span>
        <span className="block truncate text-xs text-slate-500">{detail}</span>
      </span>
    </button>
  );
}

interface CalendarMonthDay {
  iso: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
  events: CalendarEvent[];
}

function CalendarMonthGrid({
  days,
  selectedDate,
  onSelectDate,
  onQuickAdd,
}: {
  days: CalendarMonthDay[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onQuickAdd: (date: string) => void;
}) {
  const weekLabels = ['Pon', 'Wt', 'Sr', 'Czw', 'Pt', 'Sob', 'Nd'];
  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/40">
      <div className="grid grid-cols-7 border-b border-slate-800 bg-slate-950/70">
        {weekLabels.map((label) => (
          <div
            key={label}
            className="px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-500"
          >
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const selected = day.iso === selectedDate;
          return (
            <button
              key={day.iso}
              type="button"
              onClick={() => onSelectDate(day.iso)}
              onDoubleClick={() => onQuickAdd(day.iso)}
              className={`group min-h-[7.25rem] border-b border-r border-slate-800 p-2 text-left transition last:border-r-0 hover:bg-slate-900 ${
                selected ? 'bg-brand-500/10 ring-1 ring-inset ring-brand-500/50' : ''
              } ${day.inMonth ? 'text-slate-100' : 'bg-slate-950/40 text-slate-600'}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                    day.isToday
                      ? 'bg-brand-600 text-white'
                      : selected
                        ? 'bg-brand-500/20 text-brand-200'
                        : 'text-slate-400'
                  }`}
                >
                  {day.day}
                </span>
                <span className="text-[10px] font-medium text-slate-600 opacity-0 transition group-hover:opacity-100">
                  + dodaj
                </span>
              </div>
              <div className="mt-2 space-y-1">
                {day.events.slice(0, 3).map((event) => (
                  <span
                    key={event.id}
                    className={`block truncate rounded-lg border px-2 py-1 text-[10px] font-semibold ${calendarEventTypeTone(event.type)}`}
                    title={`${eventTimeLabel(event)} ${event.title}`}
                  >
                    {eventTimeLabel(event)} {event.title}
                  </span>
                ))}
                {day.events.length > 3 && (
                  <span className="block px-2 text-[10px] text-slate-500">
                    +{day.events.length - 3} wiecej
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CalendarEventRow({
  event,
  onEdit,
  onRemove,
  compact = false,
}: {
  event: CalendarEvent;
  onEdit: () => void;
  onRemove: () => void;
  compact?: boolean;
}) {
  return (
    <div className={`rounded-2xl border border-slate-800 bg-slate-900/60 ${compact ? 'p-2.5' : 'p-3'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${calendarEventTypeTone(event.type)}`}>
              {calendarEventTypeLabel(event.type)}
            </span>
            {event.app && (
              <span className="rounded-full border border-slate-700 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                {event.app}
              </span>
            )}
          </div>
          <p className="mt-2 truncate text-sm font-semibold text-slate-100">{event.title}</p>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" />
              {event.date}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {eventTimeLabel(event)}
            </span>
            {event.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {event.location}
              </span>
            )}
          </div>
          {event.note && (
            <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-500">
              {event.note}
            </p>
          )}
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={onEdit}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-800 hover:text-brand-300"
            aria-label="Edytuj zdarzenie"
            title="Edytuj"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-800 hover:text-rose-300"
            aria-label="Usun zdarzenie"
            title="Usun"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function buildMonthGrid(month: string, events: CalendarEvent[]): CalendarMonthDay[] {
  const [year, monthNum] = month.split('-').map(Number);
  const first = new Date(year, monthNum - 1, 1);
  const firstWeekday = (first.getDay() + 6) % 7;
  const gridStart = new Date(year, monthNum - 1, 1 - firstWeekday);
  const byDate = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const list = byDate.get(event.date) ?? [];
    list.push(event);
    byDate.set(event.date, list);
  }

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    const iso = formatLocalDate(date);
    const list = (byDate.get(iso) ?? []).sort((a, b) =>
      (a.time || '00:00').localeCompare(b.time || '00:00'),
    );
    return {
      iso,
      day: date.getDate(),
      inMonth: date.getMonth() === monthNum - 1,
      isToday: iso === todayIso(),
      events: list,
    };
  });
}

function addMonths(month: string, diff: number): string {
  const [year, monthNum] = month.split('-').map(Number);
  const date = new Date(year, monthNum - 1 + diff, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(month: string): string {
  const [year, monthNum] = month.split('-').map(Number);
  return new Intl.DateTimeFormat('pl-PL', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, monthNum - 1, 1));
}

function formatLocalDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function daysFromToday(date: string): number {
  const today = new Date(todayIso()).getTime();
  const target = new Date(date).getTime();
  if (!Number.isFinite(target)) return 999;
  return Math.round((target - today) / 86400000);
}

function appForType(type: CalendarEventType): CalendarEvent['app'] {
  const map: Record<CalendarEventType, CalendarEvent['app']> = {
    visit: 'crm',
    delivery: 'logistics',
    finance: 'ops',
    team: 'talk',
    task: 'suite',
    integration: 'suite',
  };
  return map[type];
}

function eventTimeLabel(event: CalendarEvent): string {
  if (event.allDay) return 'Caly dzien';
  if (event.endTime) return `${event.time || '--:--'}-${event.endTime}`;
  return event.time || '--:--';
}
