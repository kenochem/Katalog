import { createClient } from '@supabase/supabase-js';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

const DEFAULT_DOWNLOADS = 'D:/Users/Biuro/Downloads';
const PREVIEW_PATH = resolve('data/baselinker-description-import-preview.json');
const MIN_FULL_DESCRIPTION_CHARS = 450;
const MIN_SHORT_DESCRIPTION_CHARS = 120;
const APPLY = process.argv.includes('--apply');
const OVERWRITE = process.argv.includes('--overwrite-descriptions');

function argValue(name) {
  const pref = `${name}=`;
  const hit = process.argv.find((arg) => arg.startsWith(pref));
  if (hit) return hit.slice(pref.length);
  const idx = process.argv.indexOf(name);
  return idx >= 0 ? process.argv[idx + 1] : undefined;
}

function parseCsvLine(line, delimiter = ';') {
  const out = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (ch === delimiter && !quoted) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

function parseCsv(text) {
  const clean = text.replace(/^\uFEFF/, '');
  const rows = [];
  let record = '';
  let quoted = false;
  for (let i = 0; i < clean.length; i += 1) {
    const ch = clean[i];
    if (ch === '"') {
      if (quoted && clean[i + 1] === '"') {
        record += ch + clean[i + 1];
        i += 1;
        continue;
      }
      quoted = !quoted;
    }
    if ((ch === '\n' || ch === '\r') && !quoted) {
      if (record.trim()) rows.push(parseCsvLine(record.replace(/\r$/, '')));
      record = '';
      if (ch === '\r' && clean[i + 1] === '\n') i += 1;
      continue;
    }
    record += ch;
  }
  if (record.trim()) rows.push(parseCsvLine(record));
  if (rows.length < 2) return [];
  const header = rows[0].map((h) => h.trim());
  return rows.slice(1).map((cols) => {
    const row = {};
    for (let i = 0; i < header.length; i += 1) row[header[i]] = (cols[i] || '').trim();
    return row;
  });
}

function stripHtml(html) {
  return String(html || '')
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\s*\/p\s*>/gi, '\n')
    .replace(/<\s*li[^>]*>/gi, '\n- ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function normalizeSku(value) {
  const s = String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const m = s.match(/^([A-Z]+)0*([0-9]+)$/);
  return m ? `${m[1]}${Number(m[2])}` : s;
}

function qualityScore(text) {
  const plain = stripHtml(text);
  const words = plain.split(/\s+/).filter((w) => w.length >= 2).length;
  return { chars: plain.length, words };
}

function bestDescription(row) {
  const candidates = ['opis_dodatkowy_1', 'opis', 'opis_dodatkowy_2', 'opis_dodatkowy_3', 'opis_dodatkowy_4']
    .map((key) => ({ key, html: row[key] || '', ...qualityScore(row[key] || '') }))
    .filter((d) => d.chars >= 80 && d.words >= 12)
    .sort((a, b) => b.chars - a.chars || b.words - a.words);
  return candidates[0] || null;
}

function bestShortDescription(row, fullPlain) {
  const direct = ['opis_dodatkowy_2', 'opis_dodatkowy_3', 'opis_dodatkowy_4', 'opis']
    .map((key) => stripHtml(row[key] || ''))
    .find((txt) => txt.length >= 40 && txt.length <= 500);
  if (direct) return direct.slice(0, 500);
  const firstSentence = fullPlain.match(/^.{80,500}?[.!?](\s|$)/s)?.[0]?.trim();
  if (firstSentence && firstSentence.length >= 80) return firstSentence.slice(0, 500);
  return fullPlain.slice(0, 260).trim();
}

function rowToDescription(row) {
  const sku = String(row.produkt_sku || '').trim().toUpperCase();
  const productId = String(row.produkt_id || '').trim();
  const desc = bestDescription(row);
  if (!desc || !sku) return null;
  const fullPlain = stripHtml(desc.html);
  return {
    sku,
    skuNorm: normalizeSku(sku),
    baselinkerProductId: productId,
    name: String(row.produkt_nazwa || '').trim(),
    descriptionHtml: desc.html.trim() || fullPlain,
    descriptionPlain: fullPlain,
    descriptionChars: fullPlain.length,
    descriptionWords: fullPlain.split(/\s+/).filter(Boolean).length,
    shortDescription: bestShortDescription(row, fullPlain),
  };
}

function findLatestCsv() {
  if (!existsSync(DEFAULT_DOWNLOADS)) return null;
  const files = readdirSync(DEFAULT_DOWNLOADS)
    .filter((name) => /^Base__Produkty__.*\.csv$/i.test(name))
    .map((name) => join(DEFAULT_DOWNLOADS, name))
    .sort((a, b) => basename(b).localeCompare(basename(a)));
  return files[0] || null;
}

async function fetchAllProducts(supabase) {
  const all = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await supabase
      .from('products')
      .select('id,sku,display_name,description,product_meta,catalog')
      .order('sku')
      .range(from, from + page - 1);
    if (error) throw error;
    if (!data?.length) break;
    all.push(...data);
    if (data.length < page) break;
  }
  return all;
}

