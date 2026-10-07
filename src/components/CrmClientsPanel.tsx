import { Download, Loader2, Plus, Search, Tag } from 'lucide-react';
import { confirmDialog } from '../lib/dialog';
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
import { CrmClientCardModal, tagTone } from './crm/CrmClientCardModal';

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
  const [openId, setOpenId] = useState<string | null>(null);

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

  const openClient = clients.find((c) => c.id === openId) ?? null;

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
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {filtered.map((c) => {
            const Icon = getClientIcon(c.icon);
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setOpenId(c.id)}
                  className="flex h-full w-full flex-col rounded-2xl border border-slate-800 bg-slate-900/80 p-3 text-left transition hover:border-brand-500/40 hover:bg-slate-900"
                  title="Otwórz kartę klienta"
                >
                  <div className="flex items-start gap-2.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-slate-400">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-semibold leading-snug text-slate-100">
                        {c.displayName}
                      </p>
                      <p className="mt-0.5 font-mono text-[11px] text-brand-400">
                        {c.nip || 'bez NIP'}
                      </p>
                    </div>
                  </div>
                  {c.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
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
                    <p className="mt-2 line-clamp-2 text-[11px] leading-snug text-slate-400">
                      {c.note}
                    </p>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <CrmClientCardModal
        client={openClient}
        onClose={() => setOpenId(null)}
        onOrder={(c) => {
          setOpenId(null);
          onPickClient?.(c);
        }}
        onEdit={(c) => {
          setOpenId(null);
          setEditing(c);
        }}
        onChanged={(c) => setClients((list) => list.map((x) => (x.id === c.id ? c : x)))}
        onDelete={async (c) => {
          if (
            !(await confirmDialog({
              title: 'Usunąć klienta?',
              tone: 'danger',
              message: `Klient „${c.displayName}” zostanie usunięty.`,
            }))
          )
            return;
          try {
            await deleteCrmClient(c.id);
            setOpenId(null);
            await reload();
            showToast('Usunięto klienta', 'info');
          } catch (err) {
            showToast(err instanceof Error ? err.message : 'Błąd', 'error');
          }
        }}
      />

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
