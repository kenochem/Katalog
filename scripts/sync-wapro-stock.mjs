/**
 * Cykliczna aktualizacja TYLKO stanów w Supabase (katalog accessories).
 *
 * Źródła (kolejność):
 *  1) plik CSV: sku;stock  lub  sku,stock   (domyślnie data/wapro-stock.csv)
 *  2) albo JSON tablica [{ "sku", "stock" }]
 *
 * Nie nadpisuje pozycji z stock_manual = true.
 *
 * Użycie:
 *   node --env-file=.env scripts/sync-wapro-stock.mjs
 *   node --env-file=.env scripts/sync-wapro-stock.mjs path/do/plik.csv
 *
 * Na serwerze WAPRO: Harmonogram zadań Windows co 15–60 min:
 *   1) sqlcmd → CSV
 *   2) ten skrypt
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

const inputPath = resolve(
  process.argv[2] || 'data/wapro-stock.csv',
);

if (!existsSync(inputPath)) {
  console.error(`Brak pliku: ${inputPath}`);
  console.error(
    'Wyeksportuj stany z WAPRO (scripts/sql/wapro-stock-export.sql) albo podaj ścieżkę CSV.',
  );
  process.exit(1);
}

const supabase = createClient(url, key);
const CATALOG = 'accessories';
const BATCH = 150;

function parseCsv(text) {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return [];

  const sep = lines[0].includes(';') ? ';' : ',';
  const rows = [];
  let start = 0;
  const header = lines[0].toLowerCase();
  if (header.includes('sku') && header.includes('stock')) start = 1;

  for (let i = start; i < lines.length; i++) {
    const parts = lines[i].split(sep).map((p) => p.trim().replace(/^"|"$/g, ''));
    if (parts.length < 2) continue;
    const sku = String(parts[0]).toUpperCase();
    const stock = Number(String(parts[1]).replace(',', '.'));
    if (!sku || Number.isNaN(stock)) continue;
    rows.push({ sku, stock });
  }
  return rows;
}

function loadRows(path) {
  const raw = readFileSync(path, 'utf8');
  if (path.endsWith('.json')) {
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) throw new Error('JSON musi być tablicą');
    return data.map((r) => ({
      sku: String(r.sku || '').toUpperCase(),
      stock: Number(r.stock),
    })).filter((r) => r.sku && !Number.isNaN(r.stock));
  }
  return parseCsv(raw);
}

const incoming = loadRows(inputPath);
console.log(`Wczytano ${incoming.length} pozycji ze ${inputPath}`);

const bySku = new Map();
for (const row of incoming) {
  // ostatni wygrywa przy duplikatach
  bySku.set(row.sku, row.stock);
}

const { data: products, error } = await supabase
  .from('products')
  .select('id, sku, stock, stock_manual, is_group, variants')
  .eq('catalog', CATALOG);

if (error) {
  console.error(error.message);
  process.exit(1);
}

let updated = 0;
let skippedManual = 0;
let skippedMissing = 0;
const patches = [];

for (const p of products || []) {
  if (p.stock_manual) {
    skippedManual++;
    continue;
  }

  if (p.is_group && Array.isArray(p.variants) && p.variants.length) {
    let touched = false;
    const nextVariants = p.variants.map((v) => {
      const sku = String(v.sku || '').toUpperCase();
      if (!bySku.has(sku)) return v;
      touched = true;
      return { ...v, stock: bySku.get(sku) };
    });
    if (!touched) {
      skippedMissing++;
      continue;
    }
    const sum = nextVariants.reduce((a, v) => a + Number(v.stock || 0), 0);
    patches.push({
      id: p.id,
      stock: sum,
      variants: nextVariants,
    });
    updated++;
    continue;
  }

  const sku = String(p.sku || '').toUpperCase();
  if (!bySku.has(sku)) {
    skippedMissing++;
    continue;
  }
  const stock = bySku.get(sku);
  if (Number(p.stock) === stock) continue;
  patches.push({ id: p.id, stock });
  updated++;
}

console.log(
  `Do zapisu: ${patches.length} (zmienione), pominięte ręczne: ${skippedManual}, brak w pliku: ${skippedMissing}`,
);

for (let i = 0; i < patches.length; i += BATCH) {
  const chunk = patches.slice(i, i + BATCH);
  const results = await Promise.all(
    chunk.map((row) => {
      const payload = { stock: row.stock };
      if (row.variants) payload.variants = row.variants;
      return supabase.from('products').update(payload).eq('id', row.id);
    }),
  );
  const err = results.find((r) => r.error)?.error;
  if (err) {
    console.error('Update error:', err.message);
    process.exit(1);
  }
  console.log(`Zapisano ${Math.min(i + BATCH, patches.length)} / ${patches.length}`);
}

console.log('Sync stanów WAPRO → Supabase zakończony.');
