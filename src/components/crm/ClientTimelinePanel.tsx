import { useEffect, useState } from 'react';
import { FileText, Mail, MessageSquare, ShoppingCart, StickyNote } from 'lucide-react';
import {
  CRM_TIMELINE_CHANGED,
  appendClientTimeline,
  listClientTimeline,
  seedClientTimelineNote,
  type ClientTimelineKind,
} from '../../lib/crmClientTimeline';

interface ClientTimelinePanelProps {
  clientId: string;
  clientName: string;
}

function kindIcon(kind: ClientTimelineKind) {
  switch (kind) {
    case 'order':
      return <ShoppingCart className="h-3.5 w-3.5" />;
    case 'invoice':
      return <FileText className="h-3.5 w-3.5" />;
    case 'inbox':
      return <Mail className="h-3.5 w-3.5" />;
    case 'chat':
      return <MessageSquare className="h-3.5 w-3.5" />;
    default:
      return <StickyNote className="h-3.5 w-3.5" />;
  }
}

export function ClientTimelinePanel({ clientId, clientName }: ClientTimelinePanelProps) {
  const [entries, setEntries] = useState(() => listClientTimeline(clientId));
  const [note, setNote] = useState('');

  useEffect(() => {
    seedClientTimelineNote(clientId, clientName);
    setEntries(listClientTimeline(clientId));
    const onChange = () => setEntries(listClientTimeline(clientId));
    window.addEventListener(CRM_TIMELINE_CHANGED, onChange);
    return () => window.removeEventListener(CRM_TIMELINE_CHANGED, onChange);
  }, [clientId, clientName]);

  function addNote(e: React.FormEvent) {
    e.preventDefault();
    if (!note.trim()) return;
    appendClientTimeline({
      clientId,
      kind: 'note',
      title: 'Notatka',
      body: note.trim(),
    });
    setNote('');
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Oś czasu klienta
      </h4>
      <ul className="mt-3 max-h-56 space-y-2 overflow-y-auto">
        {entries.length === 0 ? (
          <li className="text-sm text-slate-500">Brak zdarzeń — dodaj notatkę.</li>
        ) : (
          entries.map((e) => (
            <li key={e.id} className="flex gap-2 text-sm">
              <span className="mt-0.5 text-slate-500">{kindIcon(e.kind)}</span>
              <span className="min-w-0 flex-1">
                <span className="font-medium text-slate-200">{e.title}</span>
                {e.body && <p className="text-xs text-slate-500">{e.body}</p>}
                <p className="text-[10px] text-slate-600">
                  {new Date(e.at).toLocaleString('pl-PL')}
                </p>
              </span>
            </li>
          ))
        )}
      </ul>
      <form onSubmit={addNote} className="mt-3 flex gap-2">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Szybka notatka…"
          className="input-field min-h-0 flex-1 py-2 text-sm"
        />
        <button
          type="submit"
          className="shrink-0 rounded-xl bg-slate-800 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700"
        >
          Dodaj
        </button>
      </form>
    </div>
  );
}
