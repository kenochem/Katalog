import { useEffect, useSyncExternalStore } from 'react';
import { supabase } from './supabase';

/** Centrum promocji — kampanie cenowe z datami i cenami promocyjnymi produktów. */

export type PromoStatus = 'draft' | 'scheduled' | 'active' | 'ended';

export const PROMO_STATUS_LABEL: Record<PromoStatus, string> = {
  draft: 'Szkic',
  scheduled: 'Zatwierdzona (czeka na start)',
  active: 'Aktywna',
  ended: 'Zakończona',
};

/** baselinker = cena idzie do sklepu internetowego (grupa cenowa BL); internal = kampania wewnętrzna (katalog i etykiety). */
export type PromoChannel = 'baselinker' | 'internal';

export const PROMO_CHANNEL_LABEL: Record<PromoChannel, string> = {
  baselinker: 'Sklep internetowy (BaseLinker)',
  internal: 'Wewnętrzna (bez BaseLinkera)',
};

export interface PromoCampaign {
  id: string;
  name: string;
  note: string;
  status: PromoStatus;
  channel: PromoChannel;
  startsAt: string | null;
  endsAt: string | null;
  minMargin: number | null;
  createdByLabel: string;
  createdAt: string;
  appliedAt: string | null;
  endedAt: string | null;
  lastError: string;
  itemCount: number;
}

export type PromoBlState = 'pending' | 'applied' | 'restored' | 'error' | 'skipped';

export interface PromoItem {
  id?: string;
  sku: string;
  productName: string;
  vat: number;
  regularGross: number | null;
  purchaseNet: number | null;
  promoGross: number;
  blState?: PromoBlState;
  blError?: string;
}

const SCHEMA_HINT = 'Brak tabel promocji w bazie — w Supabase SQL Editor uruchom plik migration-promotions.sql';

function db() {
  if (!supabase) throw new Error('Brak Supabase');
  return supabase;
}

function fail(err: { message?: string } | null): never {
  const msg = err?.message || 'Błąd bazy';
  throw new Error(/promo_campaigns|promo_items|schema cache|does not exist/i.test(msg) ? SCHEMA_HINT : msg);
}

function mapCampaign(r: Record<string, unknown>, itemCount: number): PromoCampaign {
  return {
    id: String(r.id),
    name: String(r.name ?? ''),
    note: String(r.note ?? ''),
    status: (['draft', 'scheduled', 'active', 'ended'].includes(String(r.status)) ? r.status : 'draft') as PromoStatus,
    channel: r.channel === 'internal' ? 'internal' : 'baselinker',
    startsAt: r.starts_at ? String(r.starts_at) : null,
    endsAt: r.ends_at ? String(r.ends_at) : null,
    minMargin: r.min_margin != null ? Number(r.min_margin) : null,
    createdByLabel: String(r.created_by_label ?? ''),
    createdAt: String(r.created_at ?? ''),
    appliedAt: r.applied_at ? String(r.applied_at) : null,
    endedAt: r.ended_at ? String(r.ended_at) : null,
    lastError: String(r.last_error ?? ''),
    itemCount,
  };
}

function mapItem(r: Record<string, unknown>): PromoItem {
  const num = (v: unknown) => (v != null && Number.isFinite(Number(v)) ? Number(v) : null);
  return {
    id: String(r.id),
    sku: String(r.sku ?? ''),
    productName: String(r.product_name ?? ''),
    vat: Number(r.vat ?? 23),
    regularGross: num(r.regular_gross),
    purchaseNet: num(r.purchase_net),
    promoGross: Number(r.promo_gross ?? 0),
    blState: (r.bl_state as PromoBlState) ?? 'pending',
    blError: String(r.bl_error ?? ''),
  };
}

