import { useEffect } from 'react';
import type { Product } from '../types';
import { supabase } from './supabase';
import { logAudit } from './auditLog';
import { pushAppNotification } from './appNotifications';

/** Zadania w katalogu przydzielane osobom („Moja kolejka”; tabela catalog_tasks). */

export type TaskKind = 'photo' | 'tech' | 'data' | 'other';

export const TASK_KIND_LABEL: Record<TaskKind, string> = {
  photo: 'Uzupełnij zdjęcie',
  tech: 'Zatwierdź opis techniczny',
  data: 'Sprawdź dane produktu',
  other: 'Inne zadanie',
};

export interface CatalogTask {
  id: string;
  title: string;
  note: string;
  kind: TaskKind;
  sku: string;
  productName: string;
  assignedTo: string;
  assignedToLabel: string;
  createdBy: string;
  createdByLabel: string;
  status: 'open' | 'done';
  createdAt: string;
  doneAt: string | null;
  doneAuto: boolean;
}

function rowToTask(r: Record<string, unknown>): CatalogTask {
  const kind = String(r.kind);
  return {
    id: String(r.id),
    title: String(r.title ?? ''),
    note: String(r.note ?? ''),
    kind: (['photo', 'tech', 'data', 'other'].includes(kind) ? kind : 'other') as TaskKind,
    sku: String(r.sku ?? ''),
    productName: String(r.product_name ?? ''),
    assignedTo: String(r.assigned_to),
    assignedToLabel: String(r.assigned_to_label ?? ''),
    createdBy: String(r.created_by),
    createdByLabel: String(r.created_by_label ?? ''),
    status: r.status === 'done' ? 'done' : 'open',
    createdAt: String(r.created_at),
    doneAt: r.done_at ? String(r.done_at) : null,
    doneAuto: Boolean(r.done_auto),
  };
}

export interface TaskLists {
  /** Komunikat błędu z bazy, gdy tabela istnieje, ale zapytanie się nie powiodło (np. brak uprawnień). */
  error?: string;
  /** Przydzielone mnie (otwarte + ostatnio wykonane). */
  mine: CatalogTask[];
  /** Utworzone przeze mnie dla innych. */
  delegated: CatalogTask[];
  /** true = tabela nie istnieje (migracja nie wykonana). */
  missing: boolean;
}

export async function fetchTasks(userId: string): Promise<TaskLists> {
  if (!supabase) return { mine: [], delegated: [], missing: false };
  const since = new Date(Date.now() - 60 * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from('catalog_tasks')
    .select('*')
    .or(`assigned_to.eq.${userId},created_by.eq.${userId}`)
    .or(`status.eq.open,created_at.gte.${since}`)
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) {
    // tabela naprawdę nie istnieje tylko przy tych kodach; inne błędy (np. brak uprawnień) pokazujemy wprost
    const missing = error.code === 'PGRST205' || error.code === '42P01' || /could not find the table/i.test(error.message);
    return { mine: [], delegated: [], missing, error: missing ? undefined : `${error.message}${error.code ? ` (${error.code})` : ''}` };
  }

  const all = ((data ?? []) as Record<string, unknown>[]).map(rowToTask);
  return {
    mine: all.filter((t) => t.assignedTo === userId),
    delegated: all.filter((t) => t.createdBy === userId && t.assignedTo !== userId),
    missing: false,
  };
}

export interface NewTaskInput {
  title: string;
  note?: string;
  kind: TaskKind;
  sku?: string;
  productName?: string;
  assignedTo: string;
  assignedToLabel: string;
}

export async function createTask(
  input: NewTaskInput,
  creator: { id: string; label: string },
): Promise<void> {
  if (!supabase) throw new Error('Brak konfiguracji Supabase');
  const { error } = await supabase.from('catalog_tasks').insert({
    title: input.title.trim(),
    note: (input.note ?? '').trim(),
    kind: input.kind,
    sku: (input.sku ?? '').trim().toUpperCase(),
    product_name: input.productName ?? '',
    assigned_to: input.assignedTo,
    assigned_to_label: input.assignedToLabel,
    created_by: creator.id,
    created_by_label: creator.label,
  });
  if (error) throw new Error(error.message);
}

export async function completeTask(task: CatalogTask, auto = false): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from('catalog_tasks')
    .update({ status: 'done', done_at: new Date().toISOString(), done_auto: auto })
    .eq('id', task.id);
  if (error) throw new Error(error.message);
  logAudit({
    action: 'task.done',
    entityType: 'task',
    entityId: task.sku || task.id,
    entityLabel: task.title,
    summary: 'Wykonano zadanie: ' + task.title,
  });
}

export async function reopenTask(taskId: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from('catalog_tasks')
    .update({ status: 'open', done_at: null, done_auto: false })
    .eq('id', taskId);
  if (error) throw new Error(error.message);
}

export async function deleteTask(taskId: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('catalog_tasks').delete().eq('id', taskId);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------------------------
// Powiadomienia o nowych zadaniach (lekki polling co 5 minut, raz na zadanie)
// ---------------------------------------------------------------------------------------------

const SEEN_KEY = 'katalog-seen-tasks';

function loadSeen(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
}

function saveSeen(set: Set<string>) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...set].slice(-300)));
  } catch {
    /* ignoruj */
  }
}

export function useTaskNotifications(userId: string | undefined, enabled: boolean): void {
  useEffect(() => {
    if (!enabled || !userId || !supabase) return;
    let stopped = false;
    let first = true;

    async function check() {
      if (stopped) return;
      const lists = await fetchTasks(userId as string);
      if (lists.missing) return;
      const seen = loadSeen();
      const fresh = lists.mine.filter((t) => t.status === 'open' && t.createdBy !== userId && !seen.has(t.id));
      // przy pierwszym uruchomieniu bez historii nie zasypujemy powiadomieniami wszystkiego naraz
      for (const t of fresh.slice(0, first && seen.size === 0 ? 3 : 10)) {
        pushAppNotification({
          id: 'task-' + t.id,
          kind: 'task',
          scope: 'catalog',
          userId,
          title: 'Nowe zadanie: ' + t.title,
          body: (t.createdByLabel ? t.createdByLabel + ' przydziela Ci zadanie' : 'Masz nowe zadanie') + (t.sku ? ' (' + t.sku + ')' : ''),
          actionView: 'profile',
        });
      }
      for (const t of lists.mine) seen.add(t.id);
      saveSeen(seen);
      first = false;
    }

    void check();
    const timer = window.setInterval(() => void check(), 5 * 60_000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [userId, enabled]);
}

// ---------------------------------------------------------------------------------------------
// Podpowiedzi zadań z danych katalogu
// ---------------------------------------------------------------------------------------------

export function salesQty12m(p: Product): number {
  return p.waproSalesStats?.periods?.find((x) => x.months === 12)?.qty ?? 0;
}

/** Produkty bez zdjęcia, od najlepiej sprzedających się. */
export function suggestPhotoProducts(products: Product[], limit = 12): Product[] {
  return products
    .filter((p) => !p.isGroup && !p.hasImage && p.sku)
    .sort((a, b) => salesQty12m(b) - salesQty12m(a) || a.sku.localeCompare(b.sku))
    .slice(0, limit);
}
