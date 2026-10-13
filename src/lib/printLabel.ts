import JsBarcode from 'jsbarcode';
import type { LabelQueueItem } from './labelQueue';
import { loadLabelConfig, type LabelConfig } from './labelConfig';
import { formatPricePln, formatStock } from './format';
import { formatPack, parsePackFromText, unitPrice } from './labelPack';
import { showToast } from './toast';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Generuje SVG kodu: EAN-13 gdy 13 cyfr, inaczej CODE128. */
function barcodeSvgMarkup(raw: string, height: number, fontSize: number): string {
  const value = String(raw || '').trim();
  if (!value) return '<p class="nocode">BRAK KODU</p>';

  const digits = value.replace(/\D/g, '');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');

  const opts = {
    width: 2,
    height,
    displayValue: true,
    fontSize,
    margin: 2,
    background: '#ffffff',
    lineColor: '#000000',
  } as const;

  try {
    if (digits.length === 13 && digits === value.replace(/\s/g, '')) {
      JsBarcode(svg, digits, { ...opts, format: 'EAN13' });
    } else if (digits.length === 8 && digits === value.replace(/\s/g, '')) {
      JsBarcode(svg, digits, { ...opts, format: 'EAN8' });
    } else {
      JsBarcode(svg, value, { ...opts, format: 'CODE128' });
    }
  } catch {
    try {
      JsBarcode(svg, value, { ...opts, format: 'CODE128' });
    } catch {
      return `<p class="nocode">${escapeHtml(value)}</p>`;
    }
  }

  return svg.outerHTML;
}

/** Jedna etykieta: jasny prostokąt z zielonym akcentem, najważniejsze dane produktu. */
function labelMarkup(item: LabelQueueItem, cfg: LabelConfig): string {
  const f = cfg.fields;
  const code = (item.ean || item.sku || '').trim();
  const small = cfg.h < 38;
  const barcodeH = Math.max(14, Math.round(cfg.h * (small ? 0.3 : 0.34)));
  const barcode = f.barcode ? barcodeSvgMarkup(code, barcodeH, small ? 10 : 12) : '';

  const topLeft = f.brand ? '<span class="brand">KENOCHEM</span>' : '<span></span>';
  const loc =
    f.location && item.locationCode?.trim()
      ? `<span class="loc">${escapeHtml(item.locationCode)}</span>`
      : '';
  const top = f.brand || loc ? `<div class="top">${topLeft}${loc}</div>` : '';

  const shownName = (item.labelName || '').trim() || item.displayName;
  const name = f.name ? `<div class="name">${escapeHtml(shownName)}</div>` : '';

  const chips: string[] = [];
  if (f.sku && item.sku) chips.push(`<span class="chip mono">SKU ${escapeHtml(item.sku)}</span>`);
  if (f.manufacturer && item.manufacturer)
    chips.push(`<span class="chip">${escapeHtml(item.manufacturer)}</span>`);
  if (f.category && item.category) chips.push(`<span class="chip">${escapeHtml(item.category)}</span>`);
  if (f.stock && item.stock != null) chips.push(`<span class="chip">stan ${escapeHtml(formatStock(item.stock))}</span>`);
  const meta = chips.length ? `<div class="meta">${chips.join('')}</div>` : '';

  // ceny: zwykła, netto pod brutto, wariant wyprzedażowy (stara przekreślona, nowa na czerwono)
  const sale =
    item.salePrice != null &&
    item.priceGross != null &&
    Number.isFinite(item.salePrice) &&
    item.salePrice > 0 &&
    item.salePrice < item.priceGross;
  const shelfGross = sale ? (item.salePrice as number) : item.priceGross;
  const vat = item.vatRate ?? 23;
  let price = '';
  if (f.price && shelfGross != null && Number.isFinite(shelfGross)) {
    const net = sale || item.priceNet == null ? shelfGross / (1 + vat / 100) : item.priceNet;
    const old = sale ? `<span class="old">${escapeHtml(formatPricePln(item.priceGross as number))}</span>` : '';
    const promo = sale ? '<span class="promo">PROMOCJA</span>' : '';
    const netLine = f.priceNet
      ? `<small class="net">netto ${escapeHtml(formatPricePln(Math.round(net * 100) / 100))}</small>`
      : '';
    price = `<div class="price${sale ? ' sale' : ''}">${promo}${old}<span class="now">${escapeHtml(
      formatPricePln(shelfGross),
    )}</span><small>brutto</small>${netLine}</div>`;
  }

  // cena jednostkowa (obowiązek: za 1 l / 1 kg / 1 szt.) liczona od ceny z półki
  let unit = '';
  if (f.unitPrice) {
    const pack = item.pack ?? parsePackFromText(item.displayName);
    const up = unitPrice(shelfGross, pack);
    if (up) {
      unit = `<div class="unit${sale ? ' sale' : ''}">${escapeHtml(formatPack(pack))} &middot; cena za ${escapeHtml(
        up.label,
      )}: <b>${escapeHtml(formatPricePln(up.value))}</b></div>`;
    }
  }

  const bcBlock = barcode ? `<div class="bc">${barcode}</div>` : '';
  return `<div class="label">
    ${top}
    <div class="body"><div class="info">${name}${meta}</div>${price}</div>
    ${unit}
    ${bcBlock}
  </div>`;
}

