import {
  AlertTriangle,
  Download,
  FileDown,
  History,
  Loader2,
  RotateCcw,
  Send,
  StickyNote,
  Trash2,
} from 'lucide-react';
import { downloadCsv, stampFile } from '../lib/exportReport';
import { useEffect, useMemo, useState } from 'react';
import {
  crmErrorMessage,
  deleteCrmOrder,
  fetchCrmOrders,
  orderToDraft,
  saveCrmOrder,
  type CrmClient,
  type CrmOrder,
} from '../lib/crm';
import {
  printOrderDraftPdf,
  sendOrderDraftToDiscord,
  type OrderDraft,
} from '../lib/orderDraft';
import { showToast } from '../lib/toast';
import { createNote } from '../lib/crmNotes';
import { getClientIcon } from './crm/clientIcons';

interface CrmHistoryPanelProps {
  cloudEnabled: boolean;
  authorLabel: string;
  clients: CrmClient[];
  quietDays: number;
  onReuse: (draft: OrderDraft) => void;
}

interface QuietClientRow {
  client: CrmClient;
  lastOrderAt: number;
  daysSince: number;
}

export function CrmHistoryPanel({
  cloudEnabled,
  authorLabel,
  clients,
  quietDays,
  onReuse,
}: CrmHistoryPanelProps) {
  const [orders, setOrders] = useState<CrmOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<CrmOrder | null>(null);
  const [sending, setSending] = useState(false);
  const [noteDraftFor, setNoteDraftFor] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const hasWebhook = Boolean(import.meta.env.VITE_DISCORD_ORDERS_WEBHOOK);

  async function reload() {
    if (!cloudEnabled) {
      setOrders([]);
      return;
    }
    setLoading(true);
    try {
      setOrders(await fetchCrmOrders(500));
    } catch (err) {
      showToast(crmErrorMessage(err), 'error', 5000);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, [cloudEnabled]);

  const quietClients = useMemo<QuietClientRow[]>(() => {
    const lastOrderByClient = new Map<string, number>();
    for (const o of orders) {
      const key = o.clientId || (o.clientName ? `name:${o.clientName.toLowerCase()}` : '');
      if (!key) continue;
      const at = new Date(o.createdAt).getTime();
      if (!Number.isFinite(at)) continue;
      const prev = lastOrderByClient.get(key);
      if (prev == null || at > prev) lastOrderByClient.set(key, at);
    }
    const cutoff = Date.now() - quietDays * 86_400_000;
    const rows: QuietClientRow[] = [];
    for (const client of clients) {
      const lastOrderAt =
        lastOrderByClient.get(client.id) ??
        lastOrderByClient.get(`name:${client.displayName.toLowerCase()}`);
      if (lastOrderAt == null || lastOrderAt >= cutoff) continue;
      rows.push({
        client,
        lastOrderAt,
        daysSince: Math.floor((Date.now() - lastOrderAt) / 86_400_000),
      });
    }
    return rows.sort((a, b) => b.daysSince - a.daysSince);
  }, [orders, clients, quietDays]);

  function saveContactNote(clientId: string) {
    if (!noteText.trim()) return;
    createNote({ title: 'Kontakt z klientem', body: noteText.trim(), clientId });
    setNoteText('');
    setNoteDraftFor(null);
    showToast('Zapisano notatkę', 'ok');
  }

  async function resendDiscord(order: CrmOrder) {
    const draft = orderToDraft(order);
    if (!draft.items.length) {
      showToast('Brak pozycji', 'warn');
      return;
    }
    setSending(true);
    try {
      if (!hasWebhook) {
        showToast('Brak webhooka Discord', 'warn');
        return;
      }
      const res = await sendOrderDraftToDiscord(draft, authorLabel);
      if (!res.ok) {
        showToast(res.error || 'Wysyłka nieudana', 'error');
        return;
      }
      if (cloudEnabled) {
        try {
          await saveCrmOrder({ draft, clientId: order.clientId, status: 'sent' });
          await reload();
        } catch {
          /* historia już istnieje — nie blokuj */
        }
      }
      showToast('Wysłano ponownie na Discord', 'ok');
    } finally {
      setSending(false);
    }
  }

  if (!cloudEnabled) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-700 py-10 text-center text-sm text-slate-500">
        Zaloguj się, żeby widzieć historię własnych zamówień.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-10 text-slate-500">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!orders.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-700 py-10 text-center">
        <History className="mx-auto h-10 w-10 text-slate-600" />
        <p className="mt-3 text-sm text-slate-500">
          Brak zapisanych zamówień — pojawią się po Discord / Zapisz
        </p>
      </div>
    );
  }

  function handleExportCsv() {
    downloadCsv(
      stampFile('historia_zamowien'),
      ['Data', 'Klient', 'Typ', 'Status', 'Pozycji', 'Sztuk', 'Notatka'],
      orders.map((o) => [
        new Date(o.createdAt).toLocaleString('pl-PL'),
        o.clientName || '',
        o.kind === 'quote' ? 'Oferta' : 'Zamówienie',
        o.status === 'sent' ? 'Wysłane' : 'Zapisane',
        o.items.length,
        o.items.reduce((s, i) => s + (i.quantity || 0), 0),
        o.note || '',
      ]),
    );
  }

  return (
    <div className="space-y-3">
      {quietClients.length > 0 && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.06] p-4">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-300">
            <AlertTriangle className="h-4 w-4" />
            Wymagają kontaktu — {quietClients.length}
          </p>
          <p className="mt-0.5 text-xs text-amber-200/70">
            Nie zamawiali od ponad {quietDays} dni. Warto się odezwać.
          </p>
          <ul className="mt-3 space-y-2">
            {quietClients.map(({ client, daysSince }) => {
              const Icon = getClientIcon(client.icon);
              return (
                <li
                  key={client.id}
                  className="rounded-xl border border-slate-800 bg-slate-950/50 px-3 py-2.5"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-slate-400">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-100">
                        {client.displayName}
                      </p>
                      <p className="text-xs font-semibold text-amber-400">
                        {daysSince} dni bez zamówienia
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setNoteDraftFor((id) => (id === client.id ? null : client.id))
                      }
                      className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
                    >
                      <StickyNote className="h-3.5 w-3.5" />
                      Opisz sytuację
                    </button>
                  </div>
                  {noteDraftFor === client.id && (
                    <div className="mt-2.5 space-y-2">
                      <textarea
                        autoFocus
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        placeholder="np. dzwoniłem, mówi że tymczasowo wstrzymał zamówienia u nas…"
                        rows={2}
                        className="w-full resize-none rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-brand-500"
                      />
                      <button
                        type="button"
                        onClick={() => saveContactNote(client.id)}
                        disabled={!noteText.trim()}
                        className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
                      >
                        Zapisz notatkę
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleExportCsv}
          className="flex items-center gap-1.5 rounded-xl border border-slate-700 px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800"
        >
          <Download className="h-4 w-4" />
          Eksport CSV
        </button>
      </div>
      <ul className="space-y-2">
        {orders.map((o) => {
          const qty = o.items.reduce((s, i) => s + (i.quantity || 0), 0);
          const when = new Date(o.createdAt).toLocaleString('pl-PL', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          });
          return (
            <li key={o.id}>
              <button
                type="button"
                onClick={() => setSelected(selected?.id === o.id ? null : o)}
                className={`w-full rounded-xl border px-3 py-2.5 text-left transition ${
                  selected?.id === o.id
                    ? 'border-brand-500/50 bg-brand-500/10'
                    : 'border-slate-800 bg-slate-900/80 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium text-slate-100">
                    {o.clientName || '(bez klienta)'}
                  </p>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      o.kind === 'quote'
                        ? 'bg-amber-500/20 text-amber-200'
                        : o.status === 'sent'
                          ? 'bg-brand-500/20 text-brand-300'
                          : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {o.kind === 'quote'
                      ? 'Oferta'
                      : o.status === 'sent'
                        ? 'Discord'
                        : 'Zapis'}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-slate-500">
                  {when} · {o.items.length} poz. · {qty} szt.
                </p>
              </button>
            </li>
          );
        })}
      </ul>

      {selected && (
        <div className="space-y-3 rounded-2xl border border-slate-700 bg-slate-950/60 p-3">
          <div>
            <p className="text-sm font-medium text-slate-100">
              {selected.clientName || '(bez klienta)'}
            </p>
            {selected.note && (
              <p className="mt-1 text-xs text-slate-400">{selected.note}</p>
            )}
          </div>
          <ul className="max-h-48 space-y-1.5 overflow-y-auto">
            {selected.items.map((i) => (
              <li
                key={`${i.productId}-${i.sku}`}
                className="flex items-center gap-2 text-xs text-slate-300"
              >
                {i.imageUrl ? (
                  <img
                    src={i.imageUrl}
                    alt=""
                    className="h-8 w-8 rounded object-contain bg-slate-800"
                  />
                ) : (
                  <div className="h-8 w-8 rounded bg-slate-800" />
                )}
                <span className="font-mono text-brand-400">{i.quantity}×</span>
                <span className="min-w-0 flex-1 truncate">
                  {i.sku} — {i.displayName}
                </span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                onReuse(orderToDraft(selected));
                showToast('Wczytano do aktualnego zamówienia', 'ok');
              }}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-700 py-2 text-sm font-medium text-slate-200"
            >
              <RotateCcw className="h-4 w-4" />
              Ponów
            </button>
            <button
              type="button"
              disabled={sending || !hasWebhook}
              onClick={() => void resendDiscord(selected)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand-600 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Discord
            </button>
            <button
              type="button"
              onClick={() => {
                printOrderDraftPdf(orderToDraft(selected), authorLabel);
                showToast('Otwarto podgląd PDF / druku', 'info');
              }}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-700 py-2 text-sm font-medium text-slate-200"
            >
              <FileDown className="h-4 w-4" />
              PDF
            </button>
            <button
              type="button"
              onClick={async () => {
                if (!confirm('Usunąć to zamówienie z historii?')) return;
                try {
                  await deleteCrmOrder(selected.id);
                  setSelected(null);
                  await reload();
                  showToast('Usunięto z historii', 'info');
                } catch (err) {
                  showToast(err instanceof Error ? err.message : 'Błąd', 'error');
                }
              }}
              className="rounded-xl border border-red-900/50 px-3 py-2 text-red-400"
              aria-label="Usuń"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
