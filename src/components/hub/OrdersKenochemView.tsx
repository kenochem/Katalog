import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, ShoppingBag } from 'lucide-react';
import {
  crmErrorMessage,
  fetchCrmOrders,
  type CrmOrder,
} from '../../lib/crm';
import { formatPricePln } from '../../lib/format';
import { dispatchCrmTab } from '../../lib/hubSegmentNav';

function orderTotal(order: CrmOrder): number {
  return order.items.reduce((s, i) => {
    const price = i.unitPriceGross ?? i.unitPriceNet ?? 0;
    return s + price * i.quantity;
  }, 0);
}

export function OrdersKenochemView({ cloudEnabled }: { cloudEnabled: boolean }) {
  const [orders, setOrders] = useState<CrmOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!cloudEnabled) {
      setOrders([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setOrders(await fetchCrmOrders(100));
    } catch (e) {
      setError(crmErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [cloudEnabled]);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    const sent = orders.filter((o) => o.status === 'sent').length;
    const saved = orders.filter((o) => o.status === 'saved').length;
    return { sent, saved, total: orders.length };
  }, [orders]);

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-4xl flex-col px-3 py-5 sm:px-5">
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/15 text-violet-400">
          <ShoppingBag className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-xl font-bold text-slate-50">Zamówienia CRM</h1>
          <p className="text-sm text-slate-500">
            Zapisane oferty i wysłane zamówienia z Supabase ({stats.total}).
          </p>
        </div>
      </div>

      {!cloudEnabled && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Zaloguj się, aby wczytać zamówienia z chmury.
        </p>
      )}

      <div className="mb-3 grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 py-2">
          <p className="text-slate-500">Wysłane</p>
          <p className="text-lg font-bold text-slate-100">{stats.sent}</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 py-2">
          <p className="text-slate-500">Szkice</p>
          <p className="text-lg font-bold text-slate-100">{stats.saved}</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 py-2">
          <p className="text-slate-500">Razem</p>
          <p className="text-lg font-bold text-slate-100">{stats.total}</p>
        </div>
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-brand-400" />
        </div>
      )}

      {error && (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </p>
      )}

      {!loading && !error && orders.length === 0 && cloudEnabled && (
        <p className="text-center text-sm text-slate-500">Brak zamówień w bazie.</p>
      )}

      <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto pb-4">
        {orders.map((order) => (
          <li key={order.id}>
            <button
              type="button"
              onClick={() => dispatchCrmTab('history')}
              className="flex w-full flex-col gap-1 rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3 text-left hover:border-slate-700 sm:flex-row sm:items-center"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-slate-100">{order.clientName || 'Klient'}</p>
                <p className="text-xs text-slate-500">
                  {new Date(order.createdAt).toLocaleString('pl-PL')} · {order.items.length} poz.
                  · {order.kind === 'quote' ? 'Oferta' : 'Zamówienie'}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    order.status === 'sent'
                      ? 'bg-emerald-500/15 text-emerald-300'
                      : 'bg-slate-700 text-slate-300'
                  }`}
                >
                  {order.status === 'sent' ? 'Wysłane' : 'Zapisane'}
                </span>
                <span className="text-sm font-semibold tabular-nums text-slate-200">
                  {formatPricePln(orderTotal(order))}
                </span>
              </div>
            </button>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => dispatchCrmTab('history')}
        className="shrink-0 rounded-xl bg-brand-600 py-2.5 text-sm font-medium text-white hover:bg-brand-500"
      >
        Otwórz pełną historię w CRM
      </button>
    </div>
  );
}
