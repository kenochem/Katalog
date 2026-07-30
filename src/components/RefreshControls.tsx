import { Loader2, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { requestWaproStockSync } from '../lib/stockSync';
import { showToast } from '../lib/toast';
import { DatabaseSyncIcon } from './DatabaseSyncIcon';

interface RefreshControlsProps {
  loading: boolean;
  onRefresh: () => void;
  canRequestStockSync: boolean;
  className?: string;
}

/**
 * Dwa różne przyciski:
 * - Odśwież = przeładuj katalog z Supabase (to co widać)
 * - Sync WAPRO = zleć pobranie stanów z WAPRO na serwer (nie to samo!)
 */
export function RefreshControls({
  loading,
  onRefresh,
  canRequestStockSync,
  className = '',
}: RefreshControlsProps) {
  const [syncBusy, setSyncBusy] = useState(false);

  async function onSyncStock() {
    setSyncBusy(true);
    try {
      const res = await requestWaproStockSync();
      if (!res.ok) {
        showToast(res.error || 'Nie udało się zlecić syncu WAPRO', 'error');
        return;
      }
      showToast(
        'Zlecono sync stanów z WAPRO (~1–2 min). Potem Odśwież katalog.',
        'info',
        5000,
      );
    } finally {
      setSyncBusy(false);
    }
  }

  const busy = loading || syncBusy;

  return (
    <div className={`flex items-center gap-0.5 ${className}`}>
      <button
        type="button"
        onClick={onRefresh}
        disabled={busy}
        className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-100 disabled:opacity-50"
        title="Odśwież katalog (Supabase) — przeładuj listę produktów"
        aria-label="Odśwież katalog"
      >
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <RefreshCw className="h-5 w-5" />
        )}
      </button>
      {canRequestStockSync && (
        <button
          type="button"
          onClick={() => void onSyncStock()}
          disabled={busy}
          className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-brand-300 disabled:opacity-50"
          title="Sync WAPRO — pobierz stany magazynowe z WAPRO do chmury"
          aria-label="Synchronizuj stany z WAPRO"
        >
          {syncBusy ? (
            <Loader2 className="h-5 w-5 animate-spin text-brand-400" />
          ) : (
            <DatabaseSyncIcon className="h-5 w-5" />
          )}
        </button>
      )}
    </div>
  );
}
