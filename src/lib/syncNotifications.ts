import { pushAppNotification } from './appNotifications';
import { addCatalogLog } from './catalogLogs';
import type { WaproSyncStats } from './waproSkuMatch';

function syncDetails(stats: WaproSyncStats) {
  return {
    'Nowe SKU z Mag': stats.newSkuFromMag ?? 0,
    'Zaktualizowano': stats.updated ?? 0,
    'Bez zmian': stats.unchanged ?? 0,
    'Ręczny stan': stats.manualStock ?? 0,
    'Brak w WAPRO': stats.missingWapro ?? 0,
    'Uzupełnione ceny': stats.filledPrices ?? 0,
    'SKU z SQL': stats.sqlSku ?? 0,
    'Odkryte stany/ceny': stats.bootstrapped ?? 0,
    'Ostrzeżenia': stats.warnings ?? 0,
    'Dopasowane po alt SKU': stats.linkedViaAltSku ?? 0,
    ...(stats.unmatchedReport ? { 'Raport braków': stats.unmatchedReport } : {}),
  };
}

function syncUserMessage(params: {
  scopeLabel: string;
  summary: string;
  stats: WaproSyncStats;
  warningHint?: string;
}) {
  if ((params.stats.newSkuFromMag ?? 0) > 0) {
    return `Dopisano ${params.stats.newSkuFromMag} nowych produktów z WAPRO. Sprawdź zdjęcia, opisy i kategorie.`;
  }
  if ((params.stats.bootstrapped ?? 0) > 0) {
    return `Uzupełniono pierwsze stany lub ceny dla ${params.stats.bootstrapped} pozycji.`;
  }
  if ((params.stats.warnings ?? 0) > 0 || params.warningHint) {
    return params.warningHint ?? 'Sync zakończony, ale część pozycji wymaga ręcznej kontroli.';
  }
  return `Synchronizacja ${params.scopeLabel} zakończona. Dane katalogu są odświeżone.`;
}

export function recordWaproSyncStarted(params: {
  userId?: string;
  requestId?: string;
  scopeLabel: string;
}) {
  addCatalogLog({
    id: params.requestId ? `sync-start-${params.requestId}` : undefined,
    userId: params.userId,
    level: 'info',
    source: 'sync-wapro',
    title: 'Zlecono sync WAPRO',
    message: `Serwer dostał zlecenie synchronizacji stanów i cen: ${params.scopeLabel}.`,
  });
}

export function recordWaproSyncDone(params: {
  userId?: string;
  requestId?: string;
  scopeLabel: string;
  summary: string;
  stats: WaproSyncStats;
  warningHint?: string;
}) {
  const hasNewSku = (params.stats.newSkuFromMag ?? 0) > 0;
  const hasWarning = (params.stats.warnings ?? 0) > 0 || Boolean(params.warningHint);

  addCatalogLog({
    id: params.requestId ? `sync-done-${params.requestId}` : undefined,
    userId: params.userId,
    level: hasWarning ? 'warning' : 'success',
    source: 'sync-wapro',
    title: hasNewSku ? 'Sync WAPRO dodał nowe produkty' : 'Sync WAPRO zakończony',
    message: syncUserMessage(params),
    details: {
      ...syncDetails(params.stats),
      'Raport techniczny': params.summary,
    },
  });

  if (hasNewSku) {
    pushAppNotification({
      id: params.requestId
        ? `sync-new-products-${params.requestId}-${params.userId ?? 'local'}`
        : undefined,
      userId: params.userId,
      kind: 'sync',
      scope: 'catalog',
      title: 'Nowy towar w katalogu',
      body: `Po sync WAPRO dopisano ${params.stats.newSkuFromMag} nowych indeksów. Sprawdź logi i uzupełnij zdjęcia/opisy.`,
      actionView: 'logs',
    });
  } else if (params.stats.bootstrapped && params.stats.bootstrapped > 0) {
    pushAppNotification({
      id: params.requestId
        ? `sync-bootstrap-${params.requestId}-${params.userId ?? 'local'}`
        : undefined,
      userId: params.userId,
      kind: 'sync',
      scope: 'catalog',
      title: 'Uzupełniono dane WAPRO',
      body: `Sync uzupełnił stany lub ceny dla ${params.stats.bootstrapped} pozycji.`,
      actionView: 'logs',
    });
  }
}

export function recordWaproSyncError(params: {
  userId?: string;
  requestId?: string;
  scopeLabel: string;
  message: string;
}) {
  addCatalogLog({
    id: params.requestId ? `sync-error-${params.requestId}` : undefined,
    userId: params.userId,
    level: 'error',
    source: 'sync-wapro',
    title: 'Sync WAPRO zakończył się błędem',
    message: params.message || `Synchronizacja ${params.scopeLabel} nie została zakończona.`,
  });
  pushAppNotification({
    id: params.requestId
      ? `sync-error-${params.requestId}-${params.userId ?? 'local'}`
      : undefined,
    userId: params.userId,
    kind: 'sync',
    scope: 'catalog',
    title: 'Błąd synchronizacji WAPRO',
    body: params.message || 'Sprawdź logi synchronizacji.',
    actionView: 'logs',
  });
}
