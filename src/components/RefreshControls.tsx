import { Loader2, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import {
  getLatestStockSync,
  requestWaproStockSync,
  stockSyncScopeLabel,
  type StockSyncScope,
} from '../lib/stockSync';
import { useAuth } from '../lib/auth';
import { showToast } from '../lib/toast';
import {
  recordWaproSyncDone,
  recordWaproSyncError,
  recordWaproSyncStarted,
} from '../lib/syncNotifications';
import { parseWaproSyncMessage } from '../lib/waproSkuMatch';
import { DatabaseSyncIcon } from './DatabaseSyncIcon';
import type { Product } from '../types';
import { roleCan } from '../lib/roles';
import { refreshBaselinkerLinks } from '../lib/baselinkerApi';
import { refreshLiveLinks } from '../lib/baselinkerLive';
import { hasBaselinkerLink } from '../lib/baselinkerLink';
import { isWaproSkeletonProduct } from '../lib/productMeta';

interface RefreshControlsProps {
  loading: boolean;
  onRefresh: () => void | Promise<void>;
  canRequestStockSync: boolean;
  /** Zakres sync WAPRO (domyślnie oba katalogi). */
  catalog?: StockSyncScope;
  className?: string;
  /** Pokaż przycisk weryfikacji BaseLinker (znaczniki B / W). */
  showBaselinkerVerify?: boolean;
  /** Produkty do podsumowania po weryfikacji (ile B / W). */
  products?: Product[];
}

/** Logo przycisku: niebieskie „B” i pomarańczowe „W” — takie same jak znaczniki na kafelkach. */
function BaselinkerVerifyIcon({ spinning }: { spinning: boolean }) {
  return (
    <span className="relative inline-flex h-5 w-6 items-center" aria-hidden>
      <span
        className={`absolute left-0 top-0 flex h-[18px] w-[18px] items-center justify-center rounded-[5px] text-[11px] font-extrabold leading-none text-white shadow ${
          spinning ? 'animate-pulse' : ''
        }`}
        style={{ backgroundColor: '#2563eb', boxShadow: '0 0 0 1px rgba(37,99,235,0.45)' }}
      >
        B
      </span>
      <span
        className={`absolute bottom-0 right-0 flex h-[14px] w-[14px] items-center justify-center rounded-[4px] text-[9px] font-extrabold leading-none text-white ring-2 ring-slate-900 ${
          spinning ? 'animate-pulse' : ''
        }`}
        style={{ backgroundColor: '#f97316' }}
      >
        W
      </span>
    </span>
  );
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
  showBaselinkerVerify = false,
  products,
}: RefreshControlsProps) {
  const { user, role } = useAuth();
  const [syncBusy, setSyncBusy] = useState(false);
  const [blBusy, setBlBusy] = useState(false);
  const scope: StockSyncScope = catalog;
  const scopeLabel = stockSyncScopeLabel(scope);
  const userId = user?.id;

  async function onSyncStock() {
    setSyncBusy(true);
    try {
      const res = await requestWaproStockSync(scope);
      if (!res.ok) {
        showToast(res.error || 'Nie udało się zlecić syncu WAPRO', 'error');
        recordWaproSyncError({
          userId,
          scopeLabel,
          message: res.error || 'Nie udało się zlecić syncu WAPRO',
        });
        return;
      }
      recordWaproSyncStarted({ userId, requestId: res.id, scopeLabel });
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
            recordWaproSyncDone({
              userId,
              requestId: last.id,
              scopeLabel,
              summary: parsed.summary,
              stats: parsed.stats,
              warningHint: parsed.warningHint,
            });
            showToast(
              parsed.summary || `Sync ${scopeLabel} zakończony. Odświeżam.`,
              'ok',
              9000,
            );
            if (parsed.stats.newSkuFromMag && parsed.stats.newSkuFromMag > 0) {
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
            if (parsed.warningHint) {
              showToast(parsed.warningHint, 'info', 10000);
            }
            await onRefresh();
            return;
          }
          if (last.status === 'error') {
            const message = last.message || 'Sync WAPRO zakończył się błędem';
            recordWaproSyncError({
              userId,
              requestId: last.id,
              scopeLabel,
              message,
            });
            showToast(message, 'error', 8000);
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

  const busy = loading || syncBusy || blBusy;

  /**
   * Weryfikacja znaczników BaseLinker: administrator (uprawnienie manageBaselinker) odświeża powiązania
   * z żywą listą produktów w BL; pozostali — pobierają aktualne powiązania z bazy.
   */
  async function onVerifyBaselinker() {
    setBlBusy(true);
    try {
      let serverNote = '';
      if (roleCan(role, 'manageBaselinker')) {
        const r = await refreshBaselinkerLinks();
        if (r.skipped) serverNote = ' (powiązania odświeżone niedawno)';
        else if (typeof r.bl === 'number')
          serverNote = ` · w BaseLinkerze: ${r.bl} produktów${r.removed ? `, usunięte powiązania: ${r.removed}` : ''}`;
      }
      await refreshLiveLinks(true);
      let counts = '';
      if (products && products.length) {
        let b = 0;
        let w = 0;
        for (const p of products) {
          if (p.isGroup) continue;
          if (hasBaselinkerLink(p)) b++;
          else if (isWaproSkeletonProduct(p)) w++;
        }
        counts = `B (wystawione): ${b} · W (do uzupełnienia, brak w BL): ${w}`;
      }
      showToast(
        `BaseLinker zweryfikowany. ${counts}${serverNote}`.trim(),
        'ok',
        9000,
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Nie udało się zweryfikować BaseLinkera', 'error', 7000);
    } finally {
      setBlBusy(false);
    }
  }

  return (
    <div className={`flex items-center gap-0.5 ${className}`}>
      {showBaselinkerVerify && (
        <button
          type="button"
          onClick={() => void onVerifyBaselinker()}
          disabled={busy}
          className="mr-1 rounded-lg p-2.5 hover:bg-slate-800 disabled:opacity-60 sm:p-2"
          title="Weryfikacja BaseLinker — odśwież znaczniki B (wystawione w BL) i W (do uzupełnienia)"
          aria-label="Weryfikuj produkty w BaseLinkerze"
        >
          <BaselinkerVerifyIcon spinning={blBusy} />
        </button>
      )}
      <button
        type="button"
        onClick={onRefresh}
        disabled={busy}
        className="rounded-lg p-2.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100 disabled:opacity-50 sm:p-2"
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
          className="rounded-lg p-2.5 text-slate-400 hover:bg-slate-800 hover:text-brand-300 disabled:opacity-50 sm:p-2"
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
