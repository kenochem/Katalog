#!/usr/bin/env node
/**
 * Ukrywa w katalogu stare marki, których nie ma na stanie.
 *
 *   node scripts/hide-discontinued-shop-products.mjs
 *   node scripts/hide-discontinued-shop-products.mjs --apply
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const REPORT = join(ROOT, 'data/discontinued-hidden-products-preview.json');
const BACKUP_DIR = join(ROOT, 'data/hidden-product-backups');

function loadDotenv() {
  const path = join(ROOT, '.env');
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m || process.env[m[1]] != null) continue;
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
  }
}

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pl')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function startsWithWord(text, word) {
  const n = normalize(text);
  const w = normalize(word);
  return n === w || n.startsWith(`${w} `);
}

function discontinuedBrand(row) {
  const fields = [row.manufacturer, row.display_name, row.name];
  if (fields.some((v) => startsWithWord(v, 'detail'))) return 'DETAIL';
  if (fields.some((v) => startsWithWord(v, 'cleantle'))) return 'CLEANTLE';
  if (fields.some((v) => startsWithWord(v, 'clean tech') || startsWithWord(v, 'cleantech'))) {
    return 'CLEAN TECH';
  }
  return null;
}

async function fetchProducts(supabase) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const to = from + 999;
    const { data, error } = await supabase
      .from('products')
      .select('id,sku,display_name,name,manufacturer,stock,catalog,product_meta')
      .eq('catalog', 'shop')
      .range(from, to)
      .order('sku');
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

function summarize(items) {
  const byBrand = new Map();
  for (const item of items) byBrand.set(item.brand, (byBrand.get(item.brand) || 0) + 1);
  return [...byBrand.entries()]
    .map(([brand, count]) => ({ brand, count }))
    .sort((a, b) => b.count - a.count || a.brand.localeCompare(b.brand, 'pl'));
}

function backupPath() {
  return join(BACKUP_DIR, `hidden-products-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
}

async function main() {
  loadDotenv();
  const apply = process.argv.includes('--apply');
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Brak SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY w .env');

  const supabase = createClient(url, key);
  const products = await fetchProducts(supabase);
  const now = new Date().toISOString();
  const selected = products
    .map((row) => ({ row, brand: discontinuedBrand(row) }))
    .filter(({ row, brand }) => {
      if (!brand) return false;
      if ((row.stock ?? 0) > 0) return false;
      return row.product_meta?.catalogHidden !== true;
    })
    .map(({ row, brand }) => ({
      id: row.id,
      sku: row.sku,
      name: row.display_name || row.name,
      manufacturer: row.manufacturer,
      stock: row.stock ?? 0,
      brand,
      oldMeta: row.product_meta || {},
      nextMeta: {
        ...(row.product_meta || {}),
        catalogHidden: true,
        catalogHiddenAt: now,
        catalogHiddenReason: `${brand}: stara marka / brak stanu, nie pokazuj domyślnie w katalogu`,
      },
    }));

  mkdirSync(dirname(REPORT), { recursive: true });
  writeFileSync(
    REPORT,
    JSON.stringify(
      {
        generatedAt: now,
        apply,
        checked: products.length,
        toHide: selected.length,
        byBrand: summarize(selected),
        items: selected.map(({ oldMeta, nextMeta, ...item }) => item),
      },
      null,
      2,
    ),
    'utf8',
  );
  console.log(`Produkty shop: ${products.length}. Do ukrycia: ${selected.length}. Raport: ${REPORT}`);
  for (const item of selected.slice(0, 12)) {
    console.log(`  ${item.sku}: ${item.brand}, stan=${item.stock}, ${item.name}`);
  }

  if (!apply) {
    console.log('Dry-run (bez --apply).');
    return;
  }

  if (!selected.length) {
    console.log('Brak produktów do ukrycia.');
    return;
  }

  mkdirSync(BACKUP_DIR, { recursive: true });
  const backup = backupPath();
  writeFileSync(
    backup,
    JSON.stringify(
      {
        generatedAt: now,
        count: selected.length,
        rows: selected.map((item) => ({
          id: item.id,
          sku: item.sku,
          name: item.name,
          manufacturer: item.manufacturer,
          stock: item.stock,
          product_meta: item.oldMeta,
        })),
      },
      null,
      2,
    ),
    'utf8',
  );
  console.log(`Backup: ${backup}`);

  let applied = 0;
  for (const item of selected) {
    const { error } = await supabase
      .from('products')
      .update({ product_meta: item.nextMeta })
      .eq('id', item.id);
    if (error) throw error;
    applied++;
  }
  console.log(`Ukryto produktów: ${applied}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
