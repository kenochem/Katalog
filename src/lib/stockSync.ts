import { supabase } from './supabase';
import type { CatalogType } from '../types';

export type StockSyncScope = CatalogType | 'all';

export type StockSyncRequest = {
  id: string;
  status: 'pending' | 'running' | 'done' | 'error';
  requested_at: string;
  finished_at?: string | null;
  message?: string | null;
  catalog?: string | null;
};

/** Zleca sync WAPRO na serwerze (agent odbiera zlecenie). */
export async function requestWaproStockSync(
  scope: StockSyncScope = 'all',
): Promise<{
  ok: boolean;
  error?: string;
  id?: string;
}> {
  if (!supabase) {
    return { ok: false, error: 'Brak konfiguracji Supabase' };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: 'Zaloguj się, żeby zlecić sync stanów.' };
  }

  const catalog = scope === 'all' ? 'all' : scope;

  // Nie mnoż pending dla tego samego zakresu
  const { data: existing } = await supabase
    .from('stock_sync_requests')
    .select('id, status, catalog')
    .eq('status', 'pending')
    .eq('catalog', catalog)
    .order('requested_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    return { ok: true, id: existing.id };
  }

  const { data, error } = await supabase
    .from('stock_sync_requests')
    .insert({
      status: 'pending',
      requested_by: user.id,
      catalog,
    })
    .select('id')
    .single();

  if (error) {
    // Stara baza bez kolumny catalog — fallback
    if (error.message.includes('catalog')) {
      const fallback = await supabase
        .from('stock_sync_requests')
        .insert({
          status: 'pending',
          requested_by: user.id,
        })
        .select('id')
        .single();
      if (fallback.error) {
        return { ok: false, error: fallback.error.message };
      }
      return { ok: true, id: fallback.data.id };
    }
    return {
      ok: false,
      error:
        error.message.includes('stock_sync_requests')
          ? 'Brak tabeli stock_sync_requests — uruchom migration-stock-sync-requests.sql w Supabase.'
          : error.message,
    };
  }

  return { ok: true, id: data.id };
}

export async function getLatestStockSync(): Promise<StockSyncRequest | null> {
  if (!supabase) return null;
  const { data } = await supabase
    .from('stock_sync_requests')
    .select('id, status, requested_at, finished_at, message, catalog')
    .order('requested_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as StockSyncRequest) || null;
}

export function stockSyncScopeLabel(scope: StockSyncScope): string {
  if (scope === 'accessories') return 'Akcesoria';
  if (scope === 'shop') return 'Produkty';
  return 'oba katalogi';
}
