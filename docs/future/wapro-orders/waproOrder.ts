import { supabase } from './supabase';
import type { OrderDraft, OrderDraftItem } from './orderDraft';

export type WaproOrderRequest = {
  id: string;
  status: 'pending' | 'running' | 'done' | 'error';
  requested_at: string;
  finished_at?: string | null;
  message?: string | null;
  wapro_order_id?: number | null;
  wapro_order_number?: string | null;
};

export type WaproOrderPayloadItem = {
  sku: string;
  qty: number;
  displayName?: string;
  priceSaleNet?: number | null;
  priceSaleGross?: number | null;
  discountPercent?: number | null;
};

export type WaproOrderPayload = {
  clientName: string;
  clientNip?: string;
  note?: string;
  kind?: 'order' | 'quote';
  items: WaproOrderPayloadItem[];
};

function numOrNull(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Buduje payload pod Mag: jedna linia = jedno SKU (indeks katalogowy). */
export function buildWaproOrderPayload(
  draft: OrderDraft,
  resolveLine?: (item: OrderDraftItem) => {
    sku: string;
    priceSaleNet?: number | null;
    priceSaleGross?: number | null;
  },
): { ok: true; payload: WaproOrderPayload } | { ok: false; error: string } {
  if (!draft.items.length) {
    return { ok: false, error: 'Dodaj produkty do zamówienia' };
  }

  const items: WaproOrderPayloadItem[] = [];
  for (const item of draft.items) {
    const resolved = resolveLine?.(item);
    const sku = String(resolved?.sku || item.sku || '')
      .trim()
      .toUpperCase();
    if (!sku) {
      return { ok: false, error: 'Pozycja bez SKU' };
    }
    if (sku.startsWith('GROUP-') || sku.includes(',')) {
      return {
        ok: false,
        error: `Grupa / wiele SKU (${sku}) — wybierz konkretny wariant przed wysyłką do Mag`,
      };
    }
    const qty = Math.max(1, Number(item.quantity) || 1);
    items.push({
      sku,
      qty,
      displayName: item.displayName,
      priceSaleNet: numOrNull(resolved?.priceSaleNet),
      priceSaleGross: numOrNull(resolved?.priceSaleGross),
      discountPercent: numOrNull(
        (item as OrderDraftItem & { discountPercent?: number }).discountPercent,
      ),
    });
  }

  return {
    ok: true,
    payload: {
      clientName: draft.clientName.trim() || 'Klient katalog',
      note: draft.note.trim() || undefined,
      kind: draft.kind === 'quote' ? 'quote' : 'order',
      items,
    },
  };
}

export async function requestWaproOrder(
  payload: WaproOrderPayload,
): Promise<{ ok: boolean; error?: string; id?: string }> {
  if (!supabase) {
    return { ok: false, error: 'Brak konfiguracji Supabase' };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: 'Zaloguj się, żeby wysłać zamówienie do WAPRO' };
  }

  if (!payload.items?.length) {
    return { ok: false, error: 'Brak pozycji' };
  }

  const { data, error } = await supabase
    .from('wapro_order_requests')
    .insert({
      status: 'pending',
      requested_by: user.id,
      payload,
    })
    .select('id')
    .single();

  if (error) {
    return {
      ok: false,
      error: error.message.includes('wapro_order_requests')
        ? 'Brak tabeli wapro_order_requests — uruchom migration-wapro-order-requests.sql w Supabase.'
        : error.message,
    };
  }

  return { ok: true, id: data.id };
}

export async function getWaproOrderRequest(
  id: string,
): Promise<WaproOrderRequest | null> {
  if (!supabase) return null;
  const { data } = await supabase
    .from('wapro_order_requests')
    .select(
      'id, status, requested_at, finished_at, message, wapro_order_id, wapro_order_number',
    )
    .eq('id', id)
    .maybeSingle();
  return (data as WaproOrderRequest) || null;
}
