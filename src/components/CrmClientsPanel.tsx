import { Loader2, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  crmErrorMessage,
  deleteCrmClient,
  fetchCrmClients,
  isValidNip,
  lookupNip,
  normalizeNip,
  upsertCrmClient,
  type CrmClient,
} from '../lib/crm';
import { showToast } from '../lib/toast';

interface CrmClientsPanelProps {
  cloudEnabled: boolean;
  onPickClient?: (client: CrmClient) => void;
}

export function CrmClientsPanel({ cloudEnabled, onPickClient }: CrmClientsPanelProps) {
  const [clients, setClients] = useState<CrmClient[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Partial<CrmClient> | null>(null);
  const [saving, setSaving] = useState(false);
  const [nipBusy, setNipBusy] = useState(false);

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
    if (!s) return clients;
    return clients.filter(
      (c) =>
        c.displayName.toLowerCase().includes(s) ||
        (c.legalName || '').toLowerCase().includes(s) ||
        (c.nip || '').includes(s.replace(/\D/g, '')),
    );
  }, [clients, q]);

  async function handleSave() {
    if (!editing?.displayName?.trim()) {
      showToast('Podaj nazwę klienta', 'warn');
      return;
    }
    setSaving(true);
    try {
      const saved = await upsertCrmClient({
        id: editing.id,
        displayName: editing.displayName,
        legalName: editing.legalName,
        nip: editing.nip,
        address: editing.address,
        note: editing.note,
      });
      setEditing(null);
      await reload();
      showToast('Klient zapisany', 'ok');
      return saved;
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Błąd zapisu', 'error');
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function handleNipLookup() {
    const nip = normalizeNip(editing?.nip || '');
    if (!isValidNip(nip)) {
      showToast('Wpisz poprawny NIP (10 cyfr)', 'warn');
      return;
    }
    setNipBusy(true);
    try {
      const res = await lookupNip(nip);
      setEditing((prev) => ({
        ...prev,
        nip: res.nip,
        legalName: res.legalName,
        address: res.address,
        displayName: prev?.displayName?.trim() || res.legalName,
      }));
      showToast('Pobrano dane z białej listy VAT', 'ok');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Błąd NIP', 'error');
    } finally {
      setNipBusy(false);
    }
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
          onClick={() =>
            setEditing({
              displayName: '',
              legalName: '',
              nip: '',
              address: '',
              note: '',
            })
          }
          className="flex shrink-0 items-center gap-1.5 rounded-xl bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-500"
        >
          <Plus className="h-4 w-4" />
          Dodaj
        </button>
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

      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={() => setEditing(null)}
        >
          <div
            className="animate-fade-in max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-slate-700 bg-slate-900 sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 flex items-center justify-between border-b border-slate-800 bg-slate-900/95 px-4 py-3 backdrop-blur">
              <h3 className="font-semibold text-slate-100">
                {editing.id ? 'Edytuj klienta' : 'Nowy klient'}
              </h3>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 p-4">
              <label className="block">
                <span className="mb-1 text-xs text-slate-500">Nazwa u Ciebie</span>
                <input
                  value={editing.displayName || ''}
                  onChange={(e) =>
                    setEditing((p) => ({ ...p, displayName: e.target.value }))
                  }
                  placeholder="np. Scania / Kowalski"
                  className="input-field"
                />
              </label>

              <div className="flex gap-2">
                <label className="block min-w-0 flex-1">
                  <span className="mb-1 text-xs text-slate-500">NIP</span>
                  <input
                    value={editing.nip || ''}
                    onChange={(e) => setEditing((p) => ({ ...p, nip: e.target.value }))}
                    placeholder="10 cyfr"
                    className="input-field font-mono"
                    inputMode="numeric"
                  />
                </label>
                <button
                  type="button"
                  disabled={nipBusy}
                  onClick={() => void handleNipLookup()}
                  className="mt-5 shrink-0 rounded-xl border border-brand-500/40 bg-brand-500/10 px-3 py-2 text-sm font-medium text-brand-200 disabled:opacity-50"
                >
                  {nipBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Po NIP'}
                </button>
              </div>

              <label className="block">
                <span className="mb-1 text-xs text-slate-500">Nazwa formalna (MF)</span>
                <input
                  value={editing.legalName || ''}
                  onChange={(e) =>
                    setEditing((p) => ({ ...p, legalName: e.target.value }))
                  }
                  className="input-field"
                />
              </label>

              <label className="block">
                <span className="mb-1 text-xs text-slate-500">Adres</span>
                <input
                  value={editing.address || ''}
                  onChange={(e) =>
                    setEditing((p) => ({ ...p, address: e.target.value }))
                  }
                  className="input-field"
                />
              </label>

              <label className="block">
                <span className="mb-1 text-xs text-slate-500">Notatka</span>
                <textarea
                  value={editing.note || ''}
                  onChange={(e) => setEditing((p) => ({ ...p, note: e.target.value }))}
                  rows={2}
                  className="input-field resize-none"
                />
              </label>

              <button
                type="button"
                disabled={saving}
                onClick={() => void handleSave()}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-3 text-sm font-medium text-white disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Zapisz klienta
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
