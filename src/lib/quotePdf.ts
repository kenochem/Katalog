import { formatPricePln } from './format';
import type { OrderDraft, OrderDraftItem } from './orderDraft';

const VAT_RATE = 0.23;

export const QUOTE_DISCOUNT_PRESETS = [5, 10, 15, 20, 25, 30, 35, 40] as const;

export interface QuoteLineCalc {
  unitNet: number;
  lineSubtotal: number;
  lineDiscountPct: number;
  lineDiscountAmount: number;
  lineNet: number;
}

export interface QuoteLineTotals {
  /** Suma pozycji przed rabatami (cena × ilość). */
  subtotalNet: number;
  lineDiscountAmount: number;
  globalDiscountPct: number;
  globalDiscountAmount: number;
  /** Łączna kwota upustu (pozycje + globalny). */
  totalDiscountAmount: number;
  transportCost: number;
  totalNet: number;
  totalGross: number;
}

function clampPct(n: number): number {
  return Math.min(100, Math.max(0, n));
}

export function resolveQuoteUnitNet(
  item: OrderDraftItem,
  catalogNet?: number | null,
): number {
  if (item.unitPriceNet != null && Number.isFinite(item.unitPriceNet)) {
    return Math.max(0, item.unitPriceNet);
  }
  return Math.max(0, catalogNet ?? 0);
}

export function computeQuoteLine(
  item: OrderDraftItem,
  catalogNet?: number | null,
): QuoteLineCalc {
  const unitNet = resolveQuoteUnitNet(item, catalogNet);
  const lineSubtotal = unitNet * item.quantity;
  const lineDiscountPct = clampPct(item.lineDiscountPct ?? 0);
  const lineDiscountAmount = lineSubtotal * (lineDiscountPct / 100);
  const lineNet = Math.max(0, lineSubtotal - lineDiscountAmount);
  return { unitNet, lineSubtotal, lineDiscountPct, lineDiscountAmount, lineNet };
}

