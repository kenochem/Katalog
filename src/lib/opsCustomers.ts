import { isSupabaseConfigured, supabase } from './supabase';

export interface OpsCustomer {
  id: string;
  wapro_id: string;
  code: string | null;
  name: string;
  legal_name: string | null;
  nip: string | null;
  nip_normalized: string | null;
  city: string | null;
  postal_code: string | null;
  street: string | null;
  address: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  payment_terms_days: number | null;
  credit_limit: number | null;
  balance: number | null;
  is_active: boolean;
  source: string;
  synced_at: string | null;
  updated_at: string | null;
}

export interface OpsCustomerResult {
  rows: OpsCustomer[];
  count: number;
  error?: string;
}

function sanitizeSearch(value: string) {
  return value.replace(/[%(),]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function normalizeNip(value: string) {
  return value.replace(/\D/g, '');
}

export async function fetchOpsCustomers(search = '', limit = 200): Promise<OpsCustomerResult> {
  if (!isSupabaseConfigured || !supabase) {
    return {
      rows: [],
      count: 0,
      error: 'Supabase nie jest skonfigurowany dla tej aplikacji.',
    };
  }

  const term = sanitizeSearch(search);
  const nip = normalizeNip(term);
  let query = supabase
    .from('ops_customers')
    .select(
      'id,wapro_id,code,name,legal_name,nip,nip_normalized,city,postal_code,street,address,country,phone,email,payment_terms_days,credit_limit,balance,is_active,source,synced_at,updated_at',
      { count: 'exact' },
    )
    .order('name', { ascending: true })
    .limit(limit);

  if (term) {
    const like = `%${term}%`;
    const clauses = [
      `name.ilike.${like}`,
      `legal_name.ilike.${like}`,
      `city.ilike.${like}`,
      `address.ilike.${like}`,
      `code.ilike.${like}`,
    ];
    if (nip) clauses.push(`nip_normalized.ilike.%${nip}%`);
    query = query.or(clauses.join(','));
  }

  const { data, count, error } = await query;
  if (error) {
    return { rows: [], count: 0, error: error.message };
  }
  return { rows: (data ?? []) as OpsCustomer[], count: count ?? data?.length ?? 0 };
}

