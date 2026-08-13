import JsBarcode from 'jsbarcode';
import type { LabelQueueItem } from './labelQueue';
import { showToast } from './toast';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Generuje SVG kodu: EAN-13 gdy 13 cyfr, inaczej CODE128. */
function barcodeSvgMarkup(raw: string): string {
  const value = String(raw || '').trim();
  if (!value) return '<p style="font-family:monospace">BRAK KODU</p>';

  const digits = value.replace(/\D/g, '');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');

  const opts = {
    width: 2,
    height: 48,
    displayValue: true,
    fontSize: 13,
    margin: 4,
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
      return `<p style="font-family:monospace;font-size:14px">${escapeHtml(value)}</p>`;
    }
  }

  return svg.outerHTML;
}

function buildPrintDocument(items: LabelQueueItem[]): string {
  const labels = items
    .map((item) => {
      const code = (item.ean || item.sku || '').trim();
      const barcode = barcodeSvgMarkup(code);
      const locLine = item.locationCode?.trim()
        ? `<div class="loc">${escapeHtml(item.locationCode)}</div>`
        : '';
      return `
      <div class="label">
        <div class="brand">KENOCHEM</div>
        ${locLine}
        <div class="name">${escapeHtml(item.displayName)}</div>
        <div class="sku">SKU: ${escapeHtml(item.sku)}</div>
        <div class="barcode">${barcode}</div>
      </div>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="utf-8" />
  <title>Etykiety — Kenochem</title>
  <style>
    @page { margin: 8mm; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: #fff;
      color: #000;
      font-family: Arial, Helvetica, sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .sheet {
      display: flex;
      flex-wrap: wrap;
      gap: 5mm;
      padding: 2mm;
    }
    .label {
      width: 70mm;
      min-height: 38mm;
      border: 1px solid #111;
      padding: 2.5mm;
      page-break-inside: avoid;
      break-inside: avoid;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
    }
    .brand {
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.14em;
      color: #33b33b;
      margin-bottom: 1mm;
    }
    .name {
      font-size: 11px;
      font-weight: 600;
      line-height: 1.25;
      max-height: 2.5em;
      overflow: hidden;
      margin-bottom: 1mm;
    }
    .loc {
      font-size: 13px;
      font-weight: 800;
      font-family: Consolas, "Courier New", monospace;
      letter-spacing: 0.06em;
      margin-bottom: 1mm;
    }
    .sku {
      font-size: 10px;
      font-family: Consolas, "Courier New", monospace;
      margin-bottom: 1.5mm;
    }
    .barcode { width: 100%; }
    .barcode svg { max-width: 100%; height: auto; display: block; margin: 0 auto; }
  </style>
</head>
<body>
  <div class="sheet">${labels}</div>
</body>
</html>`;
}

/**
 * Druk etykiet przez ukryty iframe (bez popupów — niezawodne w Chrome/Edge/Firefox).
 */
export function printShelfLabels(items: LabelQueueItem[]): void {
  if (!items.length) {
    showToast('Brak etykiet do druku', 'warn');
    return;
  }

  const html = buildPrintDocument(items);

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
      showToast(
        items.length === 1 ? 'Otwarto podgląd druku' : `Druk: ${items.length} etykiet`,
        'info',
        2200,
      );
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