export function computeQuoteTotals(
  items: OrderDraftItem[],
  catalogNetBySku: Map<string, number>,
  globalDiscountPct: number,
  transportCost = 0,
): QuoteLineTotals {
  let subtotalNet = 0;
  let lineDiscountAmount = 0;
  let afterLine = 0;

  for (const item of items) {
    const line = computeQuoteLine(item, catalogNetBySku.get(item.sku.toUpperCase()));
    subtotalNet += line.lineSubtotal;
    lineDiscountAmount += line.lineDiscountAmount;
    afterLine += line.lineNet;
  }

  const globalPct = clampPct(globalDiscountPct);
  const globalDiscountAmount = afterLine * (globalPct / 100);
  const transport = Math.max(0, transportCost);
  const totalNet = Math.max(0, afterLine - globalDiscountAmount) + transport;
  const totalDiscountAmount = lineDiscountAmount + globalDiscountAmount;
  const totalGross = totalNet * (1 + VAT_RATE);

  return {
    subtotalNet,
    lineDiscountAmount,
    globalDiscountPct: globalPct,
    globalDiscountAmount,
    totalDiscountAmount,
    transportCost: transport,
    totalNet,
    totalGross,
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDatePl(d: Date): string {
  return d.toLocaleDateString('pl-PL', { day: '2-digit', month: 'long', year: 'numeric' });
}

function quoteLogoUrl(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/kenochem-logo.png`;
  }
  return '/kenochem-logo.png';
}

export interface QuoteClientInfo {
  address?: string;
  nip?: string;
}

/** Buduje pełny HTML oferty (do podglądu w nowej karcie / wydruku do PDF). */
export function buildQuoteHtml(
  draft: OrderDraft,
  authorLabel: string,
  catalogNetBySku: Map<string, number>,
  quoteNumber: string,
  client?: QuoteClientInfo,
): string {
  const totals = computeQuoteTotals(
    draft.items,
    catalogNetBySku,
    draft.discountPct ?? 0,
    draft.transportCost,
  );
  const validDays = draft.quoteValidDays ?? 14;
  const issued = new Date();
  const validUntil = new Date(issued);
  validUntil.setDate(validUntil.getDate() + validDays);
  const logoUrl = quoteLogoUrl();

  const rows = draft.items
    .map((item, idx) => {
      const line = computeQuoteLine(item, catalogNetBySku.get(item.sku.toUpperCase()));
      const img = item.imageUrl
        ? `<img src="${escapeHtml(item.imageUrl)}" alt="" width="40" height="40" style="object-fit:contain;border-radius:4px;background:#f4f4f5" />`
        : '';
      const discountCell =
        line.lineDiscountPct > 0
          ? `<td class="discount"><span class="discount-pct">${line.lineDiscountPct}%</span><span class="discount-amt">−${escapeHtml(formatPricePln(line.lineDiscountAmount))}</span></td>`
          : `<td class="discount discount-empty">—</td>`;
      return `<tr>
        <td class="num">${idx + 1}</td>
        <td class="img">${img}</td>
        <td class="sku">${escapeHtml(item.sku)}</td>
        <td class="name">${escapeHtml(item.displayName)}</td>
        <td class="num">${item.quantity}</td>
        <td class="money">${escapeHtml(formatPricePln(line.unitNet))}</td>
        ${discountCell}
        <td class="money">${escapeHtml(formatPricePln(line.lineNet))}</td>
      </tr>`;
    })
    .join('');

  const discountRow =
    totals.totalDiscountAmount > 0
      ? `<tr class="summary-discount">
          <td colspan="7" class="label">Rabat łącznie${totals.globalDiscountPct > 0 ? ` (w tym globalny ${totals.globalDiscountPct}%)` : ''}</td>
          <td class="money">−${escapeHtml(formatPricePln(totals.totalDiscountAmount))}</td>
        </tr>`
      : '';

  const transportRow =
    totals.transportCost > 0
      ? `<tr>
          <td class="label">Transport</td>
          <td class="money">${escapeHtml(formatPricePln(totals.transportCost))}</td>
        </tr>`
      : '';

  const clientMetaParts = [
    client?.address?.trim() ? escapeHtml(client.address.trim()) : '',
    client?.nip?.trim() ? `NIP ${escapeHtml(client.nip.trim())}` : '',
  ].filter(Boolean);
  const clientMetaBlock = clientMetaParts.length
    ? `<p class="party-meta">${clientMetaParts.join('<br/>')}</p>`
    : '';

  const noteBlock = draft.note.trim()
    ? `<div class="notes">
        <p class="notes-title">Uwagi</p>
        <p>${escapeHtml(draft.note.trim()).replace(/\n/g, '<br/>')}</p>
      </div>`
    : '';

  const html = `<!DOCTYPE html><html lang="pl"><head><meta charset="utf-8"/>
<title>Oferta — ${escapeHtml(draft.clientName.trim() || 'Kenochem')}</title>
<style>
  *{box-sizing:border-box}
  body{font-family:"Segoe UI",system-ui,sans-serif;margin:0;padding:32px 40px;color:#18181b;background:#fff;font-size:13px;line-height:1.45}
  .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #16a34a;padding-bottom:20px;margin-bottom:24px}
  .brand img{height:52px;width:auto;max-width:240px;object-fit:contain;display:block}
  .brand-sub{font-size:11px;color:#71717a;margin-top:6px;text-transform:uppercase;letter-spacing:0.08em}
  .doc-title{text-align:right}
  .doc-title h1{margin:0;font-size:22px;font-weight:700;color:#18181b}
  .doc-title p{margin:4px 0 0;font-size:12px;color:#52525b}
  .parties{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:28px}
  .party-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#16a34a;margin-bottom:6px}
  .party-name{font-size:16px;font-weight:600;color:#18181b}
  .party-meta{font-size:12px;color:#52525b;margin-top:4px}
  table.items{width:100%;border-collapse:collapse;margin-bottom:20px}
  table.items th{text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#52525b;padding:10px 8px;border-bottom:2px solid #18181b;background:#fafafa}
  table.items td{padding:10px 8px;border-bottom:1px solid #e4e4e7;vertical-align:middle}
  table.items td.num{text-align:center;width:32px;color:#71717a}
  table.items td.img{width:48px}
  table.items td.sku{font-family:Consolas,monospace;font-size:11px;color:#16a34a;white-space:nowrap}
  table.items td.name{font-size:12px;max-width:280px}
  table.items td.money{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums;font-weight:500}
  table.items td.discount{text-align:center;white-space:nowrap;min-width:4.5rem}
  table.items td.discount .discount-pct{display:block;font-weight:700;color:#b45309;font-size:12px}
  table.items td.discount .discount-amt{display:block;font-size:10px;color:#78716c;margin-top:2px}
  table.items td.discount-empty{color:#a8a29e}
  table.totals{width:100%;max-width:320px;margin-left:auto;border-collapse:collapse}
  table.totals td{padding:6px 0;font-size:13px}
  table.totals td.label{text-align:right;padding-right:16px;color:#52525b}
  table.totals td.money{text-align:right;font-variant-numeric:tabular-nums;font-weight:600}
  table.totals tr.grand td{font-size:16px;padding-top:10px;border-top:2px solid #18181b;color:#16a34a}
  .summary-discount td{color:#b45309}
  .notes{margin-top:28px;padding:16px 18px;background:#f4f4f5;border-radius:8px;border-left:4px solid #16a34a}
  .notes-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#52525b;margin:0 0 6px}
  .notes p{margin:0;font-size:12px;color:#3f3f46}
  .footer{margin-top:36px;padding-top:16px;border-top:1px solid #e4e4e7;font-size:11px;color:#71717a;display:flex;justify-content:space-between}
  @media print{
    body{padding:16px 20px}
    @page{margin:12mm}
  }
</style></head><body>
  <div class="header">
    <div class="brand">
      <img src="${escapeHtml(logoUrl)}" alt="Kenochem" />
      <div class="brand-sub">Chemia · Akcesoria · Detailing</div>
    </div>
    <div class="doc-title">
      <h1>Oferta handlowa</h1>
      <p>Nr ${escapeHtml(quoteNumber)}</p>
      <p>Data: ${escapeHtml(formatDatePl(issued))}</p>
      <p>Ważna do: ${escapeHtml(formatDatePl(validUntil))}</p>
    </div>
  </div>
  <div class="parties">
    <div>
      <p class="party-label">Dla klienta</p>
      <p class="party-name">${escapeHtml(draft.clientName.trim() || '—')}</p>
      ${clientMetaBlock}
    </div>
    <div>
      <p class="party-label">Przygotował</p>
      <p class="party-name">${escapeHtml(authorLabel)}</p>
      <p class="party-meta">Kenochem · oferta netto + VAT 23%</p>
    </div>
  </div>
  <table class="items">
    <thead>
      <tr>
        <th>Lp.</th>
        <th></th>
        <th>SKU</th>
        <th>Nazwa produktu</th>
        <th style="text-align:center">Ilość</th>
        <th style="text-align:right">Cena netto</th>
        <th style="text-align:center">Rabat</th>
        <th style="text-align:right">Wartość netto</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <table class="totals">
    <tr>
      <td class="label">Suma netto</td>
      <td class="money">${escapeHtml(formatPricePln(totals.subtotalNet))}</td>
    </tr>
    ${discountRow}
    ${transportRow}
    <tr>
      <td class="label">Razem netto</td>
      <td class="money">${escapeHtml(formatPricePln(totals.totalNet))}</td>
    </tr>
    <tr>
      <td class="label">VAT 23%</td>
      <td class="money">${escapeHtml(formatPricePln(totals.totalGross - totals.totalNet))}</td>
    </tr>
    <tr class="grand">
      <td class="label">Do zapłaty brutto</td>
      <td class="money">${escapeHtml(formatPricePln(totals.totalGross))}</td>
    </tr>
  </table>
  ${noteBlock}
  <div class="footer">
    <span>Oferta ma charakter informacyjny. Ceny netto w PLN.</span>
    <span>Wygenerowano ${escapeHtml(formatDatePl(issued))}</span>
  </div>
  <div class="print-bar no-print">
    <button type="button" onclick="window.print()">Pobierz / drukuj PDF</button>
  </div>
  <style>
    .print-bar{position:fixed;right:20px;bottom:20px;z-index:10}
    .print-bar button{background:#16a34a;color:#fff;border:0;border-radius:8px;padding:12px 20px;font-size:14px;font-weight:600;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.25)}
    .print-bar button:hover{background:#15803d}
    @media print{.no-print{display:none !important}}
  </style>
</body></html>`;

  return html;
}

/** Otwiera wygenerowany dokument oferty w nowej karcie — pelni role podgladu,
 * a przycisk w dokumencie ("Pobierz / drukuj PDF") uruchamia wydruk / zapis do PDF.
 * Z autoPrint=true od razu uruchamia dialog drukowania (skrot dla "Pobierz"). */
export function openQuoteDocument(html: string, autoPrint = false): void {
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (!win) {
    URL.revokeObjectURL(url);
    return;
  }
  if (autoPrint) {
    setTimeout(() => {
      try {
        win.focus();
        win.print();
      } catch {
        /* przegladarka moze zablokowac auto-print — user ma przycisk w dokumencie */
      }
    }, 600);
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
