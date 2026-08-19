/**
 * Uzupełnia pole manufacturer w Supabase z CSV wyeksportowanego z WAPRO Mag.
 *
 * CSV: sku;producent  (separator ;, bez nagłówka — jak wapro-manufacturers.csv)
 * Duplikaty SKU w pliku są scalane (ostatni wygrywa).
 *
 *   node --env-file=.env scripts/backfill-manufacturers.mjs
 *   node --env-file=.env scripts/backfill-manufacturers.mjs C:\katalog-sync\wapro-manufacturers.csv
 *   node --env-file=.env scripts/backfill-manufacturers.mjs --apply
 *   node --env-file=.env scripts/backfill-manufacturers.mjs path.csv --apply --force
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const force = args.includes('--force');
const fileArg = args.find((a) => !a.startsWith('--'));

function resolveInputPath(explicit) {
  const fallbacks = [
    resolve(projectRoot, 'data/wapro-manufacturers.csv'),
    resolve('data/wapro-manufacturers.csv'),
    resolve('C:/katalog-sync/wapro-manufacturers.csv'),
    resolve('C:/katalog-sync/data/wapro-manufacturers.csv'),
  ];

  if (explicit) {
    const requested = resolve(explicit);
    if (existsSync(requested)) return requested;
    const alt = fallbacks.find((p) => existsSync(p));
    if (alt) {
      console.warn(`Podana ścieżka nie istnieje na tym PC:\n  ${requested}`);
      console.warn(`Używam pliku:\n  ${alt}\n`);
      return alt;
    }
  } else {
    for (const p of fallbacks) {
      if (existsSync(p)) return p;
    }
  }

  console.error(
    explicit
      ? `Brak pliku: ${resolve(explicit)}`
      : 'Nie znaleziono wapro-manufacturers.csv',
  );
  console.error('');
  console.error('Na serwerze WAPRO (RDP) plik jest zwykle tutaj:');
  console.error('  C:\\katalog-sync\\wapro-manufacturers.csv');
  console.error('');
  console.error('Skopiuj go na TEN komputer do:');
  console.error(`  ${resolve(projectRoot, 'data/wapro-manufacturers.csv')}`);
  console.error('');
  console.error('Albo podaj pełną ścieżkę na PC, np.:');
  console.error('  npm run backfill:manufacturers -- data/wapro-manufacturers.csv --apply');
  if (explicit) {
    console.error('');
    console.error('Uwaga: C:\\katalog-sync\\... to folder na serwerze — na PC często nie istnieje.');
  }
  process.exit(1);
}

const inputPath = resolveInputPath(fileArg);

if (!url || !key) {
  console.error('Potrzebne SUPABASE_URL/VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (--env-file=.env)');
  process.exit(1);
}

const SKIP_MANUFACTURERS = new Set(['', 'wapro', 'ogólna', 'ogolna', 'inne', 'ogólna']);

function normSku(s) {
  return String(s || '').trim().toUpperCase();
}

function normManufacturer(raw) {
  return String(raw || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function shouldSkipManufacturer(name) {
  const key = name.trim().toLowerCase();
  return SKIP_MANUFACTURERS.has(key);
}

function isPlaceholderManufacturer(value) {
  const v = (value || '').trim().toLowerCase();
  return !v || v === 'wapro';
}

function parseManufacturerCsv(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  const bySku = new Map();

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const sep = trimmed.includes(';') ? ';' : ',';
    const parts = trimmed.split(sep);
    if (parts.length < 2) continue;

    const head = parts[0].trim().toLowerCase();
    if (head === 'sku' || head === 'indeks_katalogowy') continue;

    const sku = normSku(parts[0]);
    const manufacturer = normManufacturer(parts.slice(1).join(sep));
    if (!sku || shouldSkipManufacturer(manufacturer)) continue;
    bySku.set(sku, manufacturer);
  }

  return bySku;
}

async function fetchAllProducts(supabase) {
  const out = [];
  let from = 0;
  const page = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('products')
      .select('id, sku, manufacturer, catalog')
      .range(from, from + page - 1)
      .order('sku');
    if (error) throw error;
    if (!data?.length) break;
    out.push(...data);
    if (data.length < page) break;
    from += page;
  }
  return out;
}

const supabase = createClient(url, key);
const raw = readFileSync(inputPath, 'utf8');
const waproBySku = parseManufacturerCsv(raw);

console.log(`Plik: ${inputPath}`);
console.log(`Unikalnych SKU w CSV: ${waproBySku.size}`);
console.log(`Tryb: ${apply ? (force ? 'ZAPIS (--force)' : 'ZAPIS') : 'PODGLĄD (dodaj --apply)'}`);

const products = await fetchAllProducts(supabase);
console.log(`Produktów w Supabase: ${products.length}`);

const updates = [];
let skippedHasManufacturer = 0;
let skippedNoCsv = 0;
let skippedSame = 0;

for (const p of products) {
  const sku = normSku(p.sku);
  const fromWapro = waproBySku.get(sku);
  if (!fromWapro) {
    skippedNoCsv++;
    continue;
  }

  const current = normManufacturer(p.manufacturer);
  if (current === fromWapro) {
    skippedSame++;
    continue;
  }

  if (!force && current && !isPlaceholderManufacturer(current)) {
    skippedHasManufacturer++;
    continue;
  }

  updates.push({ id: p.id, sku, from: current || '(pusty)', to: fromWapro });
}

console.log(`Do aktualizacji: ${updates.length}`);
console.log(`Pominięte — już ustawione: ${skippedHasManufacturer}`);
console.log(`Pominięte — brak w CSV: ${skippedNoCsv}`);
console.log(`Pominięte — bez zmian: ${skippedSame}`);

if (updates.length) {
  console.log('\nPrzykłady:');
  for (const u of updates.slice(0, 12)) {
    console.log(`  ${u.sku}: ${u.from} → ${u.to}`);
  }
  if (updates.length > 12) console.log(`  … +${updates.length - 12}`);
}

if (!apply) {
  console.log('\nUruchom z --apply aby zapisać. --force nadpisuje istniejące marki.');
  process.exit(0);
}

const BATCH = 100;
let saved = 0;
for (let i = 0; i < updates.length; i += BATCH) {
  const chunk = updates.slice(i, i + BATCH);
  await Promise.all(
    chunk.map(async (u) => {
      const { error } = await supabase
        .from('products')
        .update({ manufacturer: u.to })
        .eq('id', u.id);
      if (error) throw error;
      saved++;
    }),
  );
  process.stdout.write(`\rZapisano ${saved}/${updates.length}…`);
}

console.log(`\nGotowe — zaktualizowano ${saved} produktów.`);
