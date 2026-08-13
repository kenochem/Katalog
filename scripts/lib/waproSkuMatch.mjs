/** Wspólna logika dopasowania SKU → WAPRO (sync lokalny Node). */

const PLACEHOLDER_SKU = /^(BL[-_]?)?\d{6,}$/i;

export function isLikelyPlaceholderSku(sku) {
  const s = String(sku || '').trim();
  if (!s) return false;
  if (/^BL/i.test(s) && /\d/.test(s)) return true;
  return PLACEHOLDER_SKU.test(s.replace(/\s/g, ''));
}

export function waproSkuCandidates(product) {
  const out = [];
  const seen = new Set();

  function push(raw, source) {
    const sku = String(raw ?? '').trim().toUpperCase();
    if (!sku || seen.has(sku)) return;
    seen.add(sku);
    out.push({ sku, source });
  }

  push(product.sku, 'sku');

  const id = String(product.id ?? '').trim().toUpperCase();
  const shopM = id.match(/^SHOP-(.+)$/);
  if (shopM?.[1]) push(shopM[1], 'shop_id');
  else if (id && id !== String(product.sku || '').toUpperCase()) push(id, 'id');

  const m = product.product_meta && typeof product.product_meta === 'object' ? product.product_meta : {};
  push(m.waproSku, 'meta_wapro');
  push(m.legacySku, 'meta_legacy');
  push(m.previousSku, 'meta_previous');
  push(m.baselinkerProductId, 'meta_baselinker');

  return out;
}

export function productNeedsWaproBootstrap(p) {
  if (p.stock_manual) return false;
  const stock = Number(p.stock ?? 0);
  const pricesEmpty =
    !pricePositive(p.price_purchase_net) &&
    !pricePositive(p.price_sale_net) &&
    !pricePositive(p.price_sale_gross);
  return pricesEmpty && (!Number.isFinite(stock) || stock === 0);
}

function pricePositive(v) {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) && n > 0;
}

export function normSkuKey(sku) {
  const s = String(sku || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  const m = s.match(/^([A-Z]+)0*([0-9]+)$/);
  if (m) return m[1] + String(Number(m[2]));
  return s;
}

export function buildWaproLookupMaps(incoming) {
  const bySku = new Map();
  const byNormSku = new Map();
  for (const row of incoming) {
    bySku.set(row.sku, row);
    const nk = normSkuKey(row.sku);
    if (!byNormSku.has(nk)) byNormSku.set(nk, row);
  }
  return { bySku, byNormSku };
}

export function lookupWaproRow(sku, maps) {
  const u = String(sku || '').toUpperCase();
  return maps.bySku.get(u) || maps.byNormSku.get(normSkuKey(u)) || null;
}

export function resolveWaproRowForProduct(product, maps) {
  const candidates = waproSkuCandidates(product);
  for (let i = 0; i < candidates.length; i++) {
    const row = lookupWaproRow(candidates[i].sku, maps);
    if (row) {
      return {
        row,
        matchedSku: candidates[i].sku,
        viaAlt: i > 0 || candidates[i].source !== 'sku',
        source: candidates[i].source,
      };
    }
  }
  return null;
}
