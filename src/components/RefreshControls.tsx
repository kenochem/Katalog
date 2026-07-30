import { useState } from 'react';
import { Loader2, RefreshCw, Database } from 'lucide-react';
import { requestWaproStockSync } from '../lib/stockSync';
import { showToast } from '../lib/toast';

interface RefreshControlsProps {
  loading: boolean;
  onRefresh: () => void;
  canRequestStockSync: boolean;
  className?: string;
}

/** Odśwież + osobny przycisk sync WAPRO (obok). */
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
        showToast(res.error || 'Nie udało się zlecić syncu', 'error');
        return;
      }
      showToast(
        'Zlecono sync WAPRO — zwykle 1–2 min, potem Odśwież',
        'info',
        4500,
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
        title="Odśwież katalog z bazy"
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
          title="Synchronizuj stany z WAPRO"
          aria-label="Synchronizuj stany z WAPRO"
        >
          {syncBusy ? (
            <Loader2 className="h-5 w-5 animate-spin text-brand-400" />
          ) : (
            <Database className="h-5 w-5" />
          )}
        </button>
      )}
    </div>
  );
}
