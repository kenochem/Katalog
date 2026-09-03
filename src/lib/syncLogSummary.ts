import type { CatalogLogEntry } from './catalogLogs';
import type { WaproSyncStats } from './waproSkuMatch';

export type SyncDetailLine = {
  id: string;
  label: string;
  value: string | number;
  description: string;
  tone: 'good' | 'warn' | 'neutral' | 'info';
};

export type SyncLogSummary = {
  title: string;
  body: string;
  lines: SyncDetailLine[];
  notes: string[];
  technical?: string;
};

function findNumber(raw: string, pattern: RegExp): number | undefined {
  const match = raw.match(pattern);
  if (!match?.[1]) return undefined;
  const value = Number(match[1].replace(/\s/g, ''));
  return Number.isFinite(value) ? value : undefined;
}

export function humanScope(scope: string | null | undefined) {
  if (!scope || scope === 'all') return 'oba katalogi (Akcesoria + Produkty)';
  if (scope === 'shop') return 'Produkty sklepu';
  if (scope === 'accessories') return 'Akcesoria';
  return scope;
}

export function parseSyncReportFields(
  message: string | null | undefined,
  details?: CatalogLogEntry['details'],
): WaproSyncStats & {
  scope?: string;
  mode?: string;
  unmatchedReport?: string;
} {
  const detailRecord = details ?? {};
  const fromDetails = (label: string) => {
    const v = detailRecord[label];
    return typeof v === 'number' ? v : undefined;
  };
  const technicalFromDetails =
    typeof detailRecord['Raport techniczny'] === 'string'
      ? String(detailRecord['Raport techniczny']).trim()
      : '';
  const raw = technicalFromDetails || (message ?? '').trim();

  return {
    mode: raw.match(/Tryb WAPRO:\s*([^.,]+)/i)?.[1]?.trim(),
    scope: raw.match(/Zakres:\s*([^.,]+)/i)?.[1]?.trim(),
    newSkuFromMag:
      findNumber(raw, /nowe SKU z Mag:\s*(\d+)/i) ?? fromDetails('Nowe SKU z Mag'),
    updated: findNumber(raw, /Zaktualizowano:\s*(\d+)/i) ?? fromDetails('Zaktualizowano'),
    unchanged: findNumber(raw, /bez zmian:\s*(\d+)/i) ?? fromDetails('Bez zmian'),
    manualStock: findNumber(raw, /reczne stan:\s*(\d+)/i) ?? fromDetails('Ręczny stan'),
    missingWapro:
      findNumber(raw, /brak w WAPRO:\s*(\d+)/i) ?? fromDetails('Brak w WAPRO'),
    filledPrices:
      findNumber(raw, /uzupelnione pola cen:\s*(\d+)/i) ?? fromDetails('Uzupełnione ceny'),
    sqlSku: findNumber(raw, /SKU z SQL:\s*(\d+)/i) ?? fromDetails('SKU z SQL'),
    linkedViaAltSku:
      findNumber(raw, /dopasowane po (?:legacy|alt)[^:]*:\s*(\d+)/i) ??
      fromDetails('Dopasowane po alt SKU'),
    bootstrapped:
      findNumber(raw, /odkryte[^:]*:\s*(\d+)/i) ?? fromDetails('Odkryte stany/ceny'),
    warnings: findNumber(raw, /ostrzezenia:\s*(\d+)/i) ?? fromDetails('Ostrzeżenia'),
    unmatchedReport:
      raw.match(/raport brakow:\s*([^.,]+)/i)?.[1]?.trim() ??
      (typeof detailRecord['Raport braków'] === 'string'
        ? String(detailRecord['Raport braków']).trim()
        : undefined),
  };
}

