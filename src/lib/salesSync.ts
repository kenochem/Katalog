import { supabase } from './supabase';

export type SalesSyncRequest = {
  id: string;
  status: 'pending' | 'running' | 'done' | 'error';
  requested_at: string;
  finished_at?: string | null;
  message?: string | null;
};

/** Zleca zbiorczy sync sprzedaży WAPRO (agent: jedno SQL, update wszystkich produktów). */
export async function requestWaproSalesSync(): Promise<{
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
    return { ok: false, error: 'Zaloguj się, żeby zlecić sync sprzedaży.' };
  }

  const { data: existing } = await supabase
    .from('sales_sync_requests')
    .select('id, status')
    .eq('status', 'pending')
    .order('requested_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    return { ok: true, id: existing.id };
  }

  const { data, error } = await supabase
    .from('sales_sync_requests')
    .insert({
      status: 'pending',
      requested_by: user.id,
    })
    .select('id')
    .single();

  if (error) {
    return {
      ok: false,
      error: error.message.includes('sales_sync_requests')
        ? 'Brak tabeli sales_sync_requests — uruchom migration-sales-sync-requests.sql w Supabase.'
        : error.message,
    };
  }

  return { ok: true, id: data.id };
}

export async function getLatestSalesSync(): Promise<SalesSyncRequest | null> {
  if (!supabase) return null;
  const { data } = await supabase
    .from('sales_sync_requests')
    .select('id, status, requested_at, finished_at, message')
    .order('requested_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as SalesSyncRequest) || null;
}

export async function waitForSalesSync(
  id: string,
  options?: { timeoutMs?: number; intervalMs?: number },
): Promise<SalesSyncRequest | null> {
  if (!supabase) return null;
  const timeoutMs = options?.timeoutMs ?? 300_000;
  const intervalMs = options?.intervalMs ?? 3_000;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const { data } = await supabase
      .from('sales_sync_requests')
      .select('id, status, requested_at, finished_at, message')
      .eq('id', id)
      .maybeSingle();
    const row = data as SalesSyncRequest | null;
    if (!row) return null;
    if (row.status === 'done' || row.status === 'error') return row;
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  const { data } = await supabase
    .from('sales_sync_requests')
    .select('id, status, requested_at, finished_at, message')
    .eq('id', id)
    .maybeSingle();
  return (data as SalesSyncRequest) || null;
}
