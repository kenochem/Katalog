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
const OUT_REPORT = join(ROOT, 'data/shop-category-assignment-preview.json');
const BACKUP_DIR = join(ROOT, 'data/category-assignment-backups');
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

function indexTree(tree) {
  const byId = new Map();
  const leaves = [];
  function walk(node, parentPath = []) {
    const pathParts = [...parentPath, node.name].filter(Boolean);
    const path = pathParts.join(' › ');
    const info = {
      id: node.id,
      name: node.name,
      slug: node.slug,
      parent: node.parent,
      count: node.count,
      path,
      depth: pathParts.length,
      isLeaf: !node.children?.length,
    };
    byId.set(node.id, info);
    if (info.isLeaf) leaves.push(info);
    for (const child of node.children || []) walk(child, pathParts);
  }
  for (const root of tree.roots || []) walk(root);
  return { byId, leaves };
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
  return parts[parts.length - 1];
}

function bestCategoryFromProductCategories(cats, categoryIndex) {
  const isAudiencePath = (path) => {
    const p = String(path || '').toLocaleLowerCase('pl');
    return p.includes('dla obiektów i branż') || p.includes('zestawy');
  };
  const candidates = (cats || [])
    .map((cat) => categoryIndex.byId.get(Number(cat.id)))
    .filter(Boolean)
    .sort((a, b) => {
      const audienceDelta = Number(isAudiencePath(a.path)) - Number(isAudiencePath(b.path));
      if (audienceDelta !== 0) return audienceDelta;
      return b.depth - a.depth || Number(b.isLeaf) - Number(a.isLeaf);
    });
  const best = candidates[0];
  if (!best) return null;
  return {
    path: best.path,
    category: catalogCategoryFromPath(best.path),
    wpId: best.id,
  };
}

async function fetchStoreSkuCategories(categoryIndex) {
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
      const best = bestCategoryFromProductCategories(p.categories, categoryIndex);
      if (best) skuToPaths.set(sku, best);
    }
    if (batch.length < 100) break;
  }
  return skuToPaths;
}

async function fetchWcV3SkuCategories(categoryIndex) {
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
      const best = bestCategoryFromProductCategories(p.categories, categoryIndex);
      if (best) skuToPaths.set(sku, best);
    }
    if (batch.length < 100) break;
  }
  return skuToPaths;
}

function normalizeText(value) {
  return String(value || '')
    .toLocaleLowerCase('pl')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/ł/g, 'l')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findLeaf(leaves, label) {
  const wanted = normalizeText(label);
  return leaves.find((leaf) => normalizeText(leaf.name) === wanted) || null;
}

