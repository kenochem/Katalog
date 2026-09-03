import { useEffect, useState } from 'react';
import { Check, Plus, Trash2 } from 'lucide-react';
import {
  CRM_TASKS_CHANGED,
  createTask,
  deleteTask,
  loadTasks,
  toggleTaskDone,
  type CrmTask,
} from '../../lib/crmTasks';
import { todayIso } from '../../lib/calendarStore';
import { showToast } from '../../lib/toast';

function formatDue(task: CrmTask): string {
  if (!task.dueDate) return 'Bez terminu';
  const isToday = task.dueDate === todayIso();
  const d = new Date(task.dueDate).toLocaleDateString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
  });
  const label = isToday ? 'Dziś' : d;
  return task.dueTime ? `${label}, ${task.dueTime}` : label;
}

/** Zadania/przypomnienia handlowca — "oddzwoń do klienta w piątek" itp.
 * Osobny, prosty panel obok kalendarza (te same dane co crm_tasks). */
export function CrmTasksPanel({ clientId }: { clientId?: string }) {
  const [tasks, setTasks] = useState<CrmTask[]>(() => loadTasks());
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');

  useEffect(() => {
    const sync = () => setTasks(loadTasks());
    sync();
    window.addEventListener(CRM_TASKS_CHANGED, sync);
    return () => window.removeEventListener(CRM_TASKS_CHANGED, sync);
  }, []);

  const scoped = clientId ? tasks.filter((t) => t.clientId === clientId) : tasks;
  const open = scoped.filter((t) => !t.done);
  const done = scoped.filter((t) => t.done);

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    createTask({ title: title.trim(), dueDate: dueDate || undefined, clientId });
    setTitle('');
    setDueDate('');
    showToast('Dodano zadanie', 'ok');
  }

  function handleToggle(id: string, wasDone: boolean) {
    toggleTaskDone(id);
    if (!wasDone) showToast('Zadanie zrobione ✓', 'ok');
  }

  function handleDelete(id: string) {
    deleteTask(id);
    showToast('Usunięto zadanie', 'info');
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
      <h3 className="text-sm font-semibold text-slate-100">Zadania i przypomnienia</h3>
      <p className="mt-0.5 text-xs text-slate-500">
        Np. „oddzwoń do klienta w piątek” — osobiste zadania handlowca.
      </p>

      <form onSubmit={handleAdd} className="mt-3 flex flex-wrap gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Nowe zadanie…"
          className="input-field min-h-0 min-w-[10rem] flex-1 py-2 text-sm"
        />
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="input-field min-h-0 py-2 text-sm"
        />
        <button
          type="submit"
          className="flex shrink-0 items-center gap-1 rounded-xl bg-brand-600 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-500"
        >
          <Plus className="h-3.5 w-3.5" />
          Dodaj
        </button>
      </form>

      <ul className="mt-3 max-h-72 space-y-1.5 overflow-y-auto">
        {open.length === 0 ? (
          <li className="py-3 text-center text-xs text-slate-500">Brak otwartych zadań.</li>
        ) : (
          open.map((t) => (
            <li
              key={t.id}
              className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/50 px-3 py-2"
            >
              <button
                type="button"
                onClick={() => handleToggle(t.id, t.done)}
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-slate-600 transition hover:border-brand-500 hover:bg-brand-500/10"
                aria-label="Oznacz jako zrobione"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-slate-100">{t.title}</span>
                <span className="text-[11px] text-slate-500">{formatDue(t)}</span>
              </span>
              <button
                type="button"
                onClick={() => handleDelete(t.id)}
                className="shrink-0 rounded-lg p-1.5 text-slate-600 transition hover:bg-red-500/10 hover:text-red-400"
                aria-label="Usuń"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))
        )}
        {done.length > 0 && (
          <li className="pt-1 text-[11px] uppercase tracking-wide text-slate-600">
            Zrobione ({done.length})
          </li>
        )}
        {done.slice(0, 5).map((t) => (
          <li
            key={t.id}
            className="flex items-center gap-2 rounded-xl px-3 py-1.5 opacity-50"
          >
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-brand-600/30 text-brand-300">
              <Check className="h-3 w-3" />
            </span>
            <span className="truncate text-sm text-slate-400 line-through">{t.title}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
