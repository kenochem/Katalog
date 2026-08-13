/**
 * Mapuje eksport BaseLinker (XML/CSV z katalogu „zestawy”) na Kit[] katalogu Kenochem.
 *
 * Base nie eksportuje powiązań SKU składników — skład wyprowadzamy z atrybutu
 * „Zapachy w zestawie” / opisu i dopasowujemy do produktów w shop-products.json (+ akcesoria).
 *
 * Użycie:
 *   node scripts/import-baselinker-kits.mjs "d:/path/export.xml"
 *   node scripts/import-baselinker-kits.mjs "d:/path/Zestawy__....csv"
 *   node scripts/import-baselinker-kits.mjs "d:/path/export.xml" --apply
 *
 * --apply  — upsert do Supabase (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY w .env)
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { dirname, join, basename } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const SCENT_ALIASES = {
  kashmir: ['kashmir', 'kaszmir'],
  kaszmir: ['kaszmir', 'kashmir'],
  paczula: ['paczula', 'paczuli', 'paczuli'],
  paczuli: ['paczula', 'paczuli'],
  'zielona herbata': ['zielona herbata', 'herbata'],
  herbata: ['zielona herbata', 'herbata'],
  rumianek: ['rumianek', 'slodki rumianek', 'słodki rumianek'],
  'slodki rumianek': ['rumianek', 'slodki rumianek', 'słodki rumianek'],
  'smoke killer': ['smoke killer', 'smoke'],
  smoke: ['smoke killer', 'smoke'],
  joy: ['joy'],
  wanilia: ['wanilia'],
  bawelna: ['bawelna', 'bawełna', 'bawelna'],
  bawełna: ['bawelna', 'bawełna'],
  bergamo: ['bergamo'],
  good: ['good'],
  'bad man': ['bad man', 'badman'],
  jarzebina: ['jarzebina', 'jarzębina', 'kwitnacy sad', 'kwitnący sad'],
  jarzębina: ['jarzebina', 'jarzębina', 'kwitnacy sad', 'kwitnący sad'],
  'kwitnacy sad': ['kwitnacy sad', 'kwitnący sad', 'jarzebina'],
  cytryna: ['cytryna', 'cytryn'],
  laguna: ['blekitna laguna', 'błękitna laguna', 'laguna'],
  dyfuzor: ['dyfuzor', 'dozownik'],
  dozownik: ['dyfuzor', 'dozownik'],
};

function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/&amp;/g, '&')
    .replace(/[^a-z0-9\s/|,-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripHtml(html) {
  return String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 800);
}

function parseXmlProducts(xml) {
  const chunks = xml.split('<product>').slice(1);
  return chunks.map((chunk) => {
    const get = (tag) => {
      const m = chunk.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
      return m ? m[1].trim() : '';
    };
    const attributes = [];
    const attrRe =
      /<attribute>\s*<attribute_name>([^<]*)<\/attribute_name>\s*<attribute_value>([\s\S]*?)<\/attribute_value>\s*<\/attribute>/g;
    let am;
    while ((am = attrRe.exec(chunk))) {
      attributes.push({ name: am[1].trim(), value: am[2].trim() });
    }
    return {
      productId: get('product_id'),
      name: get('name').replace(/&amp;/g, '&'),
      category: get('category_name'),
      manufacturer: get('manufacturer_name'),
      image: get('image'),
      description: get('description'),
      descriptionExtra1: get('description_extra_1'),
      attributes,
    };
  });
}

function isKitRow(p) {
  return /zestaw/i.test(p.name) || /zestaw/i.test(p.category);
}

function extractVolumeMl(name, attrs) {
  const n = name.toLowerCase();
  let m = n.match(/(\d+)\s*x\s*(\d+)\s*ml/i);
  if (m) return Number(m[2]);
  m = n.match(/\b(\d+)\s*x\s*(\d+)ml/i);
  if (m) return Number(m[2]);
  m = n.match(/(\d+)\s*ml/i);
  if (m) return Number(m[1]);
  const cap = attrs.find((a) => /pojemn/i.test(normalize(a.name)));
  if (cap) {
    m = cap.value.match(/(\d+)/);
    if (m) return Number(m[1]);
  }
  return null;
}

function extractSetCount(name, attrs) {
  const n = name.toLowerCase();
  let m = n.match(/(\d+)\s*x\s*\d+/i) || n.match(/(\d+)x/i);
  if (m) return Number(m[1]);
  const qtyAttr = attrs.find((a) => /ilo[sś][ćc]\s*w\s*zestawie/i.test(normalize(a.name)));
  if (qtyAttr) {
    m = qtyAttr.value.match(/(\d+)/);
    if (m) return Number(m[1]);
  }
  return null;
}

function decodeHtmlEntities(s) {
  return String(s || '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function isValidScentLabel(s) {
  const n = normalize(s);
  if (n.length < 3 || n.length > 55) return false;
  if (/^\d+$/.test(n)) return false;
  if (/^(lt|gt|nbsp|span|font|sans|serif|style|data|start|end|quot|rgb|px|strong|div|h\d|li|ul|ol|em|br|u)$/.test(n)) {
    return false;
  }
  if (/[<>]/.test(s)) return false;
  if (/font-family|font-size|display:\s*block/.test(s)) return false;
  return true;
}

function extractScentsFromDescription(html) {
  const decoded = decodeHtmlEntities(html);
  const listItems = [...decoded.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
    .map((m) => stripHtml(m[1]))
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter(isValidScentLabel);
  if (listItems.length >= 2) return listItems;

  const plain = stripHtml(decoded);
  const block = plain.match(/w zestawie zapachy?\s*:?\s*([\s\S]{10,400})/i);
  if (block) {
    const part = block[1].split(/\.\s/)[0];
    const fromComma = splitScents(part).filter(isValidScentLabel);
    if (fromComma.length >= 2) return fromComma;
  }
  return [];
}

function extractScentsFromTitle(name) {
  const n = decodeHtmlEntities(name);
  const pipe = n.match(/\|\s*([^|]+)$/);
  if (pipe) {
    return splitScents(pipe[1]).filter(isValidScentLabel);
  }

  const dyf = n.match(/dozownik\s*\+\s*([^|]+)/i);
  if (dyf) {
    const part = dyf[1].split(/\||\+/).join(',');
    const scents = splitScents(part).filter(isValidScentLabel);
    if (scents.length) return ['dyfuzor', ...scents];
  }

  const singleScent = n.match(
    /Zestaw\s+(?:nr\s+\d+\s+)?([A-Za-ząćęłńóśźż][A-Za-ząćęłńóśźż\s]{2,40}?)\s+Freshtek\s+ONE\s*Shot\s+6\s*[xX]/i,
  );
  if (singleScent) {
    const label = singleScent[1].trim();
    if (!/^nr\s*\d+$/i.test(label) && isValidScentLabel(label)) {
      return [label];
    }
  }

  const nrOnly = n.match(/Zestaw\s+nr\s+(\d+)\s+Freshtek/i);
  if (nrOnly) {
    return [`__freshtek_set_nr_${nrOnly[1]}__`];
  }

  return [];
}

const FRESHTEK_SET_BY_NR = {
  1: ['Wanilia', 'Kashmir', 'Paczula', 'Zielona Herbata', 'Rumianek', 'Smoke Killer'],
  9: [
    'Zielona Herbata',
    'Wanilia',
    'Kashmir',
    'Paczula',
    'Rumianek',
    'Smoke Killer',
  ],
  10: ['Bawełna', 'Kashmir', 'Paczula', 'Zielona Herbata', 'Rumianek', 'Smoke Killer'],
};

function resolveSetPlaceholder(token) {
  const m = token.match(/^__freshtek_set_nr_(\d+)__$/);
  if (!m) return [token];
  return FRESHTEK_SET_BY_NR[m[1]] || [];
}

function splitScents(raw) {
  if (!raw) return [];
  return raw
    .split(/[,;|/]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1);
}

function flattenScents(list) {
  const out = [];
  for (const s of list) {
    if (s.startsWith('__freshtek_set_nr_')) {
      out.push(...resolveSetPlaceholder(s));
    } else {
      out.push(s);
    }
  }
  return out.filter(isValidScentLabel);
}

function extractScents(p) {
  const attr = p.attributes.find((a) => {
    const n = normalize(a.name);
    return n.includes('zapach') && n.includes('zestaw');
  });
  if (attr) return flattenScents(splitScents(attr.value));

  const fromTitle = extractScentsFromTitle(p.name);
  if (fromTitle.length) return flattenScents(fromTitle);

  const fromDesc = extractScentsFromDescription(p.description);
  if (fromDesc.length) return fromDesc;

  const extra = p.descriptionExtra1 || '';
  const m = extra.match(/zestaw[^:]*:\s*(.+)$/i);
  if (m) return flattenScents(splitScents(m[1]));

  const decoded = decodeHtmlEntities(p.description);
  const plain = stripHtml(decoded);
  const m2 = plain.match(/zapachy?\s*:?\s*([^.!\n]+)/i);
  if (m2) return flattenScents(splitScents(m2[1]));

  return [];
}

function scentTokens(scent) {
  const base = normalize(scent);
  const aliases = SCENT_ALIASES[base] || [base];
  const tokens = new Set();
  for (const a of aliases) {
    for (const t of a.split(/\s+/)) {
      if (t.length > 2) tokens.add(t);
    }
  }
  return [...tokens];
}

function buildProductIndex(products) {
  return products.map((p) => ({
    product: p,
    normName: normalize(p.displayName || p.name),
    normSku: normalize(p.sku),
  }));
}

function scoreProduct(indexRow, scent, volumeMl, kitNameNorm) {
  const { product, normName } = indexRow;
  const tokens = scentTokens(scent);
  if (!tokens.length) return 0;

  let score = 0;
  for (const t of tokens) {
    if (normName.includes(t)) score += 10;
  }

  if (volumeMl != null) {
    if (normName.includes(String(volumeMl))) score += 8;
    else if (normName.includes('one shot') || normName.includes('oneshot')) score -= 6;
  }

  if (/one shot|oneshot|freshtek/i.test(kitNameNorm)) {
    if (!/one shot|oneshot|freshtek/i.test(normName)) score -= 4;
    else score += 3;
  }

  if (/dyfuzor|dozownik/i.test(scent) || /dyfuzor|dozownik/i.test(kitNameNorm)) {
    if (/dyfuzor|dozownik/i.test(normName)) score += 15;
  }

  if (/mikrofibra|microfibra/i.test(kitNameNorm)) {
    if (/mikrofibra|microfibra/i.test(normName)) score += 12;
    if (/pomarancz|orange/i.test(kitNameNorm) && /pomarancz|orange/i.test(normName)) {
      score += 8;
    }
  }

  return score;
}

function findBestProduct(index, scent, volumeMl, kitNameNorm, usedIds) {
  let best = null;
  let bestScore = 0;
  for (const row of index) {
    if (usedIds.has(row.product.id)) continue;
    const s = scoreProduct(row, scent, volumeMl, kitNameNorm);
    if (s > bestScore) {
      bestScore = s;
      best = row.product;
    }
  }
  if (bestScore < 10) return null;
  return best;
}

function findMicrofiberSet(index, kitName, setCount) {
  const kitNorm = normalize(kitName);
  const qty = setCount || 6;
  let best = null;
  let bestScore = 0;
  for (const row of index) {
    const n = row.normName;
    if (!/mikrofibra|microfibra/.test(n)) continue;
    let s = 12;
    if (/pomarancz|orange/.test(kitNorm) && /pomarancz|orange/.test(n)) s += 10;
    if (/szara|gray|grey/.test(kitNorm) && /szar/.test(n)) s += 10;
    if (s > bestScore) {
      bestScore = s;
      best = row.product;
    }
  }
  if (!best) return null;
  return { product: best, quantity: qty };
}

function mapKit(baseProduct, index) {
  const kitNameNorm = normalize(baseProduct.name);
  const volumeMl = extractVolumeMl(baseProduct.name, baseProduct.attributes);
  const setCount = extractSetCount(baseProduct.name, baseProduct.attributes);
  let scents = extractScents(baseProduct);

  const items = [];
  const unmatched = [];
  const usedIds = new Set();

  if (/mikrofibra|microfibra/i.test(baseProduct.name) && scents.length === 0) {
    const mf = findMicrofiberSet(index, baseProduct.name, setCount);
    if (mf) {
      items.push({
        productId: mf.product.id,
        sku: mf.product.sku,
        name: mf.product.displayName || mf.product.name,
        quantity: mf.quantity,
      });
    } else {
      unmatched.push('mikrofibra (brak dopasowania SKU)');
    }
  } else {
    if (scents.length === 0 && setCount) {
      scents = Array(setCount).fill('?');
    }
    const perItemQty =
      scents.length === 1 && setCount && setCount > 1
        ? setCount
        : scents.length && setCount && setCount % scents.length === 0
          ? setCount / scents.length
          : 1;

    for (const scent of scents) {
      if (scent === '?') {
        unmatched.push('nie rozpoznano składników');
        continue;
      }
      const product = findBestProduct(index, scent, volumeMl, kitNameNorm, usedIds);
      if (!product) {
        unmatched.push(scent);
        continue;
      }
      usedIds.add(product.id);
      items.push({
        productId: product.id,
        sku: product.sku,
        name: product.displayName || product.name,
        quantity: perItemQty,
      });
    }
  }

  const id = `bl-${baseProduct.productId}`;
  const description =
    stripHtml(baseProduct.description) ||
    baseProduct.descriptionExtra1 ||
    `Import BaseLinker · ID ${baseProduct.productId}`;

  return {
    kit: {
      id,
      name: baseProduct.name,
      description,
      category: baseProduct.category || 'Zestawy',
      items,
      imageUrl: baseProduct.image || undefined,
      createdAt: Date.now(),
      meta: {
        baselinkerProductId: baseProduct.productId,
        manufacturer: baseProduct.manufacturer,
        volumeMl,
        setCount,
        scents,
      },
    },
    unmatched,
    status:
      items.length === 0
        ? 'failed'
        : unmatched.length
          ? 'partial'
          : 'ok',
  };
}

function xmlTag(block, tag) {
  const m = block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'i'));
  return m ? m[1].trim().replace(/&amp;/g, '&') : '';
}

function loadDotenv() {
  const envPath = join(ROOT, '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m || process.env[m[1]] != null) continue;
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
  }
}

function isZestawIdLine(line) {
  return /^20\d{7,}$/.test(line);
}

function isBlNumericProductId(line) {
  return /^(15|20)\d{7,}$/.test(line);
}

function looksLikeSkuLine(line) {
  if (!line || isImageUrlLine(line) || isLikelyEan(line)) return false;
  if (isBlNumericProductId(line)) return false;
  if (/^brak danych$/i.test(line)) return false;
  if (!/\d/.test(line)) return false;
  return /^[A-Za-z][A-Za-z0-9._-]{2,}$/.test(line);
}

function readComponentTriplet(lines, startIdx) {
  let i = startIdx;
  while (i < lines.length && !lines[i]) i++;
  if (i >= lines.length) return null;

  if (isBlNumericProductId(lines[i])) {
    const blProdId = lines[i++];
    while (i < lines.length && !lines[i]) i++;
    if (i >= lines.length || !looksLikeSkuLine(lines[i])) return null;
    const sku = lines[i++];
    while (i < lines.length && !lines[i]) i++;
    if (i < lines.length && isLikelyEan(lines[i])) i++;
    return { endIdx: i, item: { productId: blProdId, sku, qty: 1 } };
  }

  if (looksLikeSkuLine(lines[i])) {
    const sku = lines[i++];
    while (i < lines.length && !lines[i]) i++;
    if (i < lines.length && isLikelyEan(lines[i])) i++;
    return { endIdx: i, item: { productId: '', sku, qty: 1 } };
  }

  return null;
}

function peekNextNonEmpty(lines, fromIdx) {
  let j = fromIdx;
  while (j < lines.length && !lines[j]) j++;
  return j < lines.length ? lines[j] : null;
}

function isLikelyEan(line) {
  return /^\d{8,14}$/.test(line);
}

function peekPrevNonEmpty(lines, fromIdx) {
  let j = fromIdx;
  while (j >= 0 && !lines[j]) j--;
  return j >= 0 ? lines[j] : null;
}

function isZestawHeaderLine(lines, idx) {
  if (!isZestawIdLine(lines[idx])) return false;
  const prev = peekPrevNonEmpty(lines, idx - 1);
  if (!prev) return true;
  if (isLikelyEan(prev) || looksLikeSkuLine(prev)) return true;
  if (isImageUrlLine(prev) || isBlNumericProductId(prev)) return false;
  if (/^brak danych$/i.test(prev)) return false;
  const prevPrev = peekPrevNonEmpty(lines, idx - 2);
  if (!prev && prevPrev && (isLikelyEan(prevPrev) || looksLikeSkuLine(prevPrev))) return true;
  if (prevPrev && isLikelyEan(prevPrev) && /^brak danych$/i.test(prev)) return true;
  return !isImageUrlLine(prev);
}

/** Eksport Base „Zestawy” (CSV blokowy: ID zestawu → kategoria → zdjęcie → triplety BL id / SKU / EAN). */
function parseBaselinkerZestawyCsv(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const headerIdx = [];
  for (let i = 0; i < lines.length; i++) {
    if (isZestawHeaderLine(lines, i)) headerIdx.push(i);
  }

  const bundles = [];
  for (let h = 0; h < headerIdx.length; h++) {
    const start = headerIdx[h];
    const end = h + 1 < headerIdx.length ? headerIdx[h + 1] : lines.length;
    const zestawId = lines[start];
    let category = '';
    let image = '';
    const rawItems = [];

    for (let i = start + 1; i < end; i++) {
      if (!lines[i]) continue;

      const triplet = readComponentTriplet(lines, i);
      if (triplet) {
        rawItems.push(triplet.item);
        i = triplet.endIdx - 1;
        continue;
      }

      if (isImageUrlLine(lines[i])) {
        image = lines[i];
        continue;
      }

      if (/^brak danych$/i.test(lines[i])) continue;

      if (!category && lines[i] && !isZestawIdLine(lines[i])) {
        category = lines[i];
      }
    }

    bundles.push({
      zestawId,
      category,
      image,
      items: aggregateItemsBySku(rawItems),
    });
  }
  return bundles;
}