function categoryRuleSet(leaves) {
  const mk = (label, re, confidence = 85, reason = label, unless) => ({
    leaf: findLeaf(leaves, label),
    label,
    re,
    confidence,
    reason,
    unless,
  });
  return [
    mk('Płyny do spryskiwaczy', /\b(spryskiwacz|spryskiwaczy)\b/, 95),
    mk('Odmrażacze do szyb', /\b(odmraz|odmraż)\w*.*\b(szyb|zamek|zamkow)\b|\b(odmrazacz|odmrażacz)\b/, 95),
    mk('Antypara', /\banty\s*para|anti\s*fog|przeciw parowaniu\b/, 95),
    mk('Niewidzialne wycieraczki', /\bniewidzialn\w*\s+wycieraczk\w*|\brain\s*repellent\b/, 95),
    mk('Płyny do szyb samochodowych', /\b(plyn|plyny|płyn|płyny).*\b(szyb|szkla|szklo|szkła|szkło)\b/, 86),
    mk('Aktywne piany do myjni', /\b(piana|piany|foam)\b.*\b(myjni|myjnia|bezdotyk|sb\s*box|portalow|tunelow)\b|\bproszek do myjni\b/, 94),
    mk('Aktywne piany', /\b(piana aktywna|active foam|snow foam|yeti)\b/, 90),
    mk('Szampony do myjni', /\bszampon\w*.*\b(myjni|myjnia|bezdotyk|portalow|tunelow)\b/, 92),
    mk('Szampony samochodowe', /\bszampon\w*\b/, 84),
    mk('Woski osuszające i hydrowoski', /\b(hydrowosk|wosk osusz|osuszajac|osuszający)\b/, 94),
    mk('Woski samochodowe', /\b(wosk|wax)\b/, 82, 'wosk samochodowy', /\bquick detailer|qd\b/),
    mk('Quick detailery', /\bquick detailer|\bqd\b|ceramic qd\b/, 94),
    mk('Pasty polerskie', /\b(pasta polerska|compound|polish|polersk)\b/, 90),
    mk('Pady i futra polerskie', /\b(pad|futro|gabka polerska|gąbka polerska|roller cut|roller polish|roller soft)\b/, 92),
    mk('Felgi i opony', /\b(felg|opon)\b/, 80),
    mk('Płyny do felg', /\b(felg|krwawa felga|deiron|deironizer|vampire)\b/, 88),
    mk('Dressingi i czernidła do opon', /\b(czernidl|dressing).*\b(opon|gumy)\b|\bblack\s*(gum|tire|tyre)\b/, 94),
    mk('Usuwanie owadów', /\b(owad|insekt|insect)\b/, 92),
    mk('Usuwanie smoły, asfaltu, kleju i żywicy', /\b(smol|smoł|asfalt|klej|zywic|żywic|tar)\b/, 92),
    mk('Kokpit i plastiki', /\b(kokpit|interior qd|plastik\w* wewn|dashboard)\b/, 90),
    mk('Tapicerka materiałowa', /\b(tapicerk|podsufitk|bonnet|textile|alcantara)\b/, 90),
    mk('Skóra samochodowa', /\b(skor|skór|leather)\b/, 90),
    mk('Klimatyzacja samochodowa', /\b(klimatyzac|air\s*con|clima)\b/, 88),
    mk('Zapachy i neutralizatory do samochodu', /\b(zapach|odswiez|odśwież|neutralizator|perfum)\b.*\b(auto|samoch|car)\b/, 88),
    mk('Perfumy samochodowe', /\b(perfum).*\b(auto|samoch|car)\b/, 92),
    mk('Puszki zapachowe', /\b(puszka|can)\b.*\b(zapach|odswiez|odśwież)\b/, 90),
    mk('Zapachy do klimatyzacji', /\b(zapach|odswiez|odśwież).*\bklimatyzac\b/, 92),
    mk('Zawieszki zapachowe', /\b(zawieszk|choink|listek)\b/, 88),
    mk('Olejki do dyfuzorów', /\b(olejek|olejki).*\b(dyfuzor|aroma)\b/, 94),
    mk('Dyfuzory zapachowe', /\bdyfuzor\b/, 92),
    mk('Patyczki zapachowe', /\bpatyczk\w*\s+zapach/, 92),
    mk('Świece zapachowe', /\bswiec|świec/, 92),
    mk('Odświeżacze powietrza', /\b(odswiezacz|odświeżacz|air fresh|one shot)\b/, 82),
    mk('Neutralizatory zapachów', /\bneutralizator\w*\s+zapach/, 90),
    mk('Dysze do myjek', /\b(dysza|dysze|dyszy|dyszka)\b/, 94),
    mk('Lance i pistolety', /\b(lanca|lance|pistolet|pistolety)\b/, 90, 'lanca lub pistolet', /\bpiorac|piorą/),
    mk('Pistolety piorące', /\bpistolet\w*.*\b(piorac|piorą|tapicerk)\b/, 95),
    mk('Szybkozłącza i adaptery', /\b(szybkozlacz|szybkozłącz|adapter|przejsciow|przejściów|redukcj|nypl|nypel|zlacz|złącz)\b/, 92),
    mk('Węże i bębny', /\b(waz|wąż|weze|węże|beb(e|ę)n|beben|zwijacz)\b/, 90),
    mk('Filtry, redukcje i zawory', /\b(filtr|zawor|zawór|by\s*pass|manometr|redukcja)\b/, 88),
    mk('Pianownice do myjek', /\bpianownic\w*.*\b(myjk|karcher|karcher|m22|quick)\b/, 92),
    mk('Pianownice ręczne', /\bpianownic\w*.*\b(reczna|ręczna|reczne|ręczne)\b/, 92),
    mk('Opryskiwacze pianujące', /\bopryskiwacz\w*.*\bpian\w*\b/, 92),
    mk('Opryskiwacze ciśnieniowe uniwersalne', /\bopryskiwacz|spryskiwacz cisnieniowy|ciśnieniowy\b/, 84),
    mk('Tornadory', /\btornador\b/, 95),
    mk('Akcesoria do odkurzaczy', /\b(ssawka|rura odkurz|waz odkurz|wąż odkurz|akcesori\w* odkurz)\b/, 92),
    mk('Odkurzacze', /\bodkurzacz\b/, 78),
    mk('Szczotki do mycia samochodu', /\bszczotk\w*.*\b(auto|samoch|felg|karoser|mycia)\b/, 88),
    mk('Szczotki Vikan', /\bvikan\b.*\bszczotk|\bszczotk\w*.*\bvikan\b/, 94),
    mk('Szczotki do podłóg', /\bszczotk\w*.*\b(podlog|podłog|posadzk)\b/, 90),
    mk('Miotły przemysłowe', /\bmiot(la|ła|ly|ły)\b/, 86),
    mk('Zmiotki i szufelki', /\b(zmiotk|szufelk)\b/, 90),
    mk('Mikrofibry uniwersalne', /\b(mikrofibr|scierecz|ścierecz|scierk|ścierk)\b/, 84, 'mikrofibra lub ściereczka', /\b(okien|szyb|osusz|recznik|ręcznik)\b/),
    mk('Ręczniki do osuszania', /\b(recznik|ręcznik).*\b(osusz|drying)\b/, 92),
    mk('Gąbki i rękawice', /\b(gabka|gąbka|gabki|gąbki|rekawic|rękawic)\b/, 88, 'gąbka lub rękawica', /\bpolersk\b/),
    mk('Kije i drążki teleskopowe', /\b(kij|drazek|drążek|trzonek|teleskop)\b/, 88),
    mk('Mopy i stelaże', /\b(mop|stela[zż])\b/, 88),
    mk('Wiadra i wyciskarki', /\b(wiadro|wiadra|wyciskark)\b/, 90),
    mk('Worki na odpady', /\b(worki|worek).*\b(smiec|śmieć|odpady)\b/, 90),
    mk('Butelki i opakowania', /\b(butelka|atomizer|spryskiwacz pusty|opakowanie|kanister)\b/, 86),
    mk('Dozowniki', /\bdozownik\b/, 84),
    mk('Ściągaczki do szyb', /\bsciagacz\w*\b.*\b(szyb|okien)\b|\b(szyb|okien)\b.*\bsciagacz\w*\b/, 88),
    mk('Ściągaczki do podłogi', /\bsciagacz\w*\b.*\b(podlog|wody|posadzk)\b|\b(podlog|wody|posadzk)\b.*\bsciagacz\w*\b/, 86),
    mk('Skrobaczki do szyb', /\bskrobaczk\w*\b/, 92),
    mk('Łazienki i sanitariaty', /\b(lazienk|łazienk|sanitariat|wc|toalet|kamien|kamień|osad wapienny)\b/, 86),
    mk('Podłogi i posadzki', /\b(podlog|podłog|posadzk|floor)\b/, 86),
    mk('Mycie powierzchni', /\b(powierzchni|uniwersalny|apc|all purpose)\b/, 74),
    mk('Chemia do zmywarek', /\bzmywark/, 88),
    mk('Ręczne mycie naczyń', /\bnaczyn|dish/, 86),
    mk('Czyszczenie pieców, grilli i frytkownic', /\b(piec|grill|frytkownic)\b/, 90),
    mk('Odtłuszczanie kuchni', /\b(kuchni|gastronom|tluszcz|tłuszcz)\b/, 84),
    mk('Odkamienianie urządzeń', /\bodkamieniacz|kamien kotlowy|kamień kotłowy/, 86),
    mk('Mydła i żele do rąk', /\b(mydlo|mydło|zel do rak|żel do rąk)\b/, 90),
    mk('Pasty BHP', /\bpasta bhp|bhp\b/, 90),
    mk('Kremy do rąk', /\bkrem\w*.*\brak|rąk\b/, 90),
    mk('Dezynfekcja powierzchni', /\bdezynfek|sanitiz|virucid|bakterioboj\b/, 86),
    mk('Płyny i żele do prania', /\b(pranie|prania|zel do prania|żel do prania)\b/, 84),
    mk('Odplamiacze do tkanin', /\bodplamiacz|plam\b/, 88),
    mk('Płyny do myjek ultradźwiękowych', /\bultradzwiek|ultradźwięk/, 92),
    mk('Czyszczenie DPF/FAP', /\bdpf|fap\b/, 94),
    mk('Zmywacze do hamulców', /\bhamulc|brake cleaner\b/, 92),
    mk('Odtłuszczacze przemysłowe', /\bodtluszcz|odtłuszcz|degreaser\b/, 84),
    mk('Smary techniczne', /\bsmar\b/, 84),
    mk('Kostka brukowa i kamień', /\b(kostka bruk|bruk|kamien elew|kamień elew)\b/, 88),
    mk('Elewacje', /\belewac/, 88),
    mk('Dachy', /\bdach\b/, 88),
    mk('Mycie paneli fotowoltaicznych', /\b(fotowolta|solar|paneli solarn)\b/, 90),
  ].filter((rule) => rule.leaf);
}

