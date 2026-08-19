import type { Product } from '../types';
import type { ProductMeta } from './productMeta';

export type WaproSkuCandidateSource =
  | 'sku'
  | 'id'
  | 'shop_id'
  | 'meta_wapro'
  | 'meta_legacy'
  | 'meta_previous'
  | 'meta_baselinker';

export type WaproSkuCandidate = {
  sku: string;
  source: WaproSkuCandidateSource;
};

const PLACEHOLDER_SKU = /^(BL[-_]?)?\d{6,}$/i;

export function isLikelyPlaceholderSku(sku: string): boolean {
  const s = sku.trim();
  if (!s) return false;
  if (/^BL/i.test(s) && /\d/.test(s)) return true;
  return PLACEHOLDER_SKU.test(s.replace(/\s/g, ''));
}

function metaRecord(meta: ProductMeta | undefined): Record<string, unknown> {
  return (meta ?? {}) as Record<string, unknown>;
}

/** Kolejność dopasowania do eksportu WAPRO (INDEKS_KATALOGOWY). */
export function waproSkuCandidates(product: Pick<Product, 'id' | 'sku' | 'meta'>): WaproSkuCandidate[] {
  const out: WaproSkuCandidate[] = [];
  const seen = new Set<string>();

  function push(raw: string | undefined | null, source: WaproSkuCandidateSource) {
    const sku = String(raw ?? '').trim().toUpperCase();
    if (!sku || seen.has(sku)) return;
    seen.add(sku);
    out.push({ sku, source });
  }

  push(product.sku, 'sku');

  const id = String(product.id ?? '').trim().toUpperCase();
  const shopM = id.match(/^SHOP-(.+)$/);
  if (shopM?.[1]) push(shopM[1], 'shop_id');
  else if (id && id !== product.sku?.toUpperCase()) push(id, 'id');

  const m = metaRecord(product.meta);
  push(typeof m.waproSku === 'string' ? m.waproSku : undefined, 'meta_wapro');
  push(typeof m.legacySku === 'string' ? m.legacySku : undefined, 'meta_legacy');
  push(typeof m.previousSku === 'string' ? m.previousSku : undefined, 'meta_previous');
  push(typeof m.baselinkerProductId === 'string' ? m.baselinkerProductId : undefined, 'meta_baselinker');

  return out;
}

export function productNeedsWaproBootstrap(product: {
  stock?: number | null;
  stockManual?: boolean;
  pricePurchaseNet?: number | null;
  priceSaleNet?: number | null;
  priceSaleGross?: number | null;
}): boolean {
  if (product.stockManual) return false;
  const stock = Number(product.stock ?? 0);
  const pricesEmpty =
    !pricePositive(product.pricePurchaseNet) &&
    !pricePositive(product.priceSaleNet) &&
    !pricePositive(product.priceSaleGross);
  return pricesEmpty && (!Number.isFinite(stock) || stock === 0);
}

function pricePositive(v: unknown): boolean {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) && n > 0;
}

export type WaproSyncStats = {
  linkedViaAltSku?: number;
  bootstrapped?: number;
  warnings?: number;
  newSkuFromMag?: number;
};

/** Parsuje skrócony raport z sync-wapro-stock (serwer / lokalny). */
export function parseWaproSyncMessage(message: string | null | undefined): {
  summary: string;
  stats: WaproSyncStats;
  warningHint?: string;
} {
  const raw = (message ?? '').trim();
  if (!raw) return { summary: '', stats: {} };

  const stats: WaproSyncStats = {};
  const alt = raw.match(/dopasowane po (?:legacy|alt)[^:]*:\s*(\d+)/i);
  if (alt) stats.linkedViaAltSku = Number(alt[1]);
  const boot = raw.match(/odkryte[^:]*:\s*(\d+)/i);
  if (boot) stats.bootstrapped = Number(boot[1]);
  const warn = raw.match(/ostrzezenia:\s*(\d+)/i);
  if (warn) stats.warnings = Number(warn[1]);
  const neu = raw.match(/nowe SKU z Mag:\s*(\d+)/i);
  if (neu) stats.newSkuFromMag = Number(neu[1]);

  let warningHint: string | undefined;
  if (stats.warnings && stats.warnings > 0) {
    warningHint = `${stats.warnings} starych pozycji do sprawdzenia: SKU bez dopasowania w WAPRO. Sync nowych produktów działa dalej.`;
  } else if (/brak w WAPRO:\s*[1-9]/i.test(raw)) {
    const m = raw.match(/brak w WAPRO:\s*(\d+)/i);
    if (m && Number(m[1]) > 0) {
      warningHint = `${m[1]} pozycji w katalogu nie ma odpowiednika w Mag. To lista porządkowa, nie błąd dodawania nowych produktów.`;
    }
  }

  return { summary: raw, stats, warningHint };
}
