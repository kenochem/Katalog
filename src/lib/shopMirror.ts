import type { Product } from '../types';
import { getProductDisplayCategory } from './catalogCategory';
import { categoryKey, flattenCategories } from './categoryRegistry';
import { AUDIENCE_CATEGORY, getFullShopCategoryTree, isRetiredCategoryName, type ShopCategoryNode } from './shopCategoryTree';

/**
 * Lustro sklepu kenochem.com: drzewo kategorii (public/data/shop-category-tree.json) i przypisanie produktów
 * (public/data/shop-sku-categories.json) odświeżane skryptem scripts/fetch-shop-mirror.mjs.
 * Z tego liczymy: co zmienić w katalogu, żeby był 1:1 ze sklepem, i — po naszych poprawkach — co zmienić w sklepie.
 *
 * Kategorie wycofane z układu („Dla obiektów i branż” i „Zestawy…”) istnieją jeszcze w sklepie, ale katalog ich nie ma:
 * branża jest filtrem (atrybut „Branża”), a zestawy powstaną w sklepie na osobnej stronie.
 */
export interface ShopCat {
  id: number;
  name: string;
  slug: string;
  parent: number;
  /** „Dział › Podkategoria › Kategoria” — taki sam zapis jak w drzewie katalogu. */
  path: string;
  depth: number;
  isLeaf: boolean;
  /** Kategoria wycofana z układu (branże, „Zestawy…”) — w sklepie do usunięcia. */
  retired: boolean;
  /** Nazwa branży, gdy kategoria leży pod „Dla obiektów i branż”. */
  industry: string;
}

let index: Map<number, ShopCat> | null = null;

export function shopCategoryIndex(): Map<number, ShopCat> {
  if (index) return index;
  const map = new Map<number, ShopCat>();
  const walk = (nodes: ShopCategoryNode[], prefix: string, depth: number, retired: boolean, audience: boolean) => {
    for (const n of nodes) {
      const path = prefix ? `${prefix} › ${n.name}` : n.name;
      const isAudience = n.name.trim().toLowerCase() === AUDIENCE_CATEGORY;
      const r = retired || isRetiredCategoryName(n.name);
      map.set(n.id, {
        id: n.id,
        name: n.name,
        slug: n.slug,
        parent: n.parent,
        path,
        depth,
        isLeaf: n.children.length === 0,
        retired: r,
        industry: audience && !isAudience ? n.name : '',
      });
      walk(n.children, path, depth + 1, r, audience || isAudience);
    }
  };
  walk(getFullShopCategoryTree().roots, '', 0, false, false);
  index = map;
  return map;
}

export interface ShopSkuFile {
  fetchedAt: string;
  source: string;
  skus: Record<string, number[]>;
}

let skuPromise: Promise<ShopSkuFile> | null = null;