const WEAK_CATEGORY_RE = /^(|inne|produkty|produkt|chemia|auto|myjki|odswiezacze|odświeżacze|akcesoria sklepowe|bez kategorii|producenci\/|[a-z0-9 ._-]{2,20})$/i;

function isWeakCategory(category, leaves) {
  const c = String(category || '').trim();
  if (!c) return true;
  if (WEAK_CATEGORY_RE.test(c)) return true;
  const normalized = normalizeText(c);
  return !leaves.some((leaf) => normalizeText(leaf.name) === normalized);
}

function guessCategory(product, leaves) {
  const text = normalizeText(
    `${product.displayName || ''} ${product.name || ''} ${product.manufacturer || ''} ${product.sku || ''} ${product.category || ''}`,
  );
  const rules = categoryRuleSet(leaves);
  for (const rule of rules) {
    if (rule.unless?.test(text)) continue;
    if (rule.re.test(text)) {
      return {
        category: rule.leaf.name,
        path: rule.leaf.path,
        wpId: rule.leaf.id,
        confidence: rule.confidence,
        reason: rule.reason,
      };
    }
  }

  const manufacturer = normalizeText(product.manufacturer || '');
  if (/^(york|vikan|cleanpro|merida)$/.test(manufacturer)) {
    const leaf = findLeaf(leaves, 'Mikrofibry uniwersalne');
    if (leaf && /\b(mikrofibr|scierecz|scierk|ścierecz|ścierk)\b/.test(text)) {
      return {
        category: leaf.name,
        path: leaf.path,
        wpId: leaf.id,
        confidence: 70,
        reason: 'producent akcesoriów + tekst produktu',
      };
    }
  }

  return null;
}

