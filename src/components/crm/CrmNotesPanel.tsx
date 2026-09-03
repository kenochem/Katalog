import { useEffect, useState } from 'react';
import { Pin, Plus, StickyNote, Trash2, User } from 'lucide-react';
import {
  CRM_NOTES_CHANGED,
  createNote,
  deleteNote,
  loadNotes,
  togglePinNote,
  type CrmNote,
} from '../../lib/crmNotes';
import type { CrmClient } from '../../lib/crm';
import { showToast } from '../../lib/toast';

interface CrmNotesPanelProps {
  clients: CrmClient[];
  /** Ogranicz widok do jednego klienta (uzywane w profilu klienta). */
  clientId?: string;
  compact?: boolean;
}

/** Wlasne notatki handlowca — opcjonalnie oznaczone klientem. To co maja prawdziwe
 * CRMy: luzne miejsce na "pamietam, ze..." bez zakladania calego leada/zamowienia. */
export function CrmNotesPanel({ clients, clientId, compact = false }: CrmNotesPanelProps) {
  const [notes, setNotes] = useState<CrmNote[]>(() => loadNotes());
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [taggedClientId, setTaggedClientId] = useState(clientId ?? '');
  const [formOpen, setFormOpen] = useState(false);

  useEffect(() => {
    const sync = () => setNotes(loadNotes());
    sync();
    window.addEventListener(CRM_NOTES_CHANGED, sync);
    return () => window.removeEventListener(CRM_NOTES_CHANGED, sync);
  }, []);

  const scoped = clientId ? notes.filter((n) => n.clientId === clientId) : notes;
  const shown = compact ? scoped.slice(0, 5) : scoped;

  function clientName(id?: string): string | null {
    if (!id) return null;
    return clients.find((c) => c.id === id)?.displayName ?? null;
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    createNote({ title: title.trim(), body: body.trim() || undefined, clientId: taggedClientId || undefined });
    setTitle('');
    setBody('');
    if (!clientId) setTaggedClientId('');
    setFormOpen(false);
    showToast('Notatka zapisana', 'ok');
  }

  function handleDelete(id: string) {
    deleteNote(id);
    showToast('Usunięto notatkę', 'info');
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-100">
          <StickyNote className="h-4 w-4 text-brand-400" />
          Notatki
        </h3>
        <button
          type="button"
          onClick={() => setFormOpen((v) => !v)}
          className="flex items-center gap-1 rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700"
        >
          <Plus className="h-3.5 w-3.5" />
          Nowa
        </button>
      </div>

      {formOpen && (
        <form onSubmit={handleAdd} className="mt-3 space-y-2 rounded-xl border border-slate-800 bg-slate-950/50 p-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Tytuł…"
            autoFocus
            className="input-field min-h-0 py-2 text-sm"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Treść (opcjonalnie)…"
            rows={2}
            className="w-full resize-none rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-brand-500"
          />
          {!clientId && (
            <select
              value={taggedClientId}
              onChange={(e) => setTaggedClientId(e.target.value)}
              className="input-field min-h-0 py-2 text-sm"
            >
              <option value="">Bez klienta</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.displayName}
                </option>
              ))}
            </select>
          )}
          <button
            type="submit"
            className="w-full rounded-xl bg-brand-600 py-2 text-sm font-semibold text-white hover:bg-brand-500"
          >
            Zapisz notatkę
          </button>
        </form>
      )}

      <ul className="mt-3 space-y-1.5">
        {shown.length === 0 ? (
          <li className="py-3 text-center text-xs text-slate-500">Brak notatek.</li>
        ) : (
          shown.map((n) => {
            const cName = clientName(n.clientId);
            return (
              <li
                key={n.id}
                className="group rounded-xl border border-slate-800 bg-slate-950/50 px-3 py-2"
              >
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-100">{n.title}</p>
                    {n.body && (
                      <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{n.body}</p>
                    )}
                    {cName && !clientId && (
                      <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400">
                        <User className="h-3 w-3" />
                        {cName}
                      </span>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => togglePinNote(n.id)}
                      className={`rounded-lg p-1.5 hover:bg-slate-800 ${n.pinned ? 'text-amber-400' : 'text-slate-600 hover:text-slate-300'}`}
                      aria-label="Przypnij"
                    >
                      <Pin className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(n.id)}
                      className="rounded-lg p-1.5 text-slate-600 hover:bg-red-500/10 hover:text-red-400"
                      aria-label="Usuń"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
