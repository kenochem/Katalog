import { supabase } from './supabase';

export const CRM_SETTINGS_CHANGED = 'katalog-crm-settings-changed';

export interface CrmCompanyConfig {
  quietDays: number;
  defaultPaymentDays: number;
  defaultCreditLimit: number;
  regions: string[];
}

export const DEFAULT_CRM_COMPANY_CONFIG: CrmCompanyConfig = {
  quietDays: 60,
  defaultPaymentDays: 14,
  defaultCreditLimit: 5000,
  regions: ['Polnoc', 'Poludnie', 'Zachod', 'Wschod'],
};

const DEFAULT_COMMISSION_PCT = 15;

/** Ustawienia handlowca (prowizja %, konfiguracja firmy) — Supabase (crm_user_settings),
 * jeden wiersz na usera. Cache w pamieci, zeby load*() zostal synchroniczny. */
let commissionCache = DEFAULT_COMMISSION_PCT;
let companyConfigCache: CrmCompanyConfig = DEFAULT_CRM_COMPANY_CONFIG;
let ready = false;
let inFlight: Promise<void> | null = null;

function normalizeConfigNumber(value: unknown, fallback: number, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function normalizeRegions(value: unknown): string[] {
  if (!Array.isArray(value)) return DEFAULT_CRM_COMPANY_CONFIG.regions;
  const list = value.filter((r): r is string => typeof r === 'string' && r.trim().length > 0);
  return list.length ? list : DEFAULT_CRM_COMPANY_CONFIG.regions;
}

async function refresh(): Promise<void> {
  if (!supabase) {
    ready = true;
    return;
  }
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  if (!user) {
    ready = true;
    return;
  }
  const { data, error } = await supabase
    .from('crm_user_settings')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!error && data) {
    commissionCache = normalizeConfigNumber(data.commission_pct, DEFAULT_COMMISSION_PCT, 0, 100);
    const cfg = (data.company_config as Partial<CrmCompanyConfig>) || {};
    companyConfigCache = {
      quietDays: normalizeConfigNumber(cfg.quietDays, 60, 7, 365),
      defaultPaymentDays: normalizeConfigNumber(cfg.defaultPaymentDays, 14, 0, 120),
      defaultCreditLimit: normalizeConfigNumber(cfg.defaultCreditLimit, 5000, 0, 1000000),
      regions: normalizeRegions(cfg.regions),
    };
  }
  ready = true;
  window.dispatchEvent(new CustomEvent(CRM_SETTINGS_CHANGED));
}

function ensureLoaded(): void {
  if (ready || inFlight) return;
  inFlight = refresh().finally(() => {
    inFlight = null;
  });
}

async function persist(patch: { commissionPct?: number; companyConfig?: CrmCompanyConfig }) {
  if (!supabase) return;
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  if (!user) return;
  await supabase.from('crm_user_settings').upsert({
    user_id: user.id,
    commission_pct: patch.commissionPct ?? commissionCache,
    company_config: patch.companyConfig ?? companyConfigCache,
    updated_at: new Date().toISOString(),
  });
}

export function loadCommissionPct(): number {
  ensureLoaded();
  return commissionCache;
}

export function saveCommissionPct(n: number) {
  commissionCache = n;
  window.dispatchEvent(new CustomEvent(CRM_SETTINGS_CHANGED));
  void persist({ commissionPct: n });
}

export function loadCrmCompanyConfig(): CrmCompanyConfig {
  ensureLoaded();
  return companyConfigCache;
}

export function saveCrmCompanyConfig(config: CrmCompanyConfig) {
  companyConfigCache = config;
  window.dispatchEvent(new CustomEvent(CRM_SETTINGS_CHANGED));
  void persist({ companyConfig: config });
}