async function fetchAllSupabaseProducts(supabase) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const to = from + 999;
    const { data, error } = await supabase
      .from('products')
      .select('id,sku,category,catalog,display_name,name,manufacturer,product_meta')
      .eq('catalog', 'shop')
      .range(from, to);
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

function backupFileName() {
  return join(BACKUP_DIR, `products-categories-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
}

function writeCategoryBackup(products, updates) {
  if (!updates.length) return null;
  const ids = new Set(updates.map((u) => u.id));
  const rows = products
    .filter((row) => ids.has(row.id))
    .map((row) => ({
      id: row.id,
      sku: row.sku,
      name: row.display_name || row.name,
      category: row.category,
      product_meta: row.product_meta,
    }));
  mkdirSync(BACKUP_DIR, { recursive: true });
  const path = backupFileName();
  writeFileSync(
    path,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        count: rows.length,
        rows,
      },
      null,
      2,
    ),
    'utf8',
  );
  return path;
}

function summarizeBy(items, keyFn) {
  const counts = new Map();
  for (const item of items) {
    const key = keyFn(item) || 'Brak';
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'pl'));
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const apply = args.has('--apply') || args.has('--apply-shop') || args.has('--apply-heuristic') || args.has('--apply-all');
  const applyShop = apply && (args.has('--apply') || args.has('--apply-shop') || args.has('--apply-all'));
  const applyHeuristic = apply && (args.has('--apply-heuristic') || args.has('--apply-all') || args.has('--include-heuristic'));
  console.log('Pobieram kategorie WP…');
  const terms = await fetchAllProductCats();
  const tree = buildTree(terms);
  const categoryIndex = indexTree(tree);
  const leaves = categoryIndex.leaves;
  mkdirSync(dirname(OUT_TREE), { recursive: true });
  writeFileSync(OUT_TREE, JSON.stringify(tree, null, 2), 'utf8');
  console.log(`Zapisano drzewo: ${OUT_TREE} (${terms.length} termów, ${leaves.length} liści)`);

  let skuMap = await fetchWcV3SkuCategories(categoryIndex);
  if (skuMap.size === 0) {
    console.log('WC v3 niedostępne — mapowanie ze Store API (SKU z kategoriami)…');
    skuMap = await fetchStoreSkuCategories(categoryIndex);
  }
  console.log(`Mapa SKU ze sklepu: ${skuMap.size} pozycji`);

  const mapOut = Object.fromEntries([...skuMap.entries()]);
  writeFileSync(OUT_MAP, JSON.stringify(mapOut, null, 2), 'utf8');

  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.log(apply ? 'Brak Supabase w .env' : 'Dry-run tylko mapy (brak Supabase w .env). Mapa:', OUT_MAP);
    return;
  }

  const supabase = createClient(url, key);
  const products = await fetchAllSupabaseProducts(supabase);

  let fromShop = 0;
  let guessed = 0;
  let skippedGood = 0;
  let skippedWeakNoMatch = 0;
  const updates = [];
  const preview = [];
  for (const row of products || []) {
    const sku = String(row.sku || '').trim().toUpperCase();
    const mapped = mapOut[sku];
    let decision = null;
    if (mapped?.category) {
      decision = {
        category: mapped.category,
        path: mapped.path,
        wpId: mapped.wpId,
        confidence: 100,
        source: 'shop-sku',
        reason: 'dokładne SKU z kenochem.098.pl',
      };
      fromShop++;
    } else {
      if (!isWeakCategory(row.category, leaves)) {
        skippedGood++;
        continue;
      }
      const guessedDecision = guessCategory(
        {
          sku,
          name: row.name,
          displayName: row.display_name,
          manufacturer: row.manufacturer,
          category: row.category,
        },
        leaves,
      );
      if (!guessedDecision || guessedDecision.confidence < 70) {
        skippedWeakNoMatch++;
        continue;
      }
      decision = {
        ...guessedDecision,
        source: 'heuristic',
      };
      guessed++;
    }

    const category = decision.category;
    const prevMeta =
      row.product_meta && typeof row.product_meta === 'object' && !Array.isArray(row.product_meta)
        ? { ...row.product_meta }
        : {};
    const assignedAt = new Date().toISOString();
    const nextMeta = {
      ...prevMeta,
      shopCategoryPath: decision.path,
      shopCategoryWpId: decision.wpId,
      categoryAssignedBy: decision.source,
      categoryAssignedAt: assignedAt,
      categoryAssignmentConfidence: decision.confidence,
      categoryAssignmentReason: decision.reason,
    };
    const categoryChanged = category && category !== row.category;
    const metaChanged =
      prevMeta.shopCategoryPath !== nextMeta.shopCategoryPath ||
      prevMeta.categoryAssignedBy !== nextMeta.categoryAssignedBy ||
      prevMeta.categoryAssignmentConfidence !== nextMeta.categoryAssignmentConfidence;
    if (categoryChanged || metaChanged) {
      updates.push({
        id: row.id,
        sku,
        category: categoryChanged ? category : row.category,
        old: row.category,
        meta: nextMeta,
        categoryChanged,
        source: decision.source,
      });
      preview.push({
        id: row.id,
        sku,
        name: row.display_name || row.name,
        oldCategory: row.category,
        newCategory: category,
        path: decision.path,
        source: decision.source,
        confidence: decision.confidence,
        reason: decision.reason,
      });
    }
  }

  mkdirSync(dirname(OUT_REPORT), { recursive: true });
  writeFileSync(
    OUT_REPORT,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        products: products.length,
        updates: updates.length,
        fromShop,
        guessed,
        skippedGood,
        skippedWeakNoMatch,
        bySource: summarizeBy(preview, (item) => item.source),
        byCategory: summarizeBy(preview, (item) => item.newCategory).slice(0, 80),
        sample: preview.slice(0, 200),
        items: preview,
      },
      null,
      2,
    ),
    'utf8',
  );

  console.log(
    `Produkty shop: ${products.length}. Do aktualizacji: ${updates.length} (ze sklepu: ${fromShop}, heurystyka: ${guessed}, pominięte dobre: ${skippedGood}, słabe bez dopasowania: ${skippedWeakNoMatch})`,
  );
  console.log(`Preview: ${OUT_REPORT}`);
  for (const u of updates.slice(0, 10)) {
    console.log(
      `  ${u.sku}: ${u.old} → ${u.category}${u.meta?.shopCategoryPath ? ` (${u.meta.shopCategoryPath})` : ''}`,
    );
  }

  if (!apply) {
    console.log('Dry-run (bez --apply).');
    return;
  }

  const selectedUpdates = updates.filter((u) =>
    u.source === 'shop-sku' ? applyShop : applyHeuristic,
  );
  if (!selectedUpdates.length) {
    console.log('Supabase: brak zmian dla wybranego trybu zapisu.');
    return;
  }

  const backupPath = writeCategoryBackup(products, selectedUpdates);
  if (backupPath) {
    console.log(`Backup obecnych kategorii: ${backupPath}`);
  }

  let applied = 0;
  for (const u of selectedUpdates) {
    const patch = {};
    if (u.categoryChanged) patch.category = u.category;
    if (u.meta) patch.product_meta = u.meta;
    const { error: upErr } = await supabase.from('products').update(patch).eq('id', u.id);
    if (upErr) throw upErr;
    applied++;
  }
  console.log(
    `Supabase: zaktualizowano kategorie shop (${applied}; shop=${selectedUpdates.filter((u) => u.source === 'shop-sku').length}, heurystyka=${selectedUpdates.filter((u) => u.source === 'heuristic').length}).`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
