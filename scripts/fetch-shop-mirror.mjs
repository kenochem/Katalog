#!/usr/bin/env node
/**
 * Pobiera z publicznego API sklepu (kenochem.com) drzewo kategorii 1:1 oraz przypisanie produktów do kategorii.
 * Nic nie zapisuje w sklepie ani w bazie — tylko odświeża pliki w public/data:
 *
 *   - shop-category-tree.json   drzewo kategorii (to samo, co w sklepie)
 *   - shop-sku-categories.json  SKU → lista id kategorii sklepu (do porównania z katalogiem)
 *
 *   node scripts/fetch-shop-mirror.mjs
 *   WP_SHOP_URL=https://inny-adres node scripts/fetch-shop-mirror.mjs
 */
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SHOP = (process.env.WP_SHOP_URL || 'https://kenochem.com').replace(/\/$/, '');

async function getJson(url) {
  const res = await fetch(url, { headers: { 'user-agent': 'kenochem-catalog-mirror' } });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
}

async function fetchCategories() {
  const all = [];
  for (let page = 1; page < 50; page++) {
    const batch = await getJson(
      `${SHOP}/wp-json/wp/v2/product_cat?per_page=100&page=${page}&orderby=id&order=asc&_fields=id,name,slug,parent,count,menu_order`,
    );
    if (!batch.length) break;
    all.push(...batch);
    if (batch.length < 100) break;
  }
  return all;
}

function buildTree(terms) {
  const byId = new Map(
    terms.map((t) => [
      t.id,
      { id: t.id, name: String(t.name || '').trim(), slug: t.slug, parent: t.parent || 0, count: t.count || 0, order: t.menu_order || 0, children: [] },
    ]),
  );
  const roots = [];
  for (const n of byId.values()) {
    if (n.parent && byId.has(n.parent)) byId.get(n.parent).children.push(n);
    else if (!n.parent) roots.push(n);
  }
  // kolejność jak w sklepie (menu_order), a przy równych — alfabetycznie
  const sortRec = (nodes) => {
    nodes.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'pl'));
    for (const n of nodes) {
      delete n.order;
      sortRec(n.children);
    }
  };
  sortRec(roots);
  return roots;
}

async function fetchProductCategories() {
  const skus = {};
  let total = 0;
  for (let page = 1; page < 200; page++) {
    let batch;
    try {
      batch = await getJson(`${SHOP}/wp-json/wc/store/v1/products?per_page=100&page=${page}`);
    } catch (err) {
      console.warn('Strona', page, '—', err.message);
      break;
    }
    if (!batch.length) break;
    for (const p of batch) {
      total++;
      const sku = String(p.sku || '').trim().toUpperCase();
      if (!sku) continue;
      skus[sku] = (p.categories || []).map((c) => c.id);
    }
    if (batch.length < 100) break;
  }
  return { skus, total };
}

const terms = await fetchCategories();
const roots = buildTree(terms);
const { skus, total } = await fetchProductCategories();
const fetchedAt = new Date().toISOString();

writeFileSync(join(ROOT, 'public/data/shop-category-tree.json'), JSON.stringify({ fetchedAt, source: SHOP, roots }));
writeFileSync(join(ROOT, 'public/data/shop-sku-categories.json'), JSON.stringify({ fetchedAt, source: SHOP, skus }));
console.log(`Kategorie: ${terms.length} (działów: ${roots.length}). Produkty w sklepie: ${total}, z SKU: ${Object.keys(skus).length}.`);
