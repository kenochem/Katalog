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

const MM_PX = 3.7795; // px na mm (96 dpi)

/** Odstępy wewnętrzne etykiety w mm (lewy większy — zielony pasek akcentu). */
function labelPadding(cfg: LabelConfig) {
  return cfg.h <= 32
    ? { top: 1.3, right: 2, bottom: 1.2, left: 3.4 }
    : { top: 2.2, right: 3, bottom: 2, left: 4.2 };
}

/** Bazowy rozmiar czcionki (px) zależny od wysokości etykiety i ustawienia „Czcionka”. */
function labelBase(cfg: LabelConfig): number {
  const h = cfg.h;
  const base = h <= 26 ? 7.2 : h <= 32 ? 8.5 : h <= 40 ? 10 : h <= 50 ? 11.2 : 12.5;
  return base * cfg.fontScale;
}

let measureCtx: CanvasRenderingContext2D | null | undefined;
function textWidthAt100(text: string): number {
  if (measureCtx === undefined) {
    measureCtx = document.createElement('canvas').getContext('2d');
  }
  if (!measureCtx) return text.length * 58; // zapas, gdy brak canvas
  measureCtx.font = '800 100px Arial, Helvetica, sans-serif';
  return measureCtx.measureText(text).width;
}

/**
 * Nazwa zawsze w JEDNEJ linii: dobieramy czcionkę tak, żeby cała nazwa zmieściła się w szerokości etykiety
 * (od maksymalnej do minimalnej czytelnej). Gdy nie mieści się nawet na minimum — `overflow` (nazwa zostanie ucięta).
 */
export function fitLabelName(
  text: string,
  cfg: LabelConfig,
): { px: number; overflow: boolean; tiny: boolean } {
  const pad = labelPadding(cfg);
  const availPx = (cfg.w - pad.left - pad.right) * MM_PX;
  const base = labelBase(cfg);
  const maxPx = base * 1.6;
  const minPx = Math.max(6.2, base * 0.82);
  const w100 = textWidthAt100(text.trim() || ' ');
  const fit = (availPx / w100) * 100 * 0.985;
  // „tiny” — mieści się, ale czcionka jest już bardzo drobna (warto skrócić nazwę)
  const tinyBelow = Math.max(7.2, base * 0.98);
  if (fit >= maxPx) return { px: maxPx, overflow: false, tiny: false };
  if (fit >= minPx) return { px: fit, overflow: false, tiny: fit < tinyBelow };
  return { px: minPx, overflow: true, tiny: true };
}

/**
 * Jedna etykieta: nazwa od samej góry (jedna linia), pod nią kod kreskowy po lewej i cena po prawej,
 * na dole SKU / lokalizacja / pojemność. Jasny prostokąt z zielonym akcentem.
 */
function labelMarkup(item: LabelQueueItem, cfg: LabelConfig): string {
  const f = cfg.fields;
  const code = (item.ean || item.sku || '').trim();
  const base = labelBase(cfg);

  // --- nazwa (jedna linia, auto-dopasowanie)
  const shownName = (item.labelName || '').trim() || item.displayName;
  const nameFit = fitLabelName(shownName, cfg);
  const name = f.name
    ? `<div class="nm" style="font-size:${nameFit.px.toFixed(2)}px">${escapeHtml(shownName)}</div>`
    : '';

  // --- ceny: zwykła, netto pod brutto, wariant wyprzedażowy
  const sale =
    item.salePrice != null &&
    item.priceGross != null &&
    Number.isFinite(item.salePrice) &&
    item.salePrice > 0 &&
    item.salePrice < item.priceGross;
  const shelfGross = sale ? (item.salePrice as number) : item.priceGross;
  const vat = item.vatRate ?? 23;
  const lines: string[] = [];
  if (f.price && shelfGross != null && Number.isFinite(shelfGross)) {
    const net = sale || item.priceNet == null ? shelfGross / (1 + vat / 100) : item.priceNet;
    if (sale) {
      lines.push(
        `<div class="saleRow"><span class="promo">PROMOCJA</span><span class="old">${escapeHtml(
          formatPricePln(item.priceGross as number),
        )}</span></div>`,
      );
    }
    lines.push(`<div class="now${sale ? ' sale' : ''}">${escapeHtml(formatPricePln(shelfGross))}</div>`);
    lines.push(
      f.priceNet
        ? `<div class="sub">netto ${escapeHtml(formatPricePln(Math.round(net * 100) / 100))}</div>`
        : '<div class="sub">brutto</div>',
    );
  }

  // --- cena jednostkowa (obowiązek: za 1 l / 1 kg / 1 szt.) liczona od ceny z półki
  const pack = item.pack ?? parsePackFromText(item.displayName);
  if (f.unitPrice) {
    const up = unitPrice(shelfGross, pack);
    if (up) {
      lines.push(
        `<div class="unit${sale ? ' sale' : ''}"><b>${escapeHtml(formatPricePln(up.value))}</b> / ${escapeHtml(up.label).replace(' ', '&nbsp;')}</div>`,
      );
    }
  }
  const right = lines.length ? `<div class="right">${lines.join('')}</div>` : '';

  // --- kod kreskowy (lewa kolumna)
  const barcode = f.barcode ? barcodeSvgMarkup(code, 40, 12) : '';
  const left = barcode ? `<div class="left">${barcode}</div>` : '<div class="left"></div>';

  // --- dolny pasek: SKU, lokalizacja, pojemność, reszta
  const chips: string[] = [];
  if (f.sku && item.sku) chips.push(`<span class="chip mono">${escapeHtml(item.sku)}</span>`);
  if (f.location && item.locationCode?.trim())
    chips.push(`<span class="chip loc">${escapeHtml(item.locationCode)}</span>`);
  if (f.unitPrice && pack) chips.push(`<span class="chip">${escapeHtml(formatPack(pack))}</span>`);
  if (f.manufacturer && item.manufacturer) chips.push(`<span class="chip">${escapeHtml(item.manufacturer)}</span>`);
  if (f.category && item.category) chips.push(`<span class="chip">${escapeHtml(item.category)}</span>`);
  if (f.stock && item.stock != null)
    chips.push(`<span class="chip">stan ${escapeHtml(formatStock(item.stock))}</span>`);
  if (f.brand) chips.push('<span class="chip brand">KENOCHEM</span>');
  const bottom = chips.length ? `<div class="bottom">${chips.join('')}</div>` : '';

  void base;
  return `<div class="label">
    ${name}
    <div class="mid">${left}${right}</div>
    ${bottom}
  </div>`;
}

