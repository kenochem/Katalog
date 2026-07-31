import type { CatalogType, Kit } from '../types';

export interface OrderDraftItem {
  productId: string;
  sku: string;
  displayName: string;
  catalog: CatalogType;
  quantity: number;
  imageUrl?: string;
  /** Pozycja pochodzi z zestawu (informacyjnie). */
  fromKit?: string;
  /** Snapshot ceny w momencie oferty/zamówienia (jak OfferItem w CRM-Base). */
  unitPriceNet?: number | null;
  unitPriceGross?: number | null;
}

export type OrderKind = 'order' | 'quote';

export interface OrderDraft {
  clientName: string;
  note: string;
  items: OrderDraftItem[];
  updatedAt: number;
  /** Powiązanie z crm_clients (opcjonalnie). */
  clientId?: string;
  /** Zamówienie handlowe vs prośba o ofertę. */
  kind?: OrderKind;
}

const KEY = 'katalog-order-draft';

function emptyDraft(): OrderDraft {
  return { clientName: '', note: '', items: [], updatedAt: Date.now(), kind: 'order' };
}

export function getOrderDraft(): OrderDraft {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyDraft();
    const parsed = JSON.parse(raw) as OrderDraft;
    if (!parsed || !Array.isArray(parsed.items)) return emptyDraft();
    return {
      clientName: String(parsed.clientName || ''),
      note: String(parsed.note || ''),
      clientId: parsed.clientId || undefined,
      kind: parsed.kind === 'quote' ? 'quote' : 'order',
      items: parsed.items
        .filter((i) => i && typeof i.productId === 'string' && typeof i.sku === 'string')
        .map((i) => ({
          productId: i.productId,
          sku: i.sku,
          displayName: i.displayName,
          catalog: i.catalog || 'accessories',
          quantity: Math.max(1, Number(i.quantity) || 1),
          imageUrl: i.imageUrl || undefined,
          fromKit: i.fromKit || undefined,
        })),
      updatedAt: parsed.updatedAt || Date.now(),
    };
  } catch {
    return emptyDraft();
  }
}

export function saveOrderDraft(draft: OrderDraft): void {
  const next = { ...draft, updatedAt: Date.now() };
  localStorage.setItem(KEY, JSON.stringify(next));
}

export function clearOrderDraft(): void {
  localStorage.removeItem(KEY);
}

export function addToOrderDraft(
  product: {
    id: string;
    sku: string;
    displayName: string;
    catalog?: CatalogType;
    imageUrl?: string;
    customImageUrl?: string;
  },
  qty = 1,
): OrderDraft {
  const draft = getOrderDraft();
  const imageUrl = product.customImageUrl || product.imageUrl || undefined;
  const existing = draft.items.find((i) => i.productId === product.id);
  if (existing) {
    existing.quantity += qty;
    if (imageUrl && !existing.imageUrl) existing.imageUrl = imageUrl;
  } else {
    draft.items.push({
      productId: product.id,
      sku: product.sku,
      displayName: product.displayName,
      catalog: product.catalog || 'accessories',
      quantity: qty,
      imageUrl,
    });
  }
  saveOrderDraft(draft);
  return getOrderDraft();
}

/** Dodaje wszystkie pozycje zestawu (ilość × qty zestawu). */
export function addKitToOrderDraft(
  kit: Kit,
  kitQty = 1,
  resolveImage?: (productId: string, sku: string) => string | undefined,
): OrderDraft {
  const draft = getOrderDraft();
  for (const item of kit.items) {
    const qty = Math.max(1, item.quantity) * kitQty;
    const imageUrl = resolveImage?.(item.productId, item.sku);
    const existing = draft.items.find((i) => i.productId === item.productId);
    if (existing) {
      existing.quantity += qty;
      if (!existing.fromKit) existing.fromKit = kit.name;
      if (imageUrl && !existing.imageUrl) existing.imageUrl = imageUrl;
    } else {
      draft.items.push({
        productId: item.productId,
        sku: item.sku,
        displayName: item.name,
        catalog: 'accessories',
        quantity: qty,
        imageUrl,
        fromKit: kit.name,
      });
    }
  }
  saveOrderDraft(draft);
  return getOrderDraft();
}

export function setDraftItemQty(productId: string, quantity: number): OrderDraft {
  const draft = getOrderDraft();
  const q = Math.round(quantity);
  draft.items = draft.items
    .map((i) => (i.productId === productId ? { ...i, quantity: q } : { ...i }))
    .filter((i) => i.quantity > 0);
  saveOrderDraft(draft);
  return getOrderDraft();
}

export function removeDraftItem(productId: string): OrderDraft {
  const draft = getOrderDraft();
  draft.items = draft.items.filter((i) => i.productId !== productId);
  saveOrderDraft(draft);
  return getOrderDraft();
}

export function formatOrderDraftSkuList(draft: OrderDraft): string {
  return draft.items
    .map((i) => `${i.sku};${i.quantity}`)
    .join('\n');
}

