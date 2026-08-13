import { Loader2, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import {
  getLatestStockSync,
  requestWaproStockSync,
  stockSyncScopeLabel,
  type StockSyncScope,
} from '../lib/stockSync';
import { showToast } from '../lib/toast';
import { parseWaproSyncMessage } from '../lib/waproSkuMatch';
import { DatabaseSyncIcon } from './DatabaseSyncIcon';

interface RefreshControlsProps {
  loading: boolean;
  onRefresh: () => void;
  canRequestStockSync: boolean;
  /** Zakres sync WAPRO (domyślnie oba katalogi). */
  catalog?: StockSyncScope;
  className?: string;
}

/**
 * Dwa różne przyciski:
 * - Odśwież = przeładuj katalog z Supabase (to co widać)
 * - Sync WAPRO = zleć pobranie stanów/cen z WAPRO na serwer (dla aktywnej zakładki)
 */
export function RefreshControls({
  loading,
  onRefresh,
  canRequestStockSync,
  catalog = 'all',
  className = '',
}: RefreshControlsProps) {
  const [syncBusy, setSyncBusy] = useState(false);
  const scope: StockSyncScope = catalog;
  const scopeLabel = stockSyncScopeLabel(scope);

  async function onSyncStock() {
    setSyncBusy(true);
    try {
      const res = await requestWaproStockSync(scope);
      if (!res.ok) {
        showToast(res.error || 'Nie udało się zlecić syncu WAPRO', 'error');
        return;
      }
      showToast(
        `Sync WAPRO (${scopeLabel}): stany i ceny jak w Mag — czekam…`,
        'info',
        4000,
      );

      const started = Date.now();
      while (Date.now() - started < 180_000) {
        await new Promise((r) => setTimeout(r, 4000));
        const last = await getLatestStockSync();
        if (!last) continue;
        if (res.id && last.id !== res.id) {
          // Inne zlecenie na wierzchu — nadal czekaj na nasze po id
          if (last.status === 'pending' || last.status === 'running') continue;
        }
        if (last.id === res.id || !res.id) {
          if (last.status === 'done') {
            const parsed = parseWaproSyncMessage(last.message);
            showToast(
              parsed.summary || `Sync ${scopeLabel} zakończony. Odświeżam.`,
              'ok',
              9000,
            );
            if (parsed.warningHint) {
              showToast(parsed.warningHint, 'warn', 10000);
            } else if (parsed.stats.newSkuFromMag && parsed.stats.newSkuFromMag > 0) {
              showToast(
                `Dopisano ${parsed.stats.newSkuFromMag} nowych indeksów z Mag WAPRO (szkielet — uzupełnij zdjęcia)`,
                'info',
                9000,
              );
            } else if (parsed.stats.bootstrapped && parsed.stats.bootstrapped > 0) {
              showToast(
                `Uzupełniono stany/ceny dla ${parsed.stats.bootstrapped} nowych pozycji z Mag`,
                'info',
                7000,
              );
            }
            onRefresh();
            return;
          }
          if (last.status === 'error') {
            showToast(last.message || 'Sync WAPRO zakończył się błędem', 'error', 8000);
            return;
          }
        }
      }
      showToast(
        'Sync nadal trwa / brak wyniku. Sprawdź C:\\katalog-sync\\sync.log na serwerze WAPRO.',
        'info',
        8000,
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
          title={`Sync WAPRO — stany i ceny: ${scopeLabel} (jak w Mag, w górę i w dół)`}
          aria-label={`Synchronizuj stany WAPRO (${scopeLabel})`}
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
