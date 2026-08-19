#!/usr/bin/env node
/**
 * Importuje kontrahentow WAPRO do public.ops_customers.
 *
 *   node --env-file=.env scripts/import-wapro-customers.mjs
 *   node --env-file=.env scripts/import-wapro-customers.mjs data/wapro-customers.json --dry-run
 */
import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const dryRun = process.argv.includes('--dry-run');
const inputPath = resolve(
  process.argv.find((arg) => !arg.startsWith('-') && /\.(json|csv|tsv)$/i.test(arg)) ||
    'data/wapro-customers.json',
);
const BATCH = 150;

if (!dryRun && (!url || !key)) {
  console.error('Potrzebne SUPABASE_URL/VITE_SUPABASE_URL oraz SUPABASE_SERVICE_ROLE_KEY w .env');
  process.exit(1);
}

if (!existsSync(inputPath)) {
  console.error(`Brak pliku: ${inputPath}`);
  console.error('Najpierw wykonaj: py scripts/export-wapro-customers.py --file "Kontrahenci.xls"');
  process.exit(1);
}

function normalizeNip(value) {
  return String(value || '').replace(/\D/g, '');
}

function numOrNull(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(String(value).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function intOrNull(value) {
  const n = numOrNull(value);
  return n == null ? null : Math.round(n);
}

function boolOrDefault(value, fallback = true) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  const text = String(value).trim().toLowerCase();
  if (['1', 'true', 'tak', 'yes', 'y', 'aktywny', 'active'].includes(text)) return true;
  if (['0', 'false', 'nie', 'no', 'n', 'nieaktywny', 'inactive', 'archiwalny'].includes(text)) {
    return false;
  }
  return fallback;
}

function fallbackId(row) {
  const nip = normalizeNip(row.nip);
  if (nip) return `nip:${nip}`;
  const name = String(row.name || row.legalName || row.legal_name || '').trim().toLowerCase();
  return `name:${name.replace(/\s+/g, '-')}`.slice(0, 120);
}

function pick(row, keys) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') {
      return row[key];
    }
  }
  return '';
}

function mapRow(row) {
  const name = String(
    pick(row, ['name', 'nazwa', 'kontrahent', 'nazwa kontrahenta', 'legalName', 'legal_name', 'nazwa pelna', 'code', 'kod']),
  ).trim();
  const nip = String(pick(row, ['nip', 'NIP', 'n i p'])).trim();
  const code = String(pick(row, ['code', 'kod', 'symbol', 'skrot', 'akronim'])).trim();
  const explicitActive = pick(row, ['isActive', 'is_active', 'aktywny', 'status', 'active']);
  const nameLooksInactive = /^x[ ._-]|^xxx/i.test(name);
  const waproId = String(
    pick(row, ['waproId', 'wapro_id', 'id', 'ID', 'Id', 'identyfikator']) || code || fallbackId({ ...row, name, nip }),
  ).trim();
  return {
    wapro_id: waproId,
    code: code || null,
    name: name || waproId,
    legal_name: String(pick(row, ['legalName', 'legal_name', 'nazwa pelna', 'pelna nazwa', 'firma'])).trim() || null,
    nip: nip || null,
    nip_normalized: normalizeNip(nip) || null,
    city: String(pick(row, ['city', 'miasto', 'miejscowosc', 'miejscowość'])).trim() || null,
    postal_code: String(pick(row, ['postalCode', 'postal_code', 'kod pocztowy'])).trim() || null,
    street: String(pick(row, ['street', 'ulica'])).trim() || null,
    address: String(pick(row, ['address', 'adres', 'adres pelny'])).trim() || null,
    country: String(pick(row, ['country', 'kraj', 'panstwo']))?.trim() || 'PL',
    phone: String(pick(row, ['phone', 'telefon', 'tel', 'komorka'])).trim() || null,
    email: String(pick(row, ['email', 'e-mail', 'mail'])).trim() || null,
    payment_terms_days: intOrNull(pick(row, ['paymentTermsDays', 'payment_terms_days', 'termin platnosci', 'dni platnosci'])),
    credit_limit: numOrNull(pick(row, ['creditLimit', 'credit_limit', 'limit kredytu', 'limit kupiecki', 'limit'])),
    balance: numOrNull(pick(row, ['balance', 'saldo', 'naleznosci'])),
    is_active: boolOrDefault(explicitActive, !nameLooksInactive),
    source: 'wapro',
    raw: row,
    synced_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function parseDelimited(text, path) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const first = lines[0];
  const sep = path.toLowerCase().endsWith('.tsv') || first.includes('\t') ? '\t' : first.includes(';') ? ';' : ',';
  const headers = lines[0].split(sep).map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cols = line.split(sep).map((c) => c.trim().replace(/^"|"$/g, ''));
    const row = {};
    headers.forEach((header, index) => {
      row[header] = cols[index] ?? '';
    });
    return row;
  });
}

function loadRows(path) {
  const raw = readFileSync(path, 'utf8');
  if (/\.(csv|tsv)$/i.test(path)) return parseDelimited(raw, path);
  const parsed = JSON.parse(raw);
  const rows = Array.isArray(parsed) ? parsed : parsed?.rows;
  if (!Array.isArray(rows)) throw new Error('Plik musi zawierac tablice rows');
  return rows;
}

const rows = loadRows(inputPath)
  .map(mapRow)
  .filter((row) => row.wapro_id && row.name);

console.log(`Wczytano ${rows.length} kontrahentow z ${inputPath}`);

if (dryRun) {
  console.log(
    JSON.stringify(
      {
        dryRun: true,
        rows: rows.length,
        preview: rows.slice(0, 5).map((row) => ({
          wapro_id: row.wapro_id,
          name: row.name,
          nip: row.nip,
          city: row.city,
        })),
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

const supabase = createClient(url, key);
let upserted = 0;
for (let i = 0; i < rows.length; i += BATCH) {
  const chunk = rows.slice(i, i + BATCH);
  const { error } = await supabase.from('ops_customers').upsert(chunk, {
    onConflict: 'wapro_id',
  });
  if (error) throw error;
  upserted += chunk.length;
}

console.log(JSON.stringify({ upserted, source: inputPath }, null, 2));