function labelCss(cfg: LabelConfig, preview: boolean): string {
  const base = (cfg.h >= 60 ? 12.5 : cfg.h >= 45 ? 11.5 : cfg.h >= 35 ? 10.5 : 9) * cfg.fontScale;
  const pageRule =
    cfg.mode === 'roll'
      ? `@page { size: ${cfg.w}mm ${cfg.h}mm; margin: 0; }`
      : '@page { size: A4; margin: 8mm; }';
  const sheetRule =
    cfg.mode === 'roll'
      ? '.sheet { display: block; }'
      : `.sheet { display: flex; flex-wrap: wrap; gap: 3mm; ${preview ? 'padding: 4mm;' : ''} }`;
  const labelPage =
    cfg.mode === 'roll'
      ? '.label { page-break-after: always; break-after: page; border-radius: 0; border: none !important; }'
      : '';
  return `
    ${pageRule}
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: ${preview ? '#eef2ee' : '#fff'}; color: #0f172a;
      font-family: Arial, Helvetica, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    ${sheetRule}
    .label {
      position: relative; width: ${cfg.w}mm; height: ${cfg.h}mm; background: #fff; overflow: hidden;
      padding: 2.2mm 3mm 2mm 4.2mm; display: flex; flex-direction: column; gap: 1mm;
      ${cfg.border ? 'border: 0.25mm solid #b9c6bb;' : ''} border-radius: 2mm;
      page-break-inside: avoid; break-inside: avoid;
    }
    .label::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 1.8mm; background: #33b33b; }
    .top { display: flex; justify-content: space-between; align-items: center; gap: 2mm; }
    .brand { font-size: ${(base * 0.78).toFixed(1)}px; font-weight: 800; letter-spacing: 0.16em; color: #237a29; }
    .loc { font-family: Consolas, "Courier New", monospace; font-weight: 800; font-size: ${(base * 1.05).toFixed(1)}px;
      background: #e8f5e9; color: #14532d; border-radius: 1mm; padding: 0.3mm 1.6mm; letter-spacing: 0.04em; }
    .body { display: flex; gap: 2mm; align-items: flex-start; justify-content: space-between; flex: 1 1 auto; min-height: 0; }
    .info { min-width: 0; flex: 1 1 auto; }
    .name { font-weight: 700; font-size: ${(base * 1.22).toFixed(1)}px; line-height: 1.18;
      display: -webkit-box; -webkit-line-clamp: ${cfg.h >= 45 ? 3 : 2}; -webkit-box-orient: vertical; overflow: hidden; }
    .meta { display: flex; flex-wrap: wrap; gap: 0.8mm 1.2mm; margin-top: 1mm; }
    .chip { font-size: ${(base * 0.82).toFixed(1)}px; color: #334155; background: #f1f5f2; border-radius: 0.8mm; padding: 0.2mm 1.2mm; }
    .chip.mono { font-family: Consolas, "Courier New", monospace; font-weight: 700; color: #0f172a; }
    .price { display: flex; flex-direction: column; align-items: flex-end; text-align: right; line-height: 1.05; white-space: nowrap; }
    .price .now { font-weight: 800; font-size: ${(base * 1.9).toFixed(1)}px; color: #14532d; }
    .price small { font-size: ${(base * 0.7).toFixed(1)}px; font-weight: 600; color: #64748b; margin-top: 0.4mm; }
    .price small.net { margin-top: 0; color: #475569; font-weight: 700; }
    .price .old { font-size: ${(base * 1.05).toFixed(1)}px; color: #64748b; text-decoration: line-through; text-decoration-thickness: 0.35mm; font-weight: 600; }
    .price .promo { font-size: ${(base * 0.68).toFixed(1)}px; font-weight: 800; letter-spacing: 0.08em; color: #fff; background: #dc2626; border-radius: 0.8mm; padding: 0.2mm 1.4mm; margin-bottom: 0.6mm; }
    .price.sale .now { color: #dc2626; }
    .unit { font-size: ${(base * 0.88).toFixed(1)}px; color: #334155; background: #f1f5f2; border-radius: 0.8mm; padding: 0.4mm 1.4mm; }
    .unit b { color: #0f172a; }
    .unit.sale b { color: #dc2626; }
    .bc { text-align: center; margin-top: auto; }
    .bc svg { max-width: 100%; height: auto; max-height: ${Math.round(cfg.h * 0.4)}mm; display: block; margin: 0 auto; }
    .nocode { font-family: monospace; font-size: ${base}px; margin: 0; text-align: center; }
    ${labelPage}
  `;
}