export async function fetchPromoCampaigns(): Promise<PromoCampaign[]> {
  const sb = db();
  const { data, error } = await sb.from('promo_campaigns').select('*').order('created_at', { ascending: false });
  if (error) fail(error);
  const counts = new Map<string, number>();
  const { data: items, error: e2 } = await sb.from('promo_items').select('campaign_id');
  if (e2) fail(e2);
  for (const it of items ?? []) {
    const id = String((it as { campaign_id: string }).campaign_id);
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return (data ?? []).map((r) => mapCampaign(r as Record<string, unknown>, counts.get(String(r.id)) ?? 0));
}

export async function fetchPromoItems(campaignId: string): Promise<PromoItem[]> {
  const { data, error } = await db()
    .from('promo_items')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('product_name', { ascending: true });
  if (error) fail(error);
  return (data ?? []).map((r) => mapItem(r as Record<string, unknown>));
}

export interface PromoCampaignInput {
  channel?: PromoChannel;
  name: string;
  note?: string;
  startsAt: string | null;
  endsAt: string | null;
  minMargin: number | null;
}

async function currentUserLabel(): Promise<{ id: string | null; label: string }> {
  const sb = db();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { id: null, label: '' };
  const { data } = await sb.from('profiles').select('display_name,email').eq('id', user.id).maybeSingle();
  return { id: user.id, label: String(data?.display_name || data?.email || user.email || '') };
}

export async function createPromoCampaign(input: PromoCampaignInput): Promise<PromoCampaign> {
  const who = await currentUserLabel();
  const base = {
    name: input.name.trim() || 'Nowa promocja',
    note: input.note ?? '',
    starts_at: input.startsAt,
    ends_at: input.endsAt,
    min_margin: input.minMargin,
    created_by: who.id,
    created_by_label: who.label,
  };
  const channel = input.channel ?? 'baselinker';
  let res = await db()
    .from('promo_campaigns')
    .insert({ ...base, channel })
    .select('*')
    .single();
  if (res.error && /channel/i.test(res.error.message)) {
    // kolumna channel nie istnieje (migration-promotions-channel.sql niewykonana)
    if (channel === 'internal') {
      throw new Error('Kampanie wewnętrzne wymagają migracji: uruchom w Supabase plik migration-promotions-channel.sql');
    }
    res = await db().from('promo_campaigns').insert(base).select('*').single();
  }
  if (res.error) fail(res.error);
  return mapCampaign(res.data as Record<string, unknown>, 0);
}

export async function updatePromoCampaign(
  id: string,
  patch: Partial<PromoCampaignInput> & { status?: PromoStatus },
): Promise<void> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.name !== undefined) row.name = patch.name.trim() || 'Promocja';
  if (patch.note !== undefined) row.note = patch.note;
  if (patch.startsAt !== undefined) row.starts_at = patch.startsAt;
  if (patch.endsAt !== undefined) row.ends_at = patch.endsAt;
  if (patch.minMargin !== undefined) row.min_margin = patch.minMargin;
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.channel !== undefined) row.channel = patch.channel;
  let { error } = await db().from('promo_campaigns').update(row).eq('id', id);
  if (error && /channel/i.test(error.message)) {
    if (patch.channel === 'internal') {
      throw new Error('Kampanie wewnętrzne wymagają migracji: uruchom w Supabase plik migration-promotions-channel.sql');
    }
    delete row.channel;
    ({ error } = await db().from('promo_campaigns').update(row).eq('id', id));
  }
  if (error) fail(error);
}

/** Zapisuje pełną listę pozycji kampanii (usuwa te, których już nie ma, dopisuje/aktualizuje resztę). */
export async function savePromoItems(campaignId: string, items: PromoItem[]): Promise<void> {
  const sb = db();
  const skus = items.map((i) => i.sku.toUpperCase());
  const { data: existing, error: e1 } = await sb.from('promo_items').select('id,sku').eq('campaign_id', campaignId);
  if (e1) fail(e1);
  const drop = (existing ?? []).filter((r) => !skus.includes(String(r.sku).toUpperCase())).map((r) => r.id);
  for (let i = 0; i < drop.length; i += 200) {
    const { error } = await sb.from('promo_items').delete().in('id', drop.slice(i, i + 200));
    if (error) fail(error);
  }
  const rows = items.map((it) => ({
    campaign_id: campaignId,
    sku: it.sku.toUpperCase(),
    product_name: it.productName,
    vat: it.vat,
    regular_gross: it.regularGross,
    purchase_net: it.purchaseNet,
    promo_gross: it.promoGross,
  }));
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await sb.from('promo_items').upsert(rows.slice(i, i + 200), { onConflict: 'campaign_id,sku' });
    if (error) fail(error);
  }
}

