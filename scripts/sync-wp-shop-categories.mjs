#!/usr/bin/env node
/**
 * Pobiera drzewo kategorii sklepu (public REST) i mapę SKU→kategoria z WC Store API.
 * Opcjonalnie WC v3 z WP_SHOP_USER + WP_SHOP_APP_PASSWORD w .env (Application Password).
 *
 *   node scripts/sync-wp-shop-categories.mjs
 *   node scripts/sync-wp-shop-categories.mjs --apply
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT_TREE = join(ROOT, 'public/data/shop-category-tree.json');
const OUT_MAP = join(ROOT, 'data/shop-sku-category-map.json');
const SHOP_URL = (process.env.WP_SHOP_URL || 'https://kenochem.098.pl').replace(/\/$/, '');

function loadDotenv() {
  const path = join(ROOT, '.env');
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m || process.env[m[1]] != null) continue;
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
  }
}

loadDotenv();

async function fetchJson(url, opts = {}) {
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
}

async function fetchAllProductCats() {
  const all = [];
  for (let page = 1; page <= 50; page++) {
    const batch = await fetchJson(
      `${SHOP_URL}/wp-json/wp/v2/product_cat?per_page=100&page=${page}&orderby=id&order=asc`,
    );
    if (!Array.isArray(batch) || !batch.length) break;
    all.push(...batch);
    if (batch.length < 100) break;
  }
  return all;
}

function buildTree(terms) {
  const byId = new Map();
  for (const t of terms) {
    byId.set(t.id, {
      id: t.id,
      name: (t.name || '').trim(),
      slug: t.slug,
      parent: t.parent || 0,
      count: t.count || 0,
      children: [],
    });
  }
  const roots = [];
  for (const node of byId.values()) {
    if (node.parent && byId.has(node.parent)) {
      byId.get(node.parent).children.push(node);
    } else if (!node.parent) {
      roots.push(node);
    }
  }
  const sortRec = (nodes) => {
    nodes.sort((a, b) => a.name.localeCompare(b.name, 'pl'));
    for (const n of nodes) sortRec(n.children);
  };
  sortRec(roots);
  return { fetchedAt: new Date().toISOString(), roots };
}

function flattenLeaves(tree, prefix = '') {
  const out = [];
  for (const node of tree) {
    const path = prefix ? `${prefix} › ${node.name}` : node.name;
    if (node.children?.length) {
      out.push(...flattenLeaves(node.children, path));
    } else {
      out.push({ path, label: node.name, wpId: node.id, count: node.count });
    }
  }
  return out;
}

/** Ścieżka katalogu = ostatni sensowny segment (bez „Zestawy …” jeśli puste). */
function catalogCategoryFromPath(path) {
  const parts = path.split(' › ').map((s) => s.trim()).filter(Boolean);
  if (!parts.length) return 'Inne';
  const leaf = parts[parts.length - 1];
  if (/^zestawy\b/i.test(leaf) && parts.length > 1) {
    return parts[parts.length - 2];
  }
  return leaf;
}

async function fetchStoreSkuCategories() {
  const skuToPaths = new Map();
  for (let page = 1; page <= 200; page++) {
    let batch;
    try {
      batch = await fetchJson(
        `${SHOP_URL}/wp-json/wc/store/products?per_page=100&page=${page}`,
      );
    } catch {
      break;
    }
    if (!Array.isArray(batch) || !batch.length) break;
    for (const p of batch) {
      const sku = String(p.sku || '').trim().toUpperCase();
      if (!sku) continue;
      const cats = p.categories || [];
      if (!cats.length) continue;
      const names = cats.map((c) => c.name).filter(Boolean);
      if (names.length) skuToPaths.set(sku, names.join(' › '));
    }
    if (batch.length < 100) break;
  }
  return skuToPaths;
}

async function fetchWcV3SkuCategories() {
  const user = process.env.WP_SHOP_USER;
  const pass = process.env.WP_SHOP_APP_PASSWORD || process.env.WP_SHOP_PASSWORD;
  if (!user || !pass) return new Map();

  const auth = Buffer.from(`${user}:${pass}`).toString('base64');
  const skuToPaths = new Map();
  for (let page = 1; page <= 300; page++) {
    let batch;
    try {
      batch = await fetchJson(
        `${SHOP_URL}/wp-json/wc/v3/products?per_page=100&page=${page}&status=publish`,
        { headers: { Authorization: `Basic ${auth}` } },
      );
    } catch (e) {
      console.warn('WC v3:', e.message);
      break;
    }
    if (!Array.isArray(batch) || !batch.length) break;
    for (const p of batch) {
      const sku = String(p.sku || '').trim().toUpperCase();
      if (!sku) continue;
      const names = (p.categories || []).map((c) => c.name).filter(Boolean);
      if (names.length) skuToPaths.set(sku, names.join(' › '));
    }
    if (batch.length < 100) break;
  }
  return skuToPaths;
}

