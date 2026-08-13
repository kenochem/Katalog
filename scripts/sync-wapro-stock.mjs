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
import {
  buildWaproLookupMaps,
  isLikelyPlaceholderSku,
  productNeedsWaproBootstrap,
  resolveWaproRowForProduct,
} from './lib/waproSkuMatch.mjs';
import { importNewWaproFromCatalog } from './lib/waproMagImport.mjs';

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

function priceIsEmpty(v) {
  const n = numOrNull(v);
  return n == null || n === 0;
}

/** Jak w sync-wapro-stock-server.ps1 — uzupełnia puste ceny w Supabase. */
function priceFieldNeedsUpdate(dbVal, incoming) {
  if (incoming == null) return false;
  if (priceIsEmpty(dbVal)) return true;
  const old = numOrNull(dbVal);
  if (old == null) return true;
  return Math.abs(old - incoming) > 0.00005;
}

function mapIncomingRow(row) {
  return {
    sku: row.sku,
    stock: row.stock,
    pricePurchaseNet: row.pricePurchaseNet,
    priceSaleNet: row.priceSaleNet,
    priceSaleGross: row.priceSaleGross,
    price_purchase_net: row.pricePurchaseNet,
    price_sale_net: row.priceSaleNet,
    price_sale_gross: row.priceSaleGross,
  };
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
        'id, sku, stock, stock_manual, is_group, variants, price_purchase_net, price_sale_net, price_sale_gross, catalog, product_meta',
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

const incoming = loadRows(inputPath);
console.log(`Wczytano ${incoming.length} pozycji ze ${inputPath}`);

const waproMaps = buildWaproLookupMaps(
  incoming.map((r) => ({
    sku: r.sku,
    stock: r.stock,
    price_purchase_net: r.pricePurchaseNet,
    price_sale_net: r.priceSaleNet,
    price_sale_gross: r.priceSaleGross,
  })),
);

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
let pricesFilled = 0;
let linkedViaAlt = 0;
let bootstrapped = 0;
let warnings = 0;
const patches = [];

for (const p of products || []) {
  if (p.is_group && Array.isArray(p.variants) && p.variants.length) {
    let touched = false;
    let priceBuy = null;
    let priceSale = null;
    let priceGross = null;
    const nextVariants = p.variants.map((v) => {
      const hit = resolveWaproRowForProduct({ sku: v.sku, id: v.sku, product_meta: {} }, waproMaps);
      const row = hit?.row;
      if (!row) return v;
      touched = true;
      if (row.price_purchase_net != null) priceBuy = row.price_purchase_net;
      if (row.price_sale_net != null) priceSale = row.price_sale_net;
      if (row.price_sale_gross != null) priceGross = row.price_sale_gross;
      if (p.stock_manual) return v;
      return { ...v, stock: row.stock };
    });
    if (!touched) {
      skippedMissing++;
      if (isLikelyPlaceholderSku(p.sku)) warnings++;
      continue;
    }
    const payload = { id: p.id };
    let changed = false;
    const bootstrap = productNeedsWaproBootstrap({
      stock: p.stock,
      stock_manual: p.stock_manual,
      price_purchase_net: p.price_purchase_net,
      price_sale_net: p.price_sale_net,
      price_sale_gross: p.price_sale_gross,
    });
    if (!p.stock_manual) {
      const sum = nextVariants.reduce((a, v) => a + Number(v.stock || 0), 0);
      payload.stock = sum;
      payload.variants = nextVariants;
      changed = true;
    } else {
      skippedManual++;
    }
    if (priceFieldNeedsUpdate(p.price_purchase_net, priceBuy)) {
      payload.price_purchase_net = priceBuy;
      changed = true;
      pricesFilled++;
    }
    if (priceFieldNeedsUpdate(p.price_sale_net, priceSale)) {
      payload.price_sale_net = priceSale;
      changed = true;
      pricesFilled++;
    }
    if (priceFieldNeedsUpdate(p.price_sale_gross, priceGross)) {
      payload.price_sale_gross = priceGross;
      changed = true;
      pricesFilled++;
    }
    if (!changed) continue;
    if (bootstrap) bootstrapped++;
    patches.push(payload);
    updated++;
    continue;
  }

  const hit = resolveWaproRowForProduct(p, waproMaps);
  if (!hit) {
    skippedMissing++;
    if (isLikelyPlaceholderSku(p.sku)) warnings++;
    continue;
  }
  const incomingRow = mapIncomingRow({
    sku: hit.row.sku,
    stock: hit.row.stock,
    pricePurchaseNet: hit.row.price_purchase_net,
    priceSaleNet: hit.row.price_sale_net,
    priceSaleGross: hit.row.price_sale_gross,
  });
  if (hit.viaAlt) linkedViaAlt++;

  const payload = { id: p.id };
  let changed = false;
  const bootstrap = productNeedsWaproBootstrap(p);

  if (!p.stock_manual) {
    if (Number(p.stock) !== incomingRow.stock || bootstrap) {
      payload.stock = incomingRow.stock;
      changed = true;
    }
  } else {
    skippedManual++;
  }

  if (priceFieldNeedsUpdate(p.price_purchase_net, incomingRow.pricePurchaseNet)) {
    payload.price_purchase_net = incomingRow.pricePurchaseNet;
    changed = true;
    pricesFilled++;
  }
  if (priceFieldNeedsUpdate(p.price_sale_net, incomingRow.priceSaleNet)) {
    payload.price_sale_net = incomingRow.priceSaleNet;
    changed = true;
    pricesFilled++;
  }
  if (priceFieldNeedsUpdate(p.price_sale_gross, incomingRow.priceSaleGross)) {
    payload.price_sale_gross = incomingRow.priceSaleGross;
    changed = true;
    pricesFilled++;
  }

  if (!changed) continue;
  if (bootstrap) bootstrapped++;
  patches.push(payload);
  updated++;
}

const reportLine =
  `Do zapisu: ${patches.length}, uzupełnione pola cen: ${pricesFilled}, pominięte ręczne (stan): ${skippedManual}, ` +
  `brak w WAPRO: ${skippedMissing}, dopasowane po legacy/alt SKU: ${linkedViaAlt}, odkryte (pierwsze stany/ceny): ${bootstrapped}, ostrzezenia: ${warnings}`;
console.log(reportLine);

let importInserted = 0;

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

const autoImport = process.env.WAPRO_AUTO_IMPORT !== '0';
const catalogPath = resolve(
  process.env.WAPRO_MAG_CATALOG || 'data/wapro-mag-catalog.json',
);
if (autoImport && existsSync(catalogPath)) {
  try {
    const imp = await importNewWaproFromCatalog(supabase, catalogPath);
    if (imp.inserted > 0) {
      importInserted = imp.inserted;
      console.log(
        `WAPRO auto-import: +${imp.inserted} nowych pozycji (kandydatów: ${imp.candidates}).`,
      );
    } else if (imp.candidates > 0) {
      console.log(`WAPRO auto-import: ${imp.candidates} brakujących w bazie (limit 0?).`);
    }
  } catch (err) {
    console.error('WAPRO auto-import błąd:', err.message || err);
    process.exit(1);
  }
} else if (autoImport) {
  console.log(
    `WAPRO auto-import: pominięto (brak ${catalogPath}). Uruchom: py scripts/export-wapro-mag-catalog.py`,
  );
}

if (importInserted > 0) {
  console.log(
    `Raport sync (skrót): zaktualizowano ${updated}, nowe SKU z Mag: ${importInserted}`,
  );
}