function deriveKitNameFromImageUrl(url) {
  const m = String(url || '').match(/pol_pl_([^/?#]+?)\.(webp|jpe?g|png)/i);
  if (!m) return null;
  return m[1]
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findCompanionBaselinkerXml(nearPath) {
  try {
    const dir = dirname(nearPath);
    const files = readdirSync(dir)
      .filter((f) => /^Base__Produkty.*\.xml$/i.test(f))
      .sort()
      .reverse();
    return files[0] ? join(dir, files[0]) : null;
  } catch {
    return null;
  }
}

function buildBlProductNameMap(xmlPath) {
  const map = new Map();
  if (!xmlPath || !existsSync(xmlPath)) return map;
  for (const p of parseXmlProducts(readFileSync(xmlPath, 'utf8'))) {
    if (p.productId) map.set(String(p.productId), p.name.replace(/&amp;/g, '&'));
  }
  return map;
}

function aggregateItemsBySku(rawItems) {
  const bySku = new Map();
  for (const it of rawItems) {
    const key = normalize(it.sku);
    const prev = bySku.get(key);
    if (prev) prev.qty += it.qty;
    else bySku.set(key, { ...it });
  }
  return [...bySku.values()];
}

function isImageUrlLine(line) {
  return /^https?:\/\//i.test(line);
}

function mapKitFromBundle(bundle, catalogIndex) {
  const items = [];
  const unmatched = [];
  for (const line of bundle.items) {
    const skuNorm = normalize(line.sku);
    const skuUpper = String(line.sku || '').trim().toUpperCase();
    let product =
      catalogIndex.find((r) => normalize(r.product.sku) === skuNorm)?.product ||
      catalogIndex.find((r) => String(r.product.sku || '').toUpperCase() === skuUpper)?.product ||
      catalogIndex.find((r) => r.product.id === `shop-${skuUpper}`)?.product ||
      catalogIndex.find((r) => r.product.id === line.productId)?.product;
    if (!product && line.productId) {
      product = catalogIndex.find((r) => r.product.id === String(line.productId))?.product;
    }
    if (!product) {
      unmatched.push(line.sku || line.productId || '?');
      continue;
    }
    items.push({
      productId: product.id,
      sku: product.sku,
      name: product.displayName || product.name,
      quantity: line.qty,
    });
  }
  return {
    kit: {
      id: `bl-zestaw-${bundle.zestawId}`,
      name: bundle.name,
      description: `Import BaseLinker · zestaw ${bundle.zestawId}`,
      category: bundle.category || 'Zestawy Base',
      items,
      imageUrl: bundle.image || undefined,
      createdAt: Date.now(),
    },
    unmatched,
    status: items.length === 0 ? 'failed' : unmatched.length ? 'partial' : 'ok',
  };
}

/** Eksport własny Base: ROOT [ZESTAW], w ZESTAW m.in. [PRODUKT]. */
function parseBaselinkerBundleExport(xml, catalogIndex) {
  const blocks = [...xml.matchAll(/<zestaw\b[^>]*>([\s\S]*?)<\/zestaw>/gi)];
  if (!blocks.length) return null;
  return blocks.map((m) => {
    const block = m[1];
    const zestawId = xmlTag(block, 'zestaw_id') || xmlTag(block, 'id') || 'unknown';
    const name =
      xmlTag(block, 'zestaw_nazwa') ||
      xmlTag(block, 'nazwa') ||
      (xmlTag(block, 'zestaw_sku') ? `Zestaw ${xmlTag(block, 'zestaw_sku')}` : '') ||
      `Zestaw ${zestawId}`;
    const productParts = [...block.matchAll(/<produkt\b[^>]*>([\s\S]*?)<\/produkt>/gi)];
    const items = productParts.map((pm) => {
      const pb = pm[1];
      const qtyRaw =
        xmlTag(pb, 'sztuki_erp') ||
        xmlTag(pb, 'ilosc') ||
        xmlTag(pb, 'quantity') ||
        '1';
      return {
        productId: xmlTag(pb, 'produkt_id'),
        sku: xmlTag(pb, 'produkt_sku') || xmlTag(pb, 'sku'),
        qty: Math.max(1, parseInt(String(qtyRaw).replace(/[^\d]/g, ''), 10) || 1),
      };
    });
    return mapKitFromBundle(
      {
        zestawId,
        name,
        category: xmlTag(block, 'zestaw_kategoria_nazwa'),
        image: xmlTag(block, 'zestaw_zdjecie_1'),
        items,
      },
      catalogIndex,
    );
  });
}

function dedupeByName(mapped) {
  const seen = new Map();
  const out = [];
  for (const row of mapped) {
    const key = normalize(row.kit.name);
    if (seen.has(key)) {
      row.status = 'duplicate';
      row.duplicateOf = seen.get(key);
      continue;
    }
    seen.set(key, row.kit.id);
    out.push(row);
  }
  return { kept: out, skipped: mapped.length - out.length };
}

async function applyToSupabase(kits) {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Brak SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — pomijam --apply');
    process.exit(1);
  }
  const supabase = createClient(url, key);
  const rows = kits.map((k) => ({
    id: k.id,
    name: k.name,
    description: k.description,
    category: k.category,
    items: k.items,
    image_url: k.imageUrl || '',
    created_at: k.createdAt,
  }));
  const BATCH = 50;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error } = await supabase.from('kits').upsert(batch);
    if (error) throw error;
    console.log(`Supabase upsert ${i + batch.length}/${rows.length}`);
  }
}

function writeKitImportOutputs(kits, report, apply) {
  mkdirSync(join(ROOT, 'data'), { recursive: true });
  writeFileSync(join(ROOT, 'data/baselinker-kits-import.json'), JSON.stringify(kits, null, 2));
  writeFileSync(
    join(ROOT, 'data/baselinker-kits-import-report.json'),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
  console.log(`\nZapisano: data/baselinker-kits-import.json (${kits.length} zestawów)`);
  if (apply) void applyToSupabase(kits).then(() => console.log('Supabase: gotowe.'));
}

function main() {
  loadDotenv();
  const args = process.argv.slice(2).filter((a) => a !== '--apply');
  const apply = process.argv.includes('--apply');
  const inputPath = args[0];
  const namesXmlPath = args[1];
  if (!inputPath) {
    console.error('Podaj ścieżkę do XML lub CSV BaseLinker (Zestawy), np.:');
    console.error('  node scripts/import-baselinker-kits.mjs "d:/Downloads/Base__....xml"');
    console.error('  node scripts/import-baselinker-kits.mjs "d:/Downloads/Zestawy__....csv"');
    process.exit(1);
  }

  const shop = JSON.parse(readFileSync(join(ROOT, 'public/data/shop-products.json'), 'utf8'));
  let accessories = [];
  try {
    accessories = JSON.parse(readFileSync(join(ROOT, 'public/data/products.json'), 'utf8'));
  } catch {
    /* optional */
  }
  const catalog = [...shop, ...accessories];
  const index = buildProductIndex(catalog);

  const raw = readFileSync(inputPath, 'utf8');
  const isZestawyCsv =
    inputPath.toLowerCase().endsWith('.csv') ||
    basename(inputPath).toLowerCase().startsWith('zestawy__') ||
    /^20\d{7,}\s*(\r?\n|$)/m.test(raw.slice(0, 200));

  if (isZestawyCsv) {
    const xmlForNames = namesXmlPath || findCompanionBaselinkerXml(inputPath);
    const nameMap = buildBlProductNameMap(xmlForNames);
    const parsed = parseBaselinkerZestawyCsv(raw);
    const mapped = parsed.map((b) => {
      const name =
        nameMap.get(String(b.zestawId)) ||
        deriveKitNameFromImageUrl(b.image) ||
        `Zestaw Base ${b.zestawId}`;
      return mapKitFromBundle({ ...b, name }, index);
    });

    const { kept, skipped } = dedupeByName(mapped);
    const ok = kept.filter((r) => r.status === 'ok');
    const partial = kept.filter((r) => r.status === 'partial');
    const failed = kept.filter((r) => r.status === 'failed');
    const kits = kept.filter((r) => r.kit.items.length > 0).map((r) => r.kit);

    const report = {
      generatedAt: new Date().toISOString(),
      sourceCsv: inputPath,
      namesFromXml: xmlForNames || null,
      format: 'baselinker-zestawy-csv',
      zestawCount: parsed.length,
      dedupeSkipped: skipped,
      mappedOk: ok.length,
      mappedPartial: partial.length,
      mappedFailed: failed.length,
      kitsReady: kits.length,
      partialDetails: partial.map((r) => ({
        id: r.kit.id,
        name: r.kit.name,
        unmatched: r.unmatched,
      })),
      failedDetails: failed.map((r) => ({
        id: r.kit.id,
        name: r.kit.name,
        unmatched: r.unmatched,
      })),
    };
    writeKitImportOutputs(kits, report, apply);
    return;
  }

  const xml = raw;
  const bundleMapped = parseBaselinkerBundleExport(xml, index);
  if (bundleMapped) {
    const { kept, skipped } = dedupeByName(bundleMapped);
    const kits = kept
      .filter((r) => r.kit.items.length > 0)
      .map((r) => r.kit);
    const report = {
      generatedAt: new Date().toISOString(),
      sourceXml: inputPath,
      format: 'baselinker-zestaw-export',
      zestawCount: bundleMapped.length,
      dedupeSkipped: skipped,
      kitsReady: kits.length,
    };
    writeKitImportOutputs(kits, report, apply);
    return;
  }

  const all = parseXmlProducts(xml).filter(isKitRow);
  const mapped = all.map((p) => mapKit(p, index));
  const { kept, skipped } = dedupeByName(mapped);

  const ok = kept.filter((r) => r.status === 'ok');
  const partial = kept.filter((r) => r.status === 'partial');
  const failed = kept.filter((r) => r.status === 'failed');

  const kits = kept
    .filter((r) => r.kit.items.length > 0)
    .map((r) => {
      const { meta, ...kit } = r.kit;
      return kit;
    });

  const report = {
    generatedAt: new Date().toISOString(),
    sourceXml: inputPath,
    baselinkerKitRows: all.length,
    dedupeSkipped: skipped,
    mappedOk: ok.length,
    mappedPartial: partial.length,
    mappedFailed: failed.length,
    kitsReady: kits.length,
    samples: {
      ok: ok.slice(0, 3).map((r) => ({
        name: r.kit.name,
        items: r.kit.items.map((i) => `${i.quantity}× ${i.sku || i.name}`),
      })),
      partial: partial.slice(0, 5).map((r) => ({
        name: r.kit.name,
        unmatched: r.unmatched,
        items: r.kit.items.length,
      })),
      failed: failed.slice(0, 5).map((r) => ({ name: r.kit.name, unmatched: r.unmatched })),
    },
    partialDetails: partial.map((r) => ({
      id: r.kit.id,
      name: r.kit.name,
      unmatched: r.unmatched,
    })),
  };

  writeKitImportOutputs(kits, report, apply);
}

main();
