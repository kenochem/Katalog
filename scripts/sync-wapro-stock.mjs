/**
 * Cykliczna aktualizacja stanów (+ opcjonalnie cen netto) w Supabase.
 *
 * CSV: sku;stock  albo  sku;stock;price_purchase_net;price_sale_net;price_sale_gross
 * JSON: [{ sku, stock, pricePurchaseNet?, priceSaleNet?, priceSaleGross? }]
 *
 * Nie nadpisuje pozycji z stock_manual = true (dla stanu).
 * Ceny aktualizuje po SKU we wszystkich katalogach (accessories + shop).
 *
 *   node --env-file=.env scripts/sync-wapro-stock.mjs
 *   node --env-file=.env scripts/sync-wapro-stock.mjs path/do/plik.csv
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error(
    'Potrzebne VITE_SUPABASE_URL (lub SUPABASE_URL) oraz SUPABASE_SERVICE_ROLE_KEY w .env',
  );
  process.exit(1);
}

const inputPath = resolve(process.argv[2] || 'data/wapro-stock.csv');

if (!existsSync(inputPath)) {
  console.error(`Brak pliku: ${inputPath}`);
  console.error(
    'Wyeksportuj stany z WAPRO (scripts/sql/wapro-stock-export.sql) albo podaj ścieżkę CSV.',
  );
  process.exit(1);
}

const supabase = createClient(url, key);
const BATCH = 150;
const PAGE = 1000;

function numOrNull(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function parseCsv(text) {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return [];

  const sep = lines[0].includes(';') ? ';' : ',';
  let start = 0;
  const headerParts = lines[0].toLowerCase().split(sep).map((h) => h.trim());
  const hasHeader = headerParts.includes('sku') && headerParts.includes('stock');
  let idxSku = 0;
  let idxStock = 1;
  let idxBuy = -1;
  let idxSale = -1;
  let idxGross = -1;
  if (hasHeader) {
    start = 1;
    idxSku = headerParts.indexOf('sku');
    idxStock = headerParts.indexOf('stock');
    idxBuy = headerParts.findIndex((h) =>
      /price_purchase|purchase_net|zakup/.test(h),
    );
    idxSale = headerParts.findIndex((h) =>
      /price_sale_net|sale_net|sprzedaz_netto|sprzedaż_netto/.test(h),
    );
    idxGross = headerParts.findIndex((h) =>
      /price_sale_gross|sale_gross|brutto/.test(h),
    );
    if (idxSale < 0) {
      idxSale = headerParts.findIndex((h) => /price_sale|sprzeda/.test(h));
    }
  } else if (headerParts.length >= 4) {
    idxBuy = 2;
    idxSale = 3;
    if (headerParts.length >= 5) idxGross = 4;
  }

  const rows = [];
  for (let i = start; i < lines.length; i++) {
    const parts = lines[i].split(sep).map((p) => p.trim().replace(/^"|"$/g, ''));
    const sku = String(parts[idxSku] || '').toUpperCase();
    const stock = Number(String(parts[idxStock] || '').replace(',', '.'));
    if (!sku || Number.isNaN(stock)) continue;
    rows.push({
      sku,
      stock,
      pricePurchaseNet: idxBuy >= 0 ? numOrNull(parts[idxBuy]) : null,
      priceSaleNet: idxSale >= 0 ? numOrNull(parts[idxSale]) : null,
      priceSaleGross: idxGross >= 0 ? numOrNull(parts[idxGross]) : null,
    });
  }
  return rows;
}

function loadRows(path) {
  const raw = readFileSync(path, 'utf8');
  if (path.endsWith('.json')) {
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) throw new Error('JSON musi być tablicą');
    return data
      .map((r) => ({
        sku: String(r.sku || '').toUpperCase(),
        stock: Number(r.stock),
        pricePurchaseNet: numOrNull(r.pricePurchaseNet ?? r.price_purchase_net),
        priceSaleNet: numOrNull(r.priceSaleNet ?? r.price_sale_net),
        priceSaleGross: numOrNull(r.priceSaleGross ?? r.price_sale_gross),
      }))
      .filter((r) => r.sku && !Number.isNaN(r.stock));
  }
  return parseCsv(raw);
}

async function fetchAllProducts() {
  const all = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('products')
      .select(
        'id, sku, stock, stock_manual, is_group, variants, price_purchase_net, price_sale_net, price_sale_gross, catalog',
      )
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data?.length) break;
    all.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

function normSkuKey(sku: string): string {
  const s = String(sku || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  const m = s.match(/^([A-Z]+)0*([0-9]+)$/);
  if (m) return m[1] + String(Number(m[2]));
  return s;
}

const incoming = loadRows(inputPath);
console.log(`Wczytano ${incoming.length} pozycji ze ${inputPath}`);

const bySku = new Map();
const byNormSku = new Map();
for (const row of incoming) {
  bySku.set(row.sku, row);
  const nk = normSkuKey(row.sku);
  if (!byNormSku.has(nk)) byNormSku.set(nk, row);
}

function lookupIncoming(sku: string) {
  const u = String(sku || '').toUpperCase();
  return bySku.get(u) || byNormSku.get(normSkuKey(u)) || null;
}

let products;
try {
  products = await fetchAllProducts();
} catch (err) {
  console.error(err.message || err);
  process.exit(1);
}

let updated = 0;
let skippedManual = 0;
let skippedMissing = 0;
const patches = [];

for (const p of products || []) {
  const incomingRow = (() => {
    if (p.is_group && Array.isArray(p.variants) && p.variants.length) {
      return null;
    }
    return lookupIncoming(String(p.sku || ''));
  })();

  if (p.is_group && Array.isArray(p.variants) && p.variants.length) {
    if (p.stock_manual) {
      skippedManual++;
      continue;
    }
    let touched = false;
    let priceBuy = null;
    let priceSale = null;
    let priceGross = null;
    const nextVariants = p.variants.map((v) => {
      const row = lookupIncoming(String(v.sku || ''));
      if (!row) return v;
      touched = true;
      if (row.pricePurchaseNet != null) priceBuy = row.pricePurchaseNet;
      if (row.priceSaleNet != null) priceSale = row.priceSaleNet;
      if (row.priceSaleGross != null) priceGross = row.priceSaleGross;
      return { ...v, stock: row.stock };
    });
    if (!touched) {
      skippedMissing++;
      continue;
    }
    const sum = nextVariants.reduce((a, v) => a + Number(v.stock || 0), 0);
    const payload = { id: p.id, stock: sum, variants: nextVariants };
    if (priceBuy != null) payload.price_purchase_net = priceBuy;
    if (priceSale != null) payload.price_sale_net = priceSale;
    if (priceGross != null) payload.price_sale_gross = priceGross;
    patches.push(payload);
    updated++;
    continue;
  }

  if (!incomingRow) {
    skippedMissing++;
    continue;
  }

  const payload = { id: p.id };
  let changed = false;

  if (!p.stock_manual) {
    if (Number(p.stock) !== incomingRow.stock) {
      payload.stock = incomingRow.stock;
      changed = true;
    }
  } else {
    skippedManual++;
  }

  if (
    incomingRow.pricePurchaseNet != null &&
    Number(p.price_purchase_net) !== incomingRow.pricePurchaseNet
  ) {
    payload.price_purchase_net = incomingRow.pricePurchaseNet;
    changed = true;
  }
  if (
    incomingRow.priceSaleNet != null &&
    Number(p.price_sale_net) !== incomingRow.priceSaleNet
  ) {
    payload.price_sale_net = incomingRow.priceSaleNet;
    changed = true;
  }
  if (
    incomingRow.priceSaleGross != null &&
    Number(p.price_sale_gross) !== incomingRow.priceSaleGross
  ) {
    payload.price_sale_gross = incomingRow.priceSaleGross;
    changed = true;
  }

  if (!changed) continue;
  patches.push(payload);
  updated++;
}

console.log(
  `Do zapisu: ${patches.length}, pominięte ręczne (stan): ${skippedManual}, brak w pliku: ${skippedMissing}`,
);

for (let i = 0; i < patches.length; i += BATCH) {
  const chunk = patches.slice(i, i + BATCH);
  const results = await Promise.all(
    chunk.map((row) => {
      const { id, ...payload } = row;
      return supabase.from('products').update(payload).eq('id', id);
    }),
  );
  const err = results.find((r) => r.error)?.error;
  if (err) {
    console.error('Update error:', err.message);
    process.exit(1);
  }
  console.log(`Zapisano ${Math.min(i + BATCH, patches.length)} / ${patches.length}`);
}

console.log(`Sync WAPRO → Supabase zakończony (${updated} pozycji).`);
