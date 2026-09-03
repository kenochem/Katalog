import { Download, Loader2, Pencil, Plus, Search, Tag, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  CRM_CLIENT_TAGS,
  crmErrorMessage,
  deleteCrmClient,
  fetchCrmClients,
  type CrmClient,
} from '../lib/crm';
import { showToast } from '../lib/toast';
import { downloadCsv, stampFile } from '../lib/exportReport';
import { getClientIcon } from './crm/clientIcons';
import { CrmClientEditModal } from './crm/CrmClientEditModal';

const TAG_TONE: Record<string, string> = {
  VIP: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  Ryzykowny: 'bg-red-500/15 text-red-300 border-red-500/30',
  'Nowy prospekt': 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  Stały: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
};

function tagTone(tag: string): string {
  return TAG_TONE[tag] || 'bg-slate-800 text-slate-400 border-slate-700';
}

interface CrmClientsPanelProps {
  cloudEnabled: boolean;
  onPickClient?: (client: CrmClient) => void;
}

export function CrmClientsPanel({ cloudEnabled, onPickClient }: CrmClientsPanelProps) {
  const [clients, setClients] = useState<CrmClient[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [editing, setEditing] = useState<Partial<CrmClient> | null>(null);

  async function reload() {
    if (!cloudEnabled) {
      setClients([]);
      return;
    }
    setLoading(true);
    try {
      setClients(await fetchCrmClients());
    } catch (err) {
      showToast(crmErrorMessage(err), 'error', 5000);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, [cloudEnabled]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    let list = clients;
    if (tagFilter) list = list.filter((c) => c.tags.includes(tagFilter));
    if (!s) return list;
    return list.filter(
      (c) =>
        c.displayName.toLowerCase().includes(s) ||
        (c.legalName || '').toLowerCase().includes(s) ||
        (c.note || '').toLowerCase().includes(s) ||
        (c.nip || '').includes(s.replace(/\D/g, '')),
    );
  }, [clients, q, tagFilter]);

  function handleExportCsv() {
    downloadCsv(
      stampFile('klienci'),
      ['Nazwa', 'Nazwa formalna', 'NIP', 'Adres', 'Tagi', 'Notatka'],
      filtered.map((c) => [
        c.displayName,
        c.legalName || '',
        c.nip || '',
        c.address || '',
        c.tags.join(', '),
        c.note || '',
      ]),
    );
  }

  if (!cloudEnabled) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-700 py-10 text-center text-sm text-slate-500">
        Zaloguj się, żeby mieć własną listę klientów w chmurze.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Szukaj nazwy / NIP…"
            className="input-field with-icon"
          />
        </div>
        <button
          type="button"
          onClick={handleExportCsv}
          disabled={!filtered.length}
          className="flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-700 px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          <span className="hidden sm:inline">Eksport</span>
        </button>
        <button
          type="button"
          onClick={() =>
            setEditing({
              displayName: '',
              legalName: '',
              nip: '',
              address: '',
              note: '',
              tags: [],
            })
          }
          className="flex shrink-0 items-center gap-1.5 rounded-xl bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-500"
        >
          <Plus className="h-4 w-4" />
          Dodaj
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {CRM_CLIENT_TAGS.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => setTagFilter((t) => (t === tag ? null : tag))}
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
              tagFilter === tag ? tagTone(tag) : 'border-slate-800 bg-slate-900/60 text-slate-500 hover:text-slate-300'
            }`}
          >
            <Tag className="h-3 w-3" />
            {tag}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-10 text-slate-500">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-700 py-10 text-center text-sm text-slate-500">
          Brak klientów — dodaj ręcznie albo po NIP
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((c) => (
            <li
              key={c.id}
              className="flex items-start gap-2 rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2.5"
            >
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-slate-400">
                {(() => {
                  const Icon = getClientIcon(c.icon);
                  return <Icon className="h-4 w-4" />;
                })()}
              </span>
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={() => onPickClient?.(c)}
                title="Wybierz do zamówienia"
              >
                <p className="truncate text-sm font-medium text-slate-100">{c.displayName}</p>
                {c.legalName && c.legalName !== c.displayName && (
                  <p className="truncate text-xs text-slate-500">{c.legalName}</p>
                )}
                <p className="mt-0.5 font-mono text-[11px] text-brand-400">
                  {c.nip || 'bez NIP'}
                </p>
                {c.tags.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {c.tags.map((tag) => (
                      <span
                        key={tag}
                        className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${tagTone(tag)}`}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                {c.note?.trim() && (
                  <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-slate-400">
                    {c.note}
                  </p>
                )}
              </button>
              <button
                type="button"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                onClick={() => setEditing(c)}
                aria-label="Edytuj"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="rounded-lg p-1.5 text-slate-500 hover:bg-red-950/40 hover:text-red-400"
                onClick={async () => {
                  if (!confirm(`Usunąć „${c.displayName}"?`)) return;
                  try {
                    await deleteCrmClient(c.id);
                    await reload();
                    showToast('Usunięto klienta', 'info');
                  } catch (err) {
                    showToast(err instanceof Error ? err.message : 'Błąd', 'error');
                  }
                }}
                aria-label="Usuń"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <CrmClientEditModal
        initial={editing}
        onClose={() => setEditing(null)}
        onSaved={async () => {
          setEditing(null);
          await reload();
        }}
      />
    </div>
  );
}