export function loadShopSkuMap(): Promise<ShopSkuFile> {
  if (!skuPromise) {
    skuPromise = fetch(`${import.meta.env.BASE_URL}data/shop-sku-categories.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`Nie udało się wczytać przypisań ze sklepu (${r.status})`);
        return r.json() as Promise<ShopSkuFile>;
      })
      .catch((err) => {
        skuPromise = null;
        throw err;
      });
  }
  return skuPromise;
}

/** Kategoria główna produktu w sklepie: najgłębsza, z pominięciem wycofanych grup („dla branż”, „Zestawy”). */
export function bestShopCategory(ids: number[]): ShopCat | null {
  const idx = shopCategoryIndex();
  const cands = ids
    .map((id) => idx.get(id))
    .filter((c): c is ShopCat => !!c && !c.retired)
    .sort((a, b) => b.depth - a.depth || Number(b.isLeaf) - Number(a.isLeaf));
  return cands[0] ?? null;
}

export interface MirrorItem {
  id: string;
  sku: string;
  name: string;
  /** Kategoria w katalogu (nazwa liścia i ścieżka). */
  catalog: string;
  catalogPath: string;
  /** Kategoria w sklepie. */
  shop: string;
  shopPath: string;
  shopCatId: number;
  /** Wszystkie kategorie produktu w sklepie (id) — zachowujemy je przy eksporcie. */
  shopIds: number[];
  /** Branże z wycofanych kategorii „Dla obiektów i branż” — trafiają do atrybutu „Branża”. */
  industries: string[];
}

export interface MirrorPlan {
  /** Produkty, których kategoria w katalogu różni się od sklepu. */
  changes: MirrorItem[];
  /** Produkty o zgodnej kategorii, które w sklepie siedzą jeszcze w wycofanych kategoriach (branże, zestawy) — do zdjęcia z nich. */
  cleanup: MirrorItem[];
  matched: number;
  /** Produkty katalogu bez odpowiednika w sklepie (po SKU). */
  notInShop: number;
  /** Produkty, które w sklepie są tylko w kategorii nadrzędnej (nie da się ich odbić — katalog przypisuje do najniższego poziomu). */
  parentOnly: number;
  /** SKU ze sklepu, których nie ma w katalogu. */
  shopOnly: number;
  /** Produkty katalogu, których nie ma w sklepie (lista). */
  onlyCatalog: { sku: string; name: string; category: string }[];
  /** Produkty ze sklepu, których nie ma w katalogu (SKU i kategorie w sklepie). */
  onlyShop: { sku: string; categories: string }[];
  shopSkuTotal: number;
}

function currentPath(p: Product, leaf: string, treePath: Map<string, string>): string {
  const meta = typeof p.meta?.shopCategoryPath === 'string' ? p.meta.shopCategoryPath : '';
  const last = meta.split(/[>›]/).pop()?.trim() ?? '';
  if (meta && categoryKey(last) === categoryKey(leaf)) return meta.replace(/\s*>\s*/g, ' › ');
  return treePath.get(categoryKey(leaf)) ?? leaf;
}

/** Porównuje kategorie produktów katalogu z przypisaniami w sklepie (po SKU). */
export function planMirror(products: Product[], file: ShopSkuFile): MirrorPlan {
  const treePath = new Map(flattenCategories().map((c) => [categoryKey(c.name), c.path]));
  const idx = shopCategoryIndex();
  const changes: MirrorItem[] = [];
  const cleanup: MirrorItem[] = [];
  const seen = new Set<string>();
  let matched = 0;
  let notInShop = 0;
  let parentOnly = 0;
  const onlyCatalog: MirrorPlan['onlyCatalog'] = [];
  for (const p of products) {
    const sku = (p.sku ?? '').trim().toUpperCase();
    if (!sku) continue;
    const ids = file.skus[sku];
    if (!ids) {
      if (!p.isGroup) {
        notInShop++;
        onlyCatalog.push({ sku, name: p.displayName || p.name, category: getProductDisplayCategory(p) });
      }
      continue;
    }
    seen.add(sku);
    const best = bestShopCategory(ids);
    if (!best) continue;
    matched++;
    if (!best.isLeaf) {
      parentOnly++;
      continue;
    }
    const cur = getProductDisplayCategory(p);
    const curPath = currentPath(p, cur, treePath);
    const cats = ids.map((id) => idx.get(id)).filter((c): c is ShopCat => !!c);
    const item: MirrorItem = {
      id: p.id,
      sku,
      name: p.displayName || p.name,
      catalog: cur,
      catalogPath: curPath,
      shop: best.name,
      shopPath: best.path,
      shopCatId: best.id,
      shopIds: ids,
      industries: [...new Set(cats.map((c) => c.industry).filter(Boolean))],
    };
    if (categoryKey(cur) !== categoryKey(best.name) || curPath !== best.path) changes.push(item);
    else if (cats.some((c) => c.retired)) cleanup.push(item);
  }
  const shopSkus = Object.keys(file.skus);
  const onlyShop = shopSkus
    .filter((s) => !seen.has(s))
    .map((s) => ({ sku: s, categories: file.skus[s].map((id) => idx.get(id)?.path).filter(Boolean).join(' | ') }));
  return { changes, cleanup, matched, notInShop, parentOnly, shopOnly: onlyShop.length, onlyCatalog, onlyShop, shopSkuTotal: shopSkus.length };
}

/** Zmiany drzewa względem sklepu: wycofane, dodane, usunięte i przeniesione kategorie. */
export interface StructureChange {
  kind: 'dodana' | 'usunięta' | 'przeniesiona';
  name: string;
  from: string;
  to: string;
}

export function structureChanges(): StructureChange[] {
  const eff = new Map(flattenCategories().map((c) => [categoryKey(c.name), c]));
  const shop = new Map([...shopCategoryIndex().values()].map((c) => [categoryKey(c.name), c]));
  const out: StructureChange[] = [];
  // kategorie sklepu, których katalog nie ma (wycofane lub przebudowane) — do usunięcia w sklepie
  for (const [k, c] of shop) if (!eff.has(k)) out.push({ kind: 'usunięta', name: c.name, from: c.path, to: '' });
  // kategorie katalogu, których sklep nie ma (nowe) albo które leżą gdzie indziej (przeniesione)
  for (const [k, c] of eff) {
    const sc = shop.get(k);
    if (!sc) out.push({ kind: 'dodana', name: c.name, from: '', to: c.path });
    else if (sc.path !== c.path) out.push({ kind: 'przeniesiona', name: c.name, from: sc.path, to: c.path });
  }
  return out;
}

const csv = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;

/** Zapis kategorii w formacie importu WooCommerce: hierarchia „A > B > C”, przecinek w nazwie poprzedzony ukośnikiem. */
const wooPath = (path: string) => path.split(' › ').map((s) => s.replace(/,/g, '\\,')).join(' > ');

/**
 * CSV do importu w WooCommerce (Produkty → Importuj → „Aktualizuj istniejące”): dla każdego produktu pełna lista
 * kategorii, w której kategoria główna ze sklepu jest zastąpiona kategorią z katalogu, pozostałe zwykłe kategorie zostają,
 * a wycofane („dla branż”, „Zestawy”) są zdejmowane.
 */
export function wooCategoriesCsv(items: MirrorItem[]): string {
  const idx = shopCategoryIndex();
  const chain = (c: ShopCat | undefined): string[] => {
    const out: string[] = [];
    for (let x = c; x; x = x.parent ? idx.get(x.parent) : undefined) out.unshift(x.path);
    return out;
  };
  const lines = [['SKU', 'Categories'].map(csv).join(',')];
  for (const it of items) {
    // produkt bez kategorii w katalogu nie ma co zaktualizować w sklepie
    if (it.catalog === 'Do decyzji') continue;
    const drop = new Set(chain(idx.get(it.shopCatId)));
    const keep = it.shopIds
      .map((id) => idx.get(id))
      .filter((c): c is ShopCat => !!c && !c.retired)
      .map((c) => c.path)
      .filter((p) => !drop.has(p));
    const target = it.catalogPath.split(' › ').map((_, i, arr) => arr.slice(0, i + 1).join(' › '));
    const all = [...new Set([...keep, ...target])];
    lines.push([it.sku, all.map(wooPath).join(', ')].map(csv).join(','));
  }
  return '﻿' + lines.join('\r\n');
}

/** CSV z atrybutem „Branża” (SKU + wartość) do importu w sklepie jako filtr. */
export function industriesCsv(items: MirrorItem[]): string {
  const lines = [['SKU', 'Branża'].map(csv).join(',')];
  for (const it of items) if (it.industries.length) lines.push([it.sku, it.industries.join(', ')].map(csv).join(','));
  return '﻿' + lines.join('\r\n');
}

/** Przekierowania 301 dla usuwanych kategorii: stara kategoria (slug) → nowa strona (dział, grupa nadrzędna, a dla branż „Chemia obiektowa”). */
export function redirectsCsv(): string {
  const idx = shopCategoryIndex();
  const eff = new Set(flattenCategories().map((c) => categoryKey(c.name)));
  const lines = [['Stara kategoria', 'Slug', 'Przekieruj na'].map(csv).join(';')];
  for (const c of idx.values()) {
    if (!c.retired && eff.has(categoryKey(c.name))) continue;
    const parts = c.path.split(' › ');
    const root = parts[0];
    let target = root;
    if (c.industry || c.name.trim().toLowerCase() === AUDIENCE_CATEGORY) target = `${root} › Chemia obiektowa`;
    else if (!c.retired && parts.length > 2) target = parts.slice(0, 2).join(' › ');
    lines.push([c.path, c.slug, target].map(csv).join(';'));
  }
  return '﻿' + lines.join('\r\n');
}

export function onlyCatalogCsv(items: MirrorPlan['onlyCatalog']): string {
  const lines = [['SKU', 'Nazwa', 'Kategoria w katalogu'].map(csv).join(';')];
  for (const it of items) lines.push([it.sku, it.name, it.category].map(csv).join(';'));
  return '\uFEFF' + lines.join('\r\n');
}

export function onlyShopCsv(items: MirrorPlan['onlyShop']): string {
  const lines = [['SKU', 'Kategorie w sklepie'].map(csv).join(';')];
  for (const it of items) lines.push([it.sku, it.categories].map(csv).join(';'));
  return '\uFEFF' + lines.join('\r\n');
}

export function differencesCsv(items: MirrorItem[]): string {
  const lines = [['SKU', 'Nazwa', 'Kategoria w katalogu', 'Sciezka w katalogu', 'Kategoria w sklepie', 'Sciezka w sklepie'].map(csv).join(';')];
  for (const it of items) lines.push([it.sku, it.name, it.catalog, it.catalogPath, it.shop, it.shopPath].map(csv).join(';'));
  return '﻿' + lines.join('\r\n');
}

export function structureCsv(changes: StructureChange[]): string {
  const lines = [['Zmiana', 'Kategoria', 'Bylo (sciezka w sklepie)', 'Ma byc (sciezka w katalogu)'].map(csv).join(';')];
  for (const c of changes) lines.push([c.kind, c.name, c.from, c.to].map(csv).join(';'));
  return '﻿' + lines.join('\r\n');
}