function labelCss(cfg: LabelConfig, preview: boolean): string {
  const base = labelBase(cfg);
  const pad = labelPadding(cfg);
  const compact = cfg.h <= 32;
  const pageRule =
    cfg.mode === 'roll'
      ? `@page { size: ${cfg.w}mm ${cfg.h}mm; margin: 0; }`
      : '@page { size: A4; margin: 8mm; }';
  const sheetRule =
    cfg.mode === 'roll'
      ? '.sheet { display: block; }'
      : `.sheet { display: flex; flex-wrap: wrap; gap: ${compact ? 2 : 3}mm; ${preview ? 'padding: 4mm;' : ''} }`;
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
      padding: ${pad.top}mm ${pad.right}mm ${pad.bottom}mm ${pad.left}mm; display: flex; flex-direction: column;
      gap: ${compact ? 0.5 : 1}mm;
      ${cfg.border ? 'border: 0.25mm solid #b9c6bb;' : ''} border-radius: ${compact ? 1.4 : 2}mm;
      page-break-inside: avoid; break-inside: avoid;
    }
    .label::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: ${compact ? 1.4 : 1.8}mm; background: #33b33b; }
    .nm { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 800; line-height: 1.12; letter-spacing: -0.01em; flex: 0 0 auto; }
    .mid { display: flex; flex: 1 1 auto; min-height: 0; gap: 1.6mm; justify-content: space-between; align-items: stretch; }
    .left { flex: 1 1 52%; min-width: 0; display: flex; align-items: center; justify-content: flex-start; }
    .left svg { max-width: 100%; max-height: 100%; height: auto; display: block; }
    .nocode { font-family: monospace; font-size: ${base.toFixed(1)}px; margin: 0; }
    .right { flex: 0 1 46%; min-width: 0; display: flex; flex-direction: column; align-items: flex-end; justify-content: center; text-align: right; line-height: 1.05; white-space: nowrap; }
    .now { font-weight: 800; font-size: ${(base * 2.55).toFixed(1)}px; color: #14532d; letter-spacing: -0.02em; }
    .now.sale { color: #dc2626; }
    .sub { font-size: ${(base * 0.95).toFixed(1)}px; color: #475569; font-weight: 700; }
    .unit { font-size: ${(base * 0.98).toFixed(1)}px; color: #334155; margin-top: 0.3mm; }
    .unit b { color: #0f172a; font-weight: 800; }
    .unit.sale b { color: #dc2626; }
    .saleRow { display: flex; align-items: center; gap: 1.2mm; margin-bottom: 0.2mm; }
    .promo { font-size: ${(base * 0.7).toFixed(1)}px; font-weight: 800; letter-spacing: 0.06em; color: #fff; background: #dc2626; border-radius: 0.7mm; padding: 0.15mm 1.1mm; }
    .old { font-size: ${(base * 1.1).toFixed(1)}px; color: #64748b; text-decoration: line-through; text-decoration-thickness: 0.3mm; font-weight: 700; }
    .bottom { display: flex; gap: 0.8mm; align-items: center; flex: 0 0 auto; overflow: hidden; white-space: nowrap; }
    .chip { font-size: ${(base * 0.92).toFixed(1)}px; color: #334155; background: #f1f5f2; border-radius: 0.7mm; padding: 0.1mm 1mm; flex: 0 1 auto; overflow: hidden; text-overflow: ellipsis; }
    .chip.mono { font-family: Consolas, "Courier New", monospace; font-weight: 700; color: #0f172a; }
    .chip.loc { font-family: Consolas, "Courier New", monospace; font-weight: 800; background: #e8f5e9; color: #14532d; }
    .chip.brand { font-weight: 800; letter-spacing: 0.14em; color: #237a29; background: transparent; }
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
