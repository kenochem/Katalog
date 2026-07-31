import { supabase } from './supabase';
import type { OrderDraft, OrderDraftItem, OrderKind } from './orderDraft';

export interface CrmClient {
  id: string;
  userId: string;
  displayName: string;
  legalName?: string;
  nip?: string;
  address?: string;
  note?: string;
  lat?: number;
  lng?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CrmOrder {
  id: string;
  userId: string;
  clientId?: string;
  clientName: string;
  note: string;
  items: OrderDraftItem[];
  status: 'sent' | 'saved';
  kind: OrderKind;
  createdAt: string;
}

export interface NipLookupResult {
  nip: string;
  legalName: string;
  address: string;
  statusVat?: string | null;
}

const SCHEMA_HINT =
  'Brak tabel CRM w bazie — w Supabase SQL Editor uruchom plik migration-crm-clients-orders.sql';

export function isCrmSchemaError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err || '');
  return /crm_clients|crm_orders|schema cache|does not exist|Could not find the table/i.test(
    msg,
  );
}

export function crmErrorMessage(err: unknown): string {
  if (isCrmSchemaError(err)) return SCHEMA_HINT;
  return err instanceof Error ? err.message : 'Błąd CRM';
}

export function normalizeNip(raw: string): string {
  return raw.replace(/\D/g, '');
}

export function isValidNip(nip: string): boolean {
  const n = normalizeNip(nip);
  if (!/^\d{10}$/.test(n)) return false;
  const weights = [6, 5, 7, 2, 3, 4, 5, 6, 7];
  const sum = weights.reduce((acc, w, i) => acc + w * Number(n[i]), 0);
  return sum % 11 === Number(n[9]);
}

function mapClient(row: Record<string, unknown>): CrmClient {
  const lat =
    row.lat != null && Number.isFinite(Number(row.lat))
      ? Number(row.lat)
      : undefined;
  const lng =
    row.lng != null && Number.isFinite(Number(row.lng))
      ? Number(row.lng)
      : undefined;
  return {
    id: String(row.id),
    userId: String(row.user_id),
    displayName: String(row.display_name || ''),
    legalName: row.legal_name ? String(row.legal_name) : undefined,
    nip: row.nip ? String(row.nip) : undefined,
    address: row.address ? String(row.address) : undefined,
    note: row.note ? String(row.note) : undefined,
    lat,
    lng,
    createdAt: String(row.created_at || ''),
    updatedAt: String(row.updated_at || ''),
  };
}

function mapOrder(row: Record<string, unknown>): CrmOrder {
  const rawItems = Array.isArray(row.items) ? row.items : [];
  return {
    id: String(row.id),
    userId: String(row.user_id),
    clientId: row.client_id ? String(row.client_id) : undefined,
    clientName: String(row.client_name || ''),
    note: String(row.note || ''),
    items: rawItems as OrderDraftItem[],
    status: row.status === 'sent' ? 'sent' : 'saved',
    kind: row.kind === 'quote' ? 'quote' : 'order',
    createdAt: String(row.created_at || ''),
  };
}

export async function fetchCrmClients(): Promise<CrmClient[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('crm_clients')
    .select('*')
    .order('display_name', { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []).map((r) => mapClient(r as Record<string, unknown>));
}

export async function upsertCrmClient(input: {
  id?: string;
  displayName: string;
  legalName?: string;
  nip?: string;
  address?: string;
  note?: string;
  lat?: number | null;
  lng?: number | null;
}): Promise<CrmClient> {
  if (!supabase) throw new Error('Brak Supabase');
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Zaloguj się, żeby zapisać klienta');

  const nip = input.nip ? normalizeNip(input.nip) : null;
  const payload: Record<string, unknown> = {
    user_id: user.id,
    display_name: input.displayName.trim(),
    legal_name: input.legalName?.trim() || null,
    nip: nip || null,
    address: input.address?.trim() || null,
    note: input.note?.trim() || null,
    updated_at: new Date().toISOString(),
  };

  if (input.lat !== undefined) {
    payload.lat =
      input.lat != null && Number.isFinite(input.lat) ? input.lat : null;
  }
  if (input.lng !== undefined) {
    payload.lng =
      input.lng != null && Number.isFinite(input.lng) ? input.lng : null;
  }

  if (!payload.display_name) throw new Error('Podaj nazwę klienta');

  if (input.id) {
    const { data, error } = await supabase
      .from('crm_clients')
      .update(payload)
      .eq('id', input.id)
      .eq('user_id', user.id)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return mapClient(data as Record<string, unknown>);
  }

  const { data, error } = await supabase
    .from('crm_clients')
    .insert(payload)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return mapClient(data as Record<string, unknown>);
}

export async function updateCrmClientGeo(
  id: string,
  lat: number | null,
  lng: number | null
): Promise<CrmClient> {
  if (!supabase) throw new Error('Brak Supabase');
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Zaloguj się');

  const { data, error } = await supabase
    .from('crm_clients')
    .update({
      lat,
      lng,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', user.id)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return mapClient(data as Record<string, unknown>);
}

export async function deleteCrmClient(id: string): Promise<void> {
  if (!supabase) throw new Error('Brak Supabase');
  const { error } = await supabase.from('crm_clients').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function fetchCrmOrders(limit = 50): Promise<CrmOrder[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('crm_orders')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data || []).map((r) => mapOrder(r as Record<string, unknown>));
}

export async function saveCrmOrder(input: {
  draft: OrderDraft;
  clientId?: string | null;
  status: 'sent' | 'saved';
}): Promise<CrmOrder> {
  if (!supabase) throw new Error('Brak Supabase');
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Zaloguj się, żeby zapisać zamówienie');

  const { data, error } = await supabase
    .from('crm_orders')
    .insert({
      user_id: user.id,
      client_id: input.clientId || null,
      client_name: input.draft.clientName.trim(),
      note: input.draft.note.trim(),
      items: input.draft.items,
      status: input.status,
      kind: input.draft.kind === 'quote' ? 'quote' : 'order',
    })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return mapOrder(data as Record<string, unknown>);
}

export async function deleteCrmOrder(id: string): Promise<void> {
  if (!supabase) throw new Error('Brak Supabase');
  const { error } = await supabase.from('crm_orders').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function lookupNip(nipRaw: string): Promise<NipLookupResult> {
  if (!supabase) throw new Error('Brak Supabase');
  const nip = normalizeNip(nipRaw);
  if (!isValidNip(nip)) throw new Error('Nieprawidłowy NIP');

  const { data, error } = await supabase.functions.invoke('nip-lookup', {
    body: { nip },
  });

  if (error) throw new Error(error.message || 'Błąd lookup NIP');
  if (data?.error) throw new Error(String(data.error));

  return {
    nip: String(data.nip || nip),
    legalName: String(data.legalName || ''),
    address: String(data.address || ''),
    statusVat: data.statusVat ?? null,
  };
}

export function orderToDraft(order: CrmOrder): OrderDraft {
  return {
    clientName: order.clientName,
    note: order.note,
    items: order.items.map((i) => ({ ...i })),
    updatedAt: Date.now(),
    clientId: order.clientId,
    kind: order.kind,
  };
}
