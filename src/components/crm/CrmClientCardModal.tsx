import { useEffect, useMemo, useState } from 'react';
import { MapPin, Pencil, Plus, ShoppingCart, Tag, Trash2, X } from 'lucide-react';
import {
  CRM_CLIENT_TAGS,
  crmErrorMessage,
  fetchCrmOrders,
  updateCrmClientTags,
  type CrmClient,
  type CrmOrder,
} from '../../lib/crm';
import { showToast } from '../../lib/toast';
import { getClientIcon } from './clientIcons';
import { ClientTimelinePanel } from './ClientTimelinePanel';
import { CrmNotesPanel } from './CrmNotesPanel';

const TAG_TONE: Record<string, string> = {
  VIP: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  Ryzykowny: 'bg-red-500/15 text-red-300 border-red-500/30',
  'Nowy prospekt': 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  Stały: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
};

export function tagTone(tag: string): string {
  return TAG_TONE[tag] || 'bg-slate-800 text-slate-400 border-slate-700';
}

interface Props {
  client: CrmClient | null;
  onClose: () => void;
  onOrder: (client: CrmClient) => void;
  onEdit: (client: CrmClient) => void;
  onDelete: (client: CrmClient) => void;
  onChanged: (client: CrmClient) => void;
}

/** Karta klienta: dane, etykiety (przypisywanie), historia zamówień, notatki i oś czasu. */
export function CrmClientCardModal({ client, onClose, onOrder, onEdit, onDelete, onChanged }: Props) {
  const [orders, setOrders] = useState<CrmOrder[]>([]);
  const [busy, setBusy] = useState(false);
  const [custom, setCustom] = useState('');

  useEffect(() => {
    if (!client) return;
    let alive = true;
    fetchCrmOrders(500)
      .then((all) => {
        if (alive)
          setOrders(
            all.filter(
              (o) =>
                o.clientId === client.id ||
                (!o.clientId && o.clientName.toLowerCase() === client.displayName.toLowerCase()),
            ),
          );
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [client?.id]);

  const knownTags = useMemo(() => {
    const set = new Set<string>(CRM_CLIENT_TAGS);
    for (const t of client?.tags ?? []) set.add(t);
    return [...set];
  }, [client?.tags]);

  if (!client) return null;
  const Icon = getClientIcon(client.icon);

  async function saveTags(tags: string[]) {
    if (!client) return;
    setBusy(true);
    try {
      onChanged(await updateCrmClientTags(client.id, tags));
    } catch (err) {
      showToast(crmErrorMessage(err), 'error', 5000);
    } finally {
      setBusy(false);
    }
  }

  function toggleTag(tag: string) {
    if (!client) return;
    void saveTags(
      client.tags.includes(tag) ? client.tags.filter((t) => t !== tag) : [...client.tags, tag],
    );
  }

  function addCustom() {
    const t = custom.trim();
    if (!t || !client || client.tags.includes(t)) return;
    setCustom('');
    void saveTags([...client.tags, t]);
  }

  const totalOrders = orders.filter((o) => o.kind === 'order').length;
  const totalQuotes = orders.length - totalOrders;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto bg-black/60 p-3 sm:p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 border-b border-slate-800 p-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-slate-300">
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-slate-50">{client.displayName}</h2>
            {client.legalName && client.legalName !== client.displayName && (
              <p className="text-xs text-slate-500">{client.legalName}</p>
            )}
            <p className="mt-1 font-mono text-xs text-brand-400">NIP: {client.nip || 'brak'}</p>
            {client.address && (
              <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-400">
                <MapPin className="h-3 w-3 shrink-0" />
                {client.address}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800"
            aria-label="Zamknij"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-4">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onOrder(client)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-500"
            >
              <ShoppingCart className="h-4 w-4" />
              Utwórz zamówienie
            </button>
            <button
              type="button"
              onClick={() => onEdit(client)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
            >
              <Pencil className="h-4 w-4" />
              Edytuj dane
            </button>
            <button
              type="button"
              onClick={() => onDelete(client)}
              className="ml-auto inline-flex items-center gap-1.5 rounded-xl border border-red-900/50 px-3 py-2 text-sm text-red-400 hover:bg-red-950/40"
            >
              <Trash2 className="h-4 w-4" />
              Usuń
            </button>
          </div>

          <section>
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <Tag className="h-3.5 w-3.5" />
              Etykiety
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              {knownTags.map((tag) => {
                const on = client.tags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    disabled={busy}
                    onClick={() => toggleTag(tag)}
                    className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                      on
                        ? tagTone(tag)
                        : 'border-slate-800 bg-slate-900/60 text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {on ? '✓ ' : ''}
                    {tag}
                  </button>
                );
              })}
              <span className="inline-flex items-center gap-1">
                <input
                  value={custom}
                  onChange={(e) => setCustom(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addCustom()}
                  placeholder="Nowa etykieta"
                  className="input-field w-32 text-xs"
                />
                <button
                  type="button"
                  onClick={addCustom}
                  disabled={!custom.trim() || busy}
                  className="rounded-lg border border-slate-700 p-1.5 text-slate-300 hover:bg-slate-800 disabled:opacity-40"
                  aria-label="Dodaj etykietę"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </span>
            </div>
          </section>

          {client.note?.trim() && (
            <section>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Notatka z kartoteki
              </p>
              <p className="whitespace-pre-line rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-sm text-slate-300">
                {client.note}
              </p>
            </section>
          )}

          <section>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Historia · {totalOrders} zam. · {totalQuotes} ofert
            </p>
            {orders.length === 0 ? (
              <p className="text-sm text-slate-500">Brak zamówień ani ofert tego klienta.</p>
            ) : (
              <ul className="max-h-44 space-y-1 overflow-y-auto">
                {orders.slice(0, 15).map((o) => (
                  <li
                    key={o.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-2.5 py-1.5 text-xs text-slate-300"
                  >
                    <span className="truncate">
                      {o.kind === 'quote' ? (o.quoteNumber ?? 'Oferta') : 'Zamówienie'} ·{' '}
                      {o.items.length} poz.
                    </span>
                    <span className="shrink-0 text-slate-500">
                      {new Date(o.createdAt).toLocaleDateString('pl-PL')}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="grid gap-4 md:grid-cols-2">
            <ClientTimelinePanel clientId={client.id} clientName={client.displayName} />
            <CrmNotesPanel clients={[client]} clientId={client.id} compact />
          </div>
        </div>
      </div>
    </div>
  );
}