function guessCategory(product, leaves) {
  const text = `${product.displayName || product.name} ${product.sku}`.toLowerCase();
  const rules = [
    { re: /odświe|odswie|zapach|aroma|perfum/, cat: 'Odświeżacze i neutralizatory' },
    { re: /szampon|wosk|auto|samochod|felg|tapicer/, cat: 'Abel Auto' },
    { re: /dom|podłog|kuchnia|gastronom|higiena/, cat: 'Chemia do domu' },
    { re: /myjk|ciśnieniow|dysz|lanc|pistolet/, cat: 'Inne części' },
    { re: /chem|płyn|plyn|koncentrat|kenolon/, cat: 'Chemia' },
  ];
  for (const r of rules) {
    if (r.re.test(text)) {
      const hit = leaves.find((l) => l.label === r.cat || l.path.includes(r.cat));
      if (hit) return catalogCategoryFromPath(hit.path);
      return r.cat;
    }
  }
  return 'Inne';
}

async function main() {
  const apply = process.argv.includes('--apply');
  console.log('Pobieram kategorie WP…');
  const terms = await fetchAllProductCats();
  const tree = buildTree(terms);
  const leaves = flattenLeaves(tree.roots);
  mkdirSync(dirname(OUT_TREE), { recursive: true });
  writeFileSync(OUT_TREE, JSON.stringify(tree, null, 2), 'utf8');
  console.log(`Zapisano drzewo: ${OUT_TREE} (${terms.length} termów, ${leaves.length} liści)`);

  let skuMap = await fetchWcV3SkuCategories();
  if (skuMap.size === 0) {
    console.log('WC v3 niedostępne — mapowanie ze Store API (SKU z kategoriami)…');
    skuMap = await fetchStoreSkuCategories();
  }
  console.log(`Mapa SKU ze sklepu: ${skuMap.size} pozycji`);

  const mapOut = Object.fromEntries(
    [...skuMap.entries()].map(([sku, path]) => [sku, { path, category: catalogCategoryFromPath(path) }]),
  );
  writeFileSync(OUT_MAP, JSON.stringify(mapOut, null, 2), 'utf8');

  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!apply || !url || !key) {
    console.log(apply ? 'Brak Supabase w .env' : 'Dry-run (bez --apply). Mapa:', OUT_MAP);
    return;
  }

  const supabase = createClient(url, key);
  const { data: products, error } = await supabase
    .from('products')
    .select('id,sku,category,catalog,display_name,name,product_meta')
    .eq('catalog', 'shop');
  if (error) throw error;

  let fromShop = 0;
  let guessed = 0;
  const updates = [];
  for (const row of products || []) {
    const sku = String(row.sku || '').trim().toUpperCase();
    const mapped = mapOut[sku];
    let category;
    let shopPath;
    if (mapped?.category) {
      category = mapped.category;
      shopPath = mapped.path;
      fromShop++;
    } else {
      category = guessCategory(
        { sku, name: row.name, displayName: row.display_name },
        leaves,
      );
      shopPath = undefined;
      guessed++;
    }
    const prevMeta =
      row.product_meta && typeof row.product_meta === 'object' && !Array.isArray(row.product_meta)
        ? { ...row.product_meta }
        : {};
    const nextMeta =
      shopPath && prevMeta.shopCategoryPath !== shopPath
        ? { ...prevMeta, shopCategoryPath: shopPath }
        : null;
    const categoryChanged = category && category !== row.category;
    if (categoryChanged || nextMeta) {
      updates.push({
        id: row.id,
        sku,
        category: categoryChanged ? category : row.category,
        old: row.category,
        meta: nextMeta ? nextMeta : undefined,
        categoryChanged,
      });
    }
  }

  console.log(`Do aktualizacji: ${updates.length} (ze sklepu: ${fromShop}, heurystyka: ${guessed})`);
  for (const u of updates.slice(0, 10)) {
    console.log(`  ${u.sku}: ${u.old} → ${u.category}${u.meta?.shopCategoryPath ? ` (${u.meta.shopCategoryPath})` : ''}`);
  }

  for (const u of updates) {
    const patch = {};
    if (u.categoryChanged) patch.category = u.category;
    if (u.meta) patch.product_meta = u.meta;
    const { error: upErr } = await supabase.from('products').update(patch).eq('id', u.id);
    if (upErr) throw upErr;
  }
  console.log('Supabase: zaktualizowano kategorie shop.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