export function buildSyncLogSummary(
  message: string | null | undefined,
  details?: CatalogLogEntry['details'],
): SyncLogSummary {
  const visibleMessage = (message ?? '').trim();
  const fields = parseSyncReportFields(message, details);
  const raw =
    (typeof details?.['Raport techniczny'] === 'string'
      ? String(details['Raport techniczny']).trim()
      : '') || visibleMessage;
  const looksLikeSyncReport =
    /Tryb WAPRO|Zaktualizowano:|SKU z SQL|nowe SKU z Mag|brak w WAPRO/i.test(raw);

  const lines: SyncDetailLine[] = [];
  const notes: string[] = [];

  if (fields.mode) {
    lines.push({
      id: 'mode',
      label: 'Tryb synchronizacji',
      value: fields.mode,
      description: 'Sposób dopasowania indeksów katalogowych do eksportu Mag WAPRO.',
      tone: 'info',
    });
  }

  if (fields.scope) {
    lines.push({
      id: 'scope',
      label: 'Zakres',
      value: humanScope(fields.scope),
      description: 'Która część katalogu została objęta tym przebiegiem sync.',
      tone: 'info',
    });
  }

  if (fields.sqlSku !== undefined) {
    lines.push({
      id: 'sqlSku',
      label: 'Wiersze z WAPRO (SQL)',
      value: fields.sqlSku,
      description:
        fields.sqlSku === 0
          ? 'Eksport SQL z Mag zwrócił 0 wierszy — sync nie mógł zaktualizować stanów. Sprawdź C:\\katalog-sync\\sync.log i plik wapro-stock.csv na serwerze.'
          : 'Liczba indeksów odczytanych z eksportu Mag WAPRO w tym przebiegu.',
      tone: fields.sqlSku === 0 ? 'warn' : 'neutral',
    });
  }

  if ((fields.newSkuFromMag ?? 0) > 0) {
    lines.push({
      id: 'newSku',
      label: 'Nowe produkty z Mag',
      value: fields.newSkuFromMag!,
      description:
        'Nowe indeksy dopisane do katalogu. Warto uzupełnić zdjęcia, opisy i kategorie w widoku „Decyzje” lub „Bez zdjęć”.',
      tone: 'good',
    });
  }

  if ((fields.updated ?? 0) > 0) {
    lines.push({
      id: 'updated',
      label: 'Zaktualizowane pozycje',
      value: fields.updated!,
      description: 'Produkty, u których stan magazynowy lub cena uległa zmianie względem poprzedniego stanu katalogu.',
      tone: 'good',
    });
  }

  if ((fields.filledPrices ?? 0) > 0) {
    lines.push({
      id: 'filledPrices',
      label: 'Uzupełnione ceny',
      value: fields.filledPrices!,
      description: 'Pozycje z pustymi polami cenowymi — sync wypełnił je danymi z WAPRO.',
      tone: 'good',
    });
  }

  if ((fields.bootstrapped ?? 0) > 0) {
    lines.push({
      id: 'bootstrapped',
      label: 'Pierwsze stany/ceny',
      value: fields.bootstrapped!,
      description:
        'Produkty, które wcześniej nie miały stanu ani ceny w katalogu — ten sync uzupełnił je po raz pierwszy z Mag.',
      tone: 'good',
    });
  }

  if ((fields.linkedViaAltSku ?? 0) > 0) {
    lines.push({
      id: 'altSku',
      label: 'Dopasowanie po alt SKU',
      value: fields.linkedViaAltSku!,
      description:
        'Pozycje dopasowane po historycznym SKU, legacySku lub innym polu meta — główny indeks katalogowy różnił się od WAPRO.',
      tone: 'info',
    });
  }

  if ((fields.manualStock ?? 0) > 0) {
    lines.push({
      id: 'manualStock',
      label: 'Ręczny stan (pominięte)',
      value: fields.manualStock!,
      description:
        'Produkty ze stanem ustawionym ręcznie w katalogu — sync celowo nie nadpisał tych wartości.',
      tone: 'info',
    });
  }

  if ((fields.unchanged ?? 0) > 0) {
    lines.push({
      id: 'unchanged',
      label: 'Bez zmian',
      value: fields.unchanged!,
      description: 'Pozycje już zsynchronizowane — stan i ceny w katalogu były aktualne.',
      tone: 'neutral',
    });
  }

  if ((fields.missingWapro ?? 0) > 0) {
    const reportHint = fields.unmatchedReport
      ? ` Pełna lista w pliku ${fields.unmatchedReport} na serwerze (C:\\katalog-sync\\).`
      : ' Szczegóły w pliku sync-unmatched-products.csv na serwerze.';
    lines.push({
      id: 'missingWapro',
      label: 'Brak w Mag WAPRO',
      value: fields.missingWapro!,
      description:
        `Indeksy obecne w katalogu, ale bez odpowiednika w eksporcie Mag. To lista porządkowa — nie blokuje dodawania nowych produktów.${reportHint}`,
      tone: 'warn',
    });
  }

  if ((fields.warnings ?? 0) > 0) {
    lines.push({
      id: 'warnings',
      label: 'Ostrzeżenia sync',
      value: fields.warnings!,
      description:
        'Pozycje wymagające uwagi (np. konflikt SKU, brak ceny w WAPRO, podejrzany placeholder). Sprawdź raport techniczny poniżej.',
      tone: 'warn',
    });
  }

  let title = 'Synchronizacja zakończona';
  let body = fields.scope
    ? `Przebieg sync objął: ${humanScope(fields.scope)}.`
    : 'Sync WAPRO zakończył przetwarzanie danych katalogu.';

  if ((fields.newSkuFromMag ?? 0) > 0) {
    title = `Dopisano ${fields.newSkuFromMag} nowych produktów`;
    body = `Mag WAPRO zwrócił nowe indeksy — trafiły do katalogu. Następny krok: zdjęcia, opisy i kategorie.`;
  } else if ((fields.updated ?? 0) > 0 || (fields.bootstrapped ?? 0) > 0) {
    title = 'Odświeżono stany i ceny';
    body = `Zaktualizowano dane w katalogu w zakresie: ${humanScope(fields.scope)}.`;
  } else if ((fields.missingWapro ?? 0) > 0 || (fields.warnings ?? 0) > 0) {
    title = 'Sync zakończony — są pozycje do kontroli';
    body =
      'Dane zostały przetworzone, ale część indeksów wymaga ręcznej weryfikacji (szczegóły poniżej).';
  } else if (fields.sqlSku === 0) {
    title = 'Sync bez danych z WAPRO';
    body =
      'Eksport SQL z Mag zwrócił 0 wierszy — stany w katalogu mogły pozostać bez zmian. Sprawdź serwer sync.';
  }

  if (!looksLikeSyncReport && lines.length === 0) {
    const isStart = /zlecenie|zlecono|czekam/i.test(visibleMessage);
    return {
      title: isStart ? 'Sync został zlecony' : 'Komunikat katalogu',
      body: visibleMessage || 'Ten wpis nie zawiera jeszcze raportu z serwera.',
      lines: [],
      notes: [],
    };
  }

  if ((fields.missingWapro ?? 0) > 0 && fields.unmatchedReport) {
    notes.push(`Raport braków zapisany jako: ${fields.unmatchedReport}`);
  }

  return {
    title,
    body,
    lines,
    notes,
    technical: looksLikeSyncReport ? raw : undefined,
  };
}
