import { Loader2, Tag, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  CRM_CLIENT_TAGS,
  isValidNip,
  lookupNip,
  normalizeNip,
  upsertCrmClient,
  type CrmClient,
} from '../../lib/crm';
import { showToast } from '../../lib/toast';
import { CLIENT_ICON_OPTIONS } from './clientIcons';

const TAG_TONE: Record<string, string> = {
  VIP: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  Ryzykowny: 'bg-red-500/15 text-red-300 border-red-500/30',
  'Nowy prospekt': 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  Stały: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
};

function tagTone(tag: string): string {
  return TAG_TONE[tag] || 'bg-slate-800 text-slate-400 border-slate-700';
}

interface CrmClientEditModalProps {
  /** null = modal zamknięty. Podaj pusty obiekt ({ tags: [] }), żeby otworzyć "Nowy klient". */
  initial: Partial<CrmClient> | null;
  onClose: () => void;
  onSaved: (client: CrmClient) => void;
}

/** Modal dodawania/edycji klienta — wspólny dla listy klientów i szybkiego dodawania
 * przy wyborze klienta w zamówieniu, żeby nie powielać logiki NIP/tagów/ikon. */
export function CrmClientEditModal({ initial, onClose, onSaved }: CrmClientEditModalProps) {
  const [editing, setEditing] = useState<Partial<CrmClient> | null>(initial);
  const [saving, setSaving] = useState(false);
  const [nipBusy, setNipBusy] = useState(false);

  useEffect(() => {
    setEditing(initial);
  }, [initial]);

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
        tags: editing.tags ?? [],
        icon: editing.icon ?? null,
      });
      showToast('Klient zapisany', 'ok');
      onSaved(saved);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Błąd zapisu', 'error');
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

  if (!editing) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
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
            onClick={onClose}
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
              onChange={(e) => setEditing((p) => ({ ...p, displayName: e.target.value }))}
              placeholder="np. Scania / Kowalski"
              className="input-field"
              autoFocus
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
              onChange={(e) => setEditing((p) => ({ ...p, legalName: e.target.value }))}
              className="input-field"
            />
          </label>

          <label className="block">
            <span className="mb-1 text-xs text-slate-500">Adres</span>
            <input
              value={editing.address || ''}
              onChange={(e) => setEditing((p) => ({ ...p, address: e.target.value }))}
              className="input-field"
            />
          </label>

          <div>
            <span className="mb-1.5 block text-xs text-slate-500">Typ klienta</span>
            <div className="flex flex-wrap gap-1.5">
              {CLIENT_ICON_OPTIONS.map(({ id, label, Icon }) => {
                const active = editing.icon === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() =>
                      setEditing((p) => ({ ...p, icon: p?.icon === id ? undefined : id }))
                    }
                    title={label}
                    className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-medium transition ${
                      active
                        ? 'border-brand-500 bg-brand-500/15 text-brand-200'
                        : 'border-slate-700 bg-slate-950 text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <span className="mb-1.5 block text-xs text-slate-500">Tagi</span>
            <div className="flex flex-wrap gap-1.5">
              {CRM_CLIENT_TAGS.map((tag) => {
                const active = (editing.tags ?? []).includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() =>
                      setEditing((p) => {
                        const tags = p?.tags ?? [];
                        return {
                          ...p,
                          tags: tags.includes(tag)
                            ? tags.filter((t) => t !== tag)
                            : [...tags, tag],
                        };
                      })
                    }
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                      active ? tagTone(tag) : 'border-slate-700 bg-slate-950 text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    <Tag className="h-3 w-3" />
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="block">
            <span className="mb-1 text-xs text-slate-500">
              Notatka (preferencje, płatność, uwagi)
            </span>
            <textarea
              value={editing.note || ''}
              onChange={(e) => setEditing((p) => ({ ...p, note: e.target.value }))}
              rows={3}
              placeholder="np. przelew 14 dni, woli oferty PDF, nie dzwonić po 16…"
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
  );
}
