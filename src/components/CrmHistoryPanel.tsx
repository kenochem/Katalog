import { FileDown, History, Loader2, RotateCcw, Send, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  crmErrorMessage,
  deleteCrmOrder,
  fetchCrmOrders,
  orderToDraft,
  saveCrmOrder,
  type CrmOrder,
} from '../lib/crm';
import {
  printOrderDraftPdf,
  sendOrderDraftToDiscord,
  type OrderDraft,
} from '../lib/orderDraft';
import { showToast } from '../lib/toast';

interface CrmHistoryPanelProps {
  cloudEnabled: boolean;
  authorLabel: string;
  onReuse: (draft: OrderDraft) => void;
}

export function CrmHistoryPanel({
  cloudEnabled,
  authorLabel,
  onReuse,
}: CrmHistoryPanelProps) {
  const [orders, setOrders] = useState<CrmOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<CrmOrder | null>(null);
  const [sending, setSending] = useState(false);
  const hasWebhook = Boolean(import.meta.env.VITE_DISCORD_ORDERS_WEBHOOK);

  async function reload() {
    if (!cloudEnabled) {
      setOrders([]);
      return;
    }
    setLoading(true);
    try {
      setOrders(await fetchCrmOrders(80));
    } catch (err) {
      showToast(crmErrorMessage(err), 'error', 5000);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, [cloudEnabled]);

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

  return (
    <div className="space-y-3">
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