/** Kampania wewnętrzna: start/koniec bez BaseLinkera (tylko status w bazie). */
export async function setInternalPromoState(id: string, state: 'active' | 'ended'): Promise<void> {
  const nowIso = new Date().toISOString();
  const row =
    state === 'active'
      ? { status: 'active', applied_at: nowIso, last_error: '', updated_at: nowIso }
      : { status: 'ended', ended_at: nowIso, last_error: '', updated_at: nowIso };
  const { error } = await db().from('promo_campaigns').update(row).eq('id', id);
  if (error) fail(error);
}

export async function deletePromoCampaign(id: string): Promise<void> {
  const { error } = await db().from('promo_campaigns').delete().eq('id', id);
  if (error) fail(error);
}

export async function duplicatePromoCampaign(id: string): Promise<PromoCampaign> {
  const sb = db();
  const { data: src, error } = await sb.from('promo_campaigns').select('*').eq('id', id).single();
  if (error) fail(error);
  const copy = await createPromoCampaign({
    name: `${String(src.name)} (kopia)`,
    note: String(src.note ?? ''),
    channel: src.channel === 'internal' ? 'internal' : 'baselinker',
    startsAt: null,
    endsAt: null,
    minMargin: src.min_margin != null ? Number(src.min_margin) : null,
  });
  const items = await fetchPromoItems(id);
  if (items.length) await savePromoItems(copy.id, items.map((i) => ({ ...i, id: undefined, blState: undefined })));
  return { ...copy, itemCount: items.length };
}

// ---------------------------------------------------------------------------------------------
// Aktywne promocje w katalogu (znacznik na kafelku, filtr „w promocji”)
// ---------------------------------------------------------------------------------------------

export interface LivePromo {
  promoGross: number;
  regularGross: number | null;
  campaign: string;
  endsAt: string | null;
}

const POLL_MS = 5 * 60_000;
let promos = new Map<string, LivePromo>();
let version = 0;
let started = false;
let inflight: Promise<void> | null = null;
let lastFetch = 0;
const listeners = new Set<() => void>();

function emit() {
  version++;
  for (const l of listeners) l();
}

export async function refreshLivePromos(force = false): Promise<void> {
  if (!supabase) return;
  if (inflight) return inflight;
  if (!force && Date.now() - lastFetch < 60_000) return;
  const sb = supabase;
  inflight = (async () => {
    try {
      const { data, error } = await sb
        .from('promo_items')
        .select('sku,promo_gross,regular_gross,campaign:promo_campaigns!inner(name,status,ends_at)')
        .eq('campaign.status', 'active');
      if (error) return; // brak tabel / brak dostępu (gość) — bez znaczników
      const next = new Map<string, LivePromo>();
      for (const r of data ?? []) {
        const c = (r as { campaign: { name: string; ends_at: string | null } | { name: string; ends_at: string | null }[] })
          .campaign;
        const camp = Array.isArray(c) ? c[0] : c;
        next.set(String(r.sku).toUpperCase(), {
          promoGross: Number(r.promo_gross),
          regularGross: r.regular_gross != null ? Number(r.regular_gross) : null,
          campaign: camp?.name ?? '',
          endsAt: camp?.ends_at ?? null,
        });
      }
      promos = next;
      lastFetch = Date.now();
      emit();
    } catch {
      /* ignoruj */
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export function startLivePromos(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  void refreshLivePromos(true);
  window.setInterval(() => void refreshLivePromos(), POLL_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void refreshLivePromos();
  });
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function getVersion(): number {
  return version;
}

export function getLivePromo(sku: string | undefined | null): LivePromo | null {
  if (!sku) return null;
  return promos.get(String(sku).trim().toUpperCase()) ?? null;
}

/** Hook: aktywna promocja produktu (po SKU) albo null; odświeża komponent po zmianie kampanii. */
export function useLivePromo(sku: string | undefined | null): LivePromo | null {
  useSyncExternalStore(subscribe, getVersion, getVersion);
  useEffect(() => {
    startLivePromos();
  }, []);
  return getLivePromo(sku);
}

/** Hook: wersja aktywnych promocji — do zależności useMemo filtrów. */
export function useLivePromosVersion(): number {
  const v = useSyncExternalStore(subscribe, getVersion, getVersion);
  useEffect(() => {
    startLivePromos();
  }, []);
  return v;
}