export function formatOrderDraftMessage(
  draft: OrderDraft,
  authorLabel: string,
  opts?: { includeItemList?: boolean },
): string {
  const isQuote = draft.kind === 'quote';
  const includeItems = opts?.includeItemList !== false;
  const lines = [
    isQuote
      ? '**Prośba o ofertę — Katalog Kenochem**'
      : '**Zamówienie — Katalog Kenochem**',
    `Handlowiec: ${authorLabel}`,
    `Typ: ${isQuote ? 'prośba o wycenę / ofertę' : 'zamówienie'}`,
    draft.clientName.trim() ? `Klient: ${draft.clientName.trim()}` : 'Klient: (bez nazwy)',
  ];
  if (draft.note.trim()) {
    lines.push(`Notatka: ${draft.note.trim()}`);
  }
  if (includeItems) {
    lines.push(
      '',
      ...draft.items.map((i) => {
        const kit = i.fromKit ? ` _(zestaw: ${i.fromKit})_` : '';
        return `• ${i.quantity}× \`${i.sku}\` — ${i.displayName}${kit}`;
      }),
    );
  } else {
    const extra = draft.items.length - 10;
    if (extra > 0) {
      lines.push('', `_…i jeszcze ${extra} pozycji (max 10 miniatur)_`);
    }
  }
  return lines.join('\n');
}

export async function sendOrderDraftToDiscord(
  draft: OrderDraft,
  authorLabel: string,
): Promise<{ ok: boolean; error?: string }> {
  const url = import.meta.env.VITE_DISCORD_ORDERS_WEBHOOK as string | undefined;
  if (!url) {
    return { ok: false, error: 'Brak webhooka Discord' };
  }
  // Bez listy pozycji w tekście — są w embedach ze zdjęciami
  const content = formatOrderDraftMessage(draft, authorLabel, {
    includeItemList: false,
  });
  const isQuote = draft.kind === 'quote';
  const color = isQuote ? 0xf59e0b : 0x16a34a;

  const embeds = draft.items.slice(0, 10).map((i) => {
    const embed: Record<string, unknown> = {
      title: `${i.quantity}× ${i.displayName}`.slice(0, 256),
      color,
      fields: [
        { name: 'SKU', value: `\`${i.sku}\``, inline: true },
        { name: 'Ilość', value: String(i.quantity), inline: true },
      ],
    };
    if (i.fromKit) {
      embed.description = `zestaw: ${i.fromKit}`.slice(0, 400);
    }
    if (i.imageUrl && /^https?:\/\//i.test(i.imageUrl)) {
      embed.thumbnail = { url: i.imageUrl };
    }
    return embed;
  });

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: content.slice(0, 1900),
        embeds: embeds.length ? embeds : undefined,
      }),
    });
    if (!res.ok) return { ok: false, error: `Discord HTTP ${res.status}` };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Błąd sieci' };
  }
}

/** PDF / druk zamówienia z miniaturkami (okno drukowania przeglądarki). */
export function printOrderDraftPdf(draft: OrderDraft, authorLabel: string): void {
  if (!draft.items.length) return;

  const rows = draft.items
    .map((i) => {
      const img = i.imageUrl
        ? `<img src="${escapeHtml(i.imageUrl)}" alt="" width="48" height="48" style="object-fit:contain;border:1px solid #ddd;border-radius:6px;background:#f8f8f8" />`
        : `<div style="width:48px;height:48px;background:#eee;border-radius:6px"></div>`;
      return `<tr>
        <td style="padding:6px;border-bottom:1px solid #e5e5e5">${img}</td>
        <td style="padding:6px;border-bottom:1px solid #e5e5e5;font-family:monospace;font-size:12px">${escapeHtml(i.sku)}</td>
        <td style="padding:6px;border-bottom:1px solid #e5e5e5;font-size:13px">${escapeHtml(i.displayName)}${i.fromKit ? ` <span style="color:#888;font-size:11px">(${escapeHtml(i.fromKit)})</span>` : ''}</td>
        <td style="padding:6px;border-bottom:1px solid #e5e5e5;text-align:center;font-weight:600">${i.quantity}</td>
      </tr>`;
    })
    .join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Zamówienie</title>
<style>
  body{font-family:Segoe UI,system-ui,sans-serif;padding:24px;color:#111}
  h1{font-size:18px;margin:0 0 8px}
  .meta{font-size:13px;color:#444;margin-bottom:16px;line-height:1.5}
  table{width:100%;border-collapse:collapse}
  th{text-align:left;font-size:11px;text-transform:uppercase;color:#666;padding:6px;border-bottom:2px solid #333}
  @media print{body{padding:0}}
</style></head><body>
  <h1>${escapeHtml(draft.kind === 'quote' ? 'Prośba o ofertę' : 'Zamówienie')} — Kenochem</h1>
  <div class="meta">
    <div><strong>Handlowiec:</strong> ${escapeHtml(authorLabel)}</div>
    <div><strong>Typ:</strong> ${draft.kind === 'quote' ? 'prośba o wycenę / ofertę' : 'zamówienie'}</div>
    <div><strong>Klient:</strong> ${escapeHtml(draft.clientName.trim() || '(bez nazwy)')}</div>
    ${draft.note.trim() ? `<div><strong>Notatka:</strong> ${escapeHtml(draft.note.trim())}</div>` : ''}
    <div><strong>Data:</strong> ${new Date().toLocaleString('pl-PL')}</div>
  </div>
  <table>
    <thead><tr><th></th><th>SKU</th><th>Nazwa</th><th style="text-align:center">Ilość</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body></html>`;

  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) {
    iframe.remove();
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();
  const win = iframe.contentWindow;
  if (!win) {
    iframe.remove();
    return;
  }
  setTimeout(() => {
    try {
      win.focus();
      win.print();
    } finally {
      setTimeout(() => iframe.remove(), 60_000);
    }
  }, 200);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