function pickByProduct(row, bySku, byNormSku, byBlId) {
  const sku = String(row.sku || '').trim().toUpperCase();
  const meta = row.product_meta && typeof row.product_meta === 'object' ? row.product_meta : {};
  const blId = String(meta.baselinkerProductId || '').trim();
  return byBlId.get(blId) || bySku.get(sku) || byNormSku.get(normalizeSku(sku)) || null;
}

function buildPatch(product, desc) {
  const meta = product.product_meta && typeof product.product_meta === 'object' ? product.product_meta : {};
  const existingPlain = stripHtml(product.description || '');
  const existingChars = existingPlain.length;
  const newIsFull =
    desc.descriptionChars >= MIN_FULL_DESCRIPTION_CHARS && desc.descriptionWords >= 45;
  const existingIsFull = existingChars >= MIN_FULL_DESCRIPTION_CHARS;
  const shouldSetDescription =
    desc.descriptionChars >= 80 &&
    (OVERWRITE ||
      !existingPlain ||
      !existingIsFull ||
      desc.descriptionChars >= existingChars + 120);

  const nextMeta = {
    ...meta,
    ...(desc.baselinkerProductId ? { baselinkerProductId: desc.baselinkerProductId } : {}),
    ...(desc.shortDescription.length >= MIN_SHORT_DESCRIPTION_CHARS || !meta.shortDescription
      ? { shortDescription: desc.shortDescription }
      : {}),
    baselinkerDescriptionImportedAt: new Date().toISOString(),
    baselinkerDescriptionChars: desc.descriptionChars,
    baselinkerDescriptionFull: newIsFull,
  };

  const patch = {};
  if (shouldSetDescription) patch.description = desc.descriptionHtml;
  if (JSON.stringify(nextMeta) !== JSON.stringify(meta)) patch.product_meta = nextMeta;
  return Object.keys(patch).length ? patch : null;
}

const csvPath = resolve(argValue('--csv') || findLatestCsv() || '');
if (!csvPath || !existsSync(csvPath)) {
  console.error('Podaj --csv sciezka_do_Base__Produkty__.csv albo umiesc plik w Downloads.');
  process.exit(1);
}

const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Brak SUPABASE_URL/VITE_SUPABASE_URL lub SUPABASE_SERVICE_ROLE_KEY w .env');
  process.exit(1);
}

const rows = parseCsv(readFileSync(csvPath, 'utf8'));
const descriptions = rows.map(rowToDescription).filter(Boolean);
const bySku = new Map();
const byNormSku = new Map();
const byBlId = new Map();
for (const desc of descriptions) {
  const prev = bySku.get(desc.sku);
  if (!prev || desc.descriptionChars > prev.descriptionChars) bySku.set(desc.sku, desc);
  const prevNorm = byNormSku.get(desc.skuNorm);
  if (!prevNorm || desc.descriptionChars > prevNorm.descriptionChars) byNormSku.set(desc.skuNorm, desc);
  if (desc.baselinkerProductId) byBlId.set(desc.baselinkerProductId, desc);
}

console.log(`CSV: ${basename(csvPath)} rows=${rows.length}, descriptions=${descriptions.length}`);

const supabase = createClient(url, key);
const products = await fetchAllProducts(supabase);
console.log(`Supabase products=${products.length}`);

const plan = [];
for (const product of products) {
  const desc = pickByProduct(product, bySku, byNormSku, byBlId);
  if (!desc) continue;
  const patch = buildPatch(product, desc);
  if (!patch) continue;
  plan.push({
    id: product.id,
    sku: product.sku,
    catalog: product.catalog,
    name: product.display_name,
    chars: desc.descriptionChars,
    fields: Object.keys(patch).sort(),
    patch,
  });
}

mkdirSync('data', { recursive: true });
writeFileSync(
  PREVIEW_PATH,
  JSON.stringify(
    plan.map(({ patch, ...item }) => item),
    null,
    2,
  ),
  'utf8',
);

const full = plan.filter((item) => item.chars >= MIN_FULL_DESCRIPTION_CHARS).length;
console.log(`Plan: ${plan.length} aktualizacji, pelne opisy>=${MIN_FULL_DESCRIPTION_CHARS}: ${full}`);
console.log(`Preview: ${PREVIEW_PATH}`);
for (const item of plan.slice(0, 12)) {
  console.log(`  ${item.sku}: ${item.chars} znakow -> ${item.fields.join(', ')}`);
}

if (!APPLY) {
  console.log('Dry-run. Dodaj --apply, zeby zapisac do Supabase.');
  process.exit(0);
}

let updated = 0;
for (const item of plan) {
  const { error } = await supabase.from('products').update(item.patch).eq('id', item.id);
  if (error) throw new Error(`${item.sku}: ${error.message}`);
  updated += 1;
  if (updated % 100 === 0) console.log(`Updated ${updated}/${plan.length}`);
}
console.log(`Gotowe. Zaktualizowano ${updated} produktow.`);
