/** Formatowanie stanu magazynowego (wspólne, lekkie). */
export function formatStock(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/** Marża % jak w WAPRO: (sprzedaż netto − zakup netto) / sprzedaż netto × 100. */
export function marginPercent(
  purchaseNet: number | undefined | null,
  saleNet: number | undefined | null,
): number | null {
  const buy = Number(purchaseNet);
  const sell = Number(saleNet);
  if (!Number.isFinite(buy) || !Number.isFinite(sell) || sell <= 0) return null;
  return ((sell - buy) / sell) * 100;
}

export function formatPricePln(value: number | undefined | null): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return (
    n.toLocaleString('pl-PL', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + ' zł'
  );
}

export function inferGrossFromNet(
  saleNet: number | undefined | null,
  vatRate: number | undefined | null = 23,
): number | null {
  const net = Number(saleNet);
  const vat = Number(vatRate ?? 23);
  if (!Number.isFinite(net)) return null;
  const rate = Number.isFinite(vat) && vat >= 0 ? vat : 23;
  return Math.round(net * (1 + rate / 100) * 100) / 100;
}

export function customerGrossPrice(
  saleGross: number | undefined | null,
  saleNet: number | undefined | null,
  vatRate: number | undefined | null = 23,
): number | null {
  const gross = Number(saleGross);
  if (Number.isFinite(gross)) return gross;
  return inferGrossFromNet(saleNet, vatRate);
}

export function formatMarginPercent(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

/** Opisy z Baselinker często mają HTML — do wyświetlenia zostaw czysty tekst. */
export function stripHtml(html: string | undefined | null, maxLen = 500): string {
  if (!html) return '';
  let text = String(html)
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/\s*p\s*>/gi, '\n')
    .replace(/<\s*li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, ' ')
    // obcięty w połowie tag (np. po limicie 500 znaków w starym imporcie)
    .replace(/<[^>]*$/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
  if (maxLen > 0 && text.length > maxLen) {
    text = text.slice(0, maxLen - 1).trimEnd() + '…';
  }
  return text;
}
