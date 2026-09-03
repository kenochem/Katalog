import { supabase } from './supabase';
import { loadCalendarEvents, saveCalendarEvents, type CalendarEvent } from './calendarStore';

export const CRM_TASKS_CHANGED = 'katalog-crm-tasks-changed';

/** Zadanie z terminem dostaje bliźniacze wydarzenie w kalendarzu (to samo id) —
 * jednokierunkowo (zadanie -> kalendarz). Edycja tego wpisu wprost w kalendarzu
 * nie wraca do zadania, ale usunięcie/zmiana terminu zadania aktualizuje kalendarz. */
function syncTaskToCalendar(task: CrmTask): void {
  const events = loadCalendarEvents();
  const withoutTask = events.filter((e) => e.id !== task.id);
  if (!task.dueDate || task.done) {
    if (withoutTask.length !== events.length) void saveCalendarEvents(withoutTask);
    return;
  }
  const mirrored: CalendarEvent = {
    id: task.id,
    title: task.title,
    type: 'task',
    date: task.dueDate,
    time: task.dueTime || '',
    allDay: !task.dueTime,
    owner: 'Zadanie',
    note: task.note,
    app: 'crm',
  };
  void saveCalendarEvents([...withoutTask, mirrored]);
}

function removeTaskFromCalendar(taskId: string): void {
  const events = loadCalendarEvents();
  const next = events.filter((e) => e.id !== taskId);
  if (next.length !== events.length) void saveCalendarEvents(next);
}

export interface CrmTask {
  id: string;
  title: string;
  note?: string;
  dueDate?: string;
  dueTime?: string;
  clientId?: string;
  leadId?: string;
  done: boolean;
  doneAt?: string;
  createdAt: string;
  updatedAt: string;
}

/** Zadania/przypomnienia handlowca ("oddzwoń do klienta w piątek") — Supabase
 * (crm_tasks), prywatne per handlowiec. Ten sam wzorzec cache co reszta CRM libów. */
let cache: CrmTask[] = [];
let cacheReady = false;
let inFlight: Promise<void> | null = null;

function mapRow(row: Record<string, unknown>): CrmTask {
  return {
    id: String(row.id),
    title: String(row.title || ''),
    note: row.note ? String(row.note) : undefined,
    dueDate: row.due_date ? String(row.due_date).slice(0, 10) : undefined,
    dueTime: row.due_time ? String(row.due_time) : undefined,
    clientId: row.client_id ? String(row.client_id) : undefined,
    leadId: row.lead_id ? String(row.lead_id) : undefined,
    done: Boolean(row.done),
    doneAt: row.done_at ? String(row.done_at) : undefined,
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
    .from('crm_tasks')
    .select('*')
    .order('done', { ascending: true })
    .order('due_date', { ascending: true, nullsFirst: false });
  if (!error && data) {
    cache = data.map((r) => mapRow(r as Record<string, unknown>));
  }
  cacheReady = true;
  window.dispatchEvent(new CustomEvent(CRM_TASKS_CHANGED));
}

function ensureLoaded(): void {
  if (cacheReady || inFlight) return;
  inFlight = refreshCache().finally(() => {
    inFlight = null;
  });
}

function emit() {
  window.dispatchEvent(new CustomEvent(CRM_TASKS_CHANGED));
}

export function loadTasks(): CrmTask[] {
  ensureLoaded();
  return cache;
}

export function getOpenTasksForDate(dateIso: string): CrmTask[] {
  return loadTasks().filter((t) => !t.done && t.dueDate === dateIso);
}

export function getOverdueTasks(): CrmTask[] {
  const today = new Date().toISOString().slice(0, 10);
  return loadTasks().filter((t) => !t.done && t.dueDate && t.dueDate < today);
}

export function createTask(input: {
  title: string;
  note?: string;
  dueDate?: string;
  dueTime?: string;
  clientId?: string;
  leadId?: string;
}): CrmTask {
  const now = new Date().toISOString();
  const task: CrmTask = {
    id: crypto.randomUUID(),
    title: input.title.trim(),
    note: input.note?.trim() || undefined,
    dueDate: input.dueDate,
    dueTime: input.dueTime,
    clientId: input.clientId,
    leadId: input.leadId,
    done: false,
    createdAt: now,
    updatedAt: now,
  };
  cache = [task, ...cache];
  emit();
  syncTaskToCalendar(task);
  void supabase?.auth.getUser().then(({ data }) => {
    const user = data?.user;
    if (!user || !supabase) return;
    void supabase.from('crm_tasks').insert({
      id: task.id,
      user_id: user.id,
      title: task.title,
      note: task.note || null,
      due_date: task.dueDate || null,
      due_time: task.dueTime || null,
      client_id: task.clientId || null,
      lead_id: task.leadId || null,
      done: false,
      created_at: task.createdAt,
      updated_at: task.updatedAt,
    });
  });
  return task;
}

export function toggleTaskDone(id: string) {
  const existing = cache.find((t) => t.id === id);
  if (!existing) return;
  const now = new Date().toISOString();
  const updatedTask: CrmTask = {
    ...existing,
    done: !existing.done,
    doneAt: !existing.done ? now : undefined,
    updatedAt: now,
  };
  cache = cache.map((t) => (t.id === id ? updatedTask : t));
  emit();
  syncTaskToCalendar(updatedTask);
  void supabase
    ?.from('crm_tasks')
    .update({ done: updatedTask.done, done_at: updatedTask.doneAt || null, updated_at: now })
    .eq('id', id);
}

export function deleteTask(id: string) {
  cache = cache.filter((t) => t.id !== id);
  emit();
  removeTaskFromCalendar(id);
  void supabase?.from('crm_tasks').delete().eq('id', id);
}