/** Pełny dokument HTML z etykietami (do druku i do podglądu w iframe). */
export function buildLabelsDocument(
  items: LabelQueueItem[],
  cfg: LabelConfig,
  opts: { preview?: boolean } = {},
): string {
  const preview = opts.preview === true;
  const expanded: LabelQueueItem[] = [];
  for (const it of items) {
    const n = preview ? 1 : Math.max(1, Math.min(999, Math.round(it.qty ?? 1)));
    for (let i = 0; i < n; i++) expanded.push(it);
  }
  const labels = expanded.map((it) => labelMarkup(it, cfg)).join('');
  return `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="utf-8" />
  <title>Etykiety — Kenochem</title>
  <style>${labelCss(cfg, preview)}</style>
</head>
<body>
  <div class="sheet">${labels}</div>
</body>
</html>`;
}

/**
 * Druk etykiet przez ukryty iframe (bez popupów — niezawodne w Chrome/Edge/Firefox).
 * Konfiguracja (rozmiar, pola, tryb) pochodzi z zapisanych ustawień, chyba że podano `cfg`.
 */
export function printShelfLabels(items: LabelQueueItem[], cfg: LabelConfig = loadLabelConfig()): void {
  if (!items.length) {
    showToast('Brak etykiet do druku', 'warn');
    return;
  }

  const total = items.reduce((s, it) => s + Math.max(1, Math.round(it.qty ?? 1)), 0);
  const html = buildLabelsDocument(items, cfg);

  // usuń poprzedni iframe jeśli został
  const old = document.getElementById('kenochem-print-frame');
  if (old) old.remove();

  const iframe = document.createElement('iframe');
  iframe.id = 'kenochem-print-frame';
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText =
    'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none;';

  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) {
    iframe.remove();
    showToast('Nie udało się przygotować podglądu druku', 'error');
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();

  const win = iframe.contentWindow;
  if (!win) {
    iframe.remove();
    showToast('Nie udało się otworzyć okna druku', 'error');
    return;
  }

  // poczekaj aż SVG/barcode się narysuje
  const triggerPrint = () => {
    try {
      win.focus();
      win.print();
      showToast(total === 1 ? 'Otwarto podgląd druku' : `Druk: ${total} etykiet`, 'info', 2200);
    } catch (err) {
      console.error(err);
      showToast('Druk nieudany — spróbuj Ctrl+P w podglądzie', 'error');
    } finally {
      // nie usuwaj od razu — niektóre przeglądarki potrzebują iframe do czasu dialogu
      setTimeout(() => {
        iframe.remove();
      }, 60_000);
    }
  };

  // Firefox czasem potrzebuje onload
  iframe.onload = () => setTimeout(triggerPrint, 100);
  setTimeout(triggerPrint, 250);
}
