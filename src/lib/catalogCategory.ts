import type { Product } from '../types';
import { getShopCategoryTree, walkShopLeaves } from './shopCategoryTree';
import { effectiveManufacturer } from './waproManufacturers';

/** Bufor normalizacji (deklarowany przed użyciem na poziomie modułu). */
const normalizeCache = new Map<string, string>();

const GENERIC_SOURCE_CATEGORIES = new Set([
  '',
  'produkt',
  'produkty',
  'akcesoria',
  'akcesoria sklepowe',
  'chemia',
  'inne',
  'pozostale',
  'pozostałe',
]);

const KNOWN_PRODUCER_CATEGORIES = new Set([
  'atas',
  'cartec',
  'draco',
  'eilfix',
  'eco shine',
  'fraber',
  'freshtek',
  'fresso',
  'hadwao',
  'jax',
  'kenochem',
  'kenotek',
  'normatek',
  'orion',
  'soft99',
  'sonax',
  'vikan',
  'xpert-60',
  'youtech',
]);

let leafByNorm = new Map(walkShopLeaves(getShopCategoryTree().roots).map((leaf) => [normalize(leaf.label), leaf.label]));
let displayCategoryCache = new WeakMap<Product, string>();

/** Przebudowuje indeks kategorii po zmianie drzewa (własne kategorie, przeniesienia, usunięcia). */
export function rebuildCategoryIndex(): void {
  leafByNorm = new Map(walkShopLeaves(getShopCategoryTree().roots).map((leaf) => [normalize(leaf.label), leaf.label]));
  displayCategoryCache = new WeakMap<Product, string>();
}

function normalize(value: string): string {
  const hit = normalizeCache.get(value);
  if (hit !== undefined) return hit;
  // czysty ASCII nie wymaga dekompozycji unicode (większość tekstu: SKU, marki, nazwy bez ogonków)
  const trimmed = value.trim();
  const out = (/^[\x00-\x7f]*$/.test(trimmed) ? trimmed : trimmed.normalize('NFD').replace(/[\u0300-\u036f]/g, ''))
    .toLocaleLowerCase('pl')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  // kr\u00f3tkie, powtarzalne napisy (kategorie, producenci, frazy) \u2014 bufor ograniczony rozmiarem
  if (value.length <= 80) {
    if (normalizeCache.size > 20000) normalizeCache.clear();
    normalizeCache.set(value, out);
  }
  return out;
}

function target(label: string): string {
  return leafByNorm.get(normalize(label)) ?? label;
}

function targetFromPath(path?: string): string | null {
  if (!path) return null;
  const parts = path
    .split(/[>›/]/)
    .map((part) => part.trim())
    .filter(Boolean);
  const last = parts.at(-1);
  if (!last) return null;
  return leafByNorm.get(normalize(last)) ?? null;
}

export function isGenericSourceCategory(category: string | undefined | null): boolean {
  return GENERIC_SOURCE_CATEGORIES.has(normalize(category || ''));
}

export function isLikelyProducerCategory(
  category: string | undefined | null,
  product?: Product,
): boolean {
  const norm = normalize(category || '');
  if (!norm) return false;
  const manufacturer = product ? normalize(effectiveManufacturer(product)) : '';
  if (manufacturer && manufacturer !== 'bez producenta' && norm === manufacturer) return true;
  return KNOWN_PRODUCER_CATEGORIES.has(norm);
}

function textForInference(product: Product): string {
  return normalize(
    [
      product.displayName,
      product.name,
      product.sku,
      product.category,
      product.manufacturer,
      product.meta?.shortDescription,
      product.meta?.shopCategoryPath,
      ...(product.tags ?? []),
    ]
      .filter(Boolean)
      .join(' '),
  );
}

const needleCache = new Map<string, string>();
function normalizedNeedle(needle: string): string {
  let n = needleCache.get(needle);
  if (n === undefined) {
    n = normalize(needle);
    needleCache.set(needle, n);
  }
  return n;
}

/** Reguły wnioskowania kategorii z tekstu produktu — kolejność ma znaczenie (pierwsza pasująca wygrywa). */
const INFERENCE_RULES: [string[], string][] = [
  [['dysza', 'dysze'], 'Dysze do myjek'],
  [['lanca', 'lance', 'pistolet'], 'Lance i pistolety'],
  [['szybkoz', 'adapter', 'zlacz', 'złącz', 'mufa', 'nypel'], 'Szybkozłącza i adaptery'],
  [['waz', 'wąż', 'weze', 'węże', 'beben', 'bęben'], 'Węże i bębny'],
  [['filtr', 'redukc', 'zawor', 'zawór', 'by pass', 'bypass', 'manometr'], 'Filtry, redukcje i zawory'],
  [['pianownica', 'pianownice'], 'Pianownice do myjek'],
  [['tornador'], 'Tornadory'],
  [['odkurzacz', 'odkurzacza'], 'Akcesoria do odkurzaczy'],
  [['aktywna piana', 'piana aktywna', 'foam'], 'Aktywne piany'],
  [['szampon'], 'Szampony samochodowe'],
  [['pre wash', 'prewash', 'tfr'], 'Pre-wash i TFR'],
  [['apc'], 'APC do samochodu'],
  [['owad', 'insekt'], 'Usuwanie owadów'],
  [['smoła', 'smola', 'asfalt', 'klej', 'zywic', 'żywic'], 'Usuwanie smoły, asfaltu, kleju i żywicy'],
  [['felg', 'deiron', 'krwawa'], 'Płyny do felg'],
  [['opon', 'czernid', 'dressing'], 'Dressingi i czernidła do opon'],
  [['szyb', 'spryskiwacz samochod'], 'Płyny do szyb samochodowych'],
  [['niewidzialna wycieracz'], 'Niewidzialne wycieraczki'],
  [['antypara', 'parowanie'], 'Antypara'],
  [['kokpit'], 'Kokpit i plastiki'],
  [['skora', 'skóra'], 'Skóra samochodowa'],
  [['tapicerk'], 'Tapicerka materiałowa'],
  [['klimatyzac'], 'Klimatyzacja samochodowa'],
  [['zapach', 'neutralizator'], 'Zapachy i neutralizatory do samochodu'],
  [['wosk'], 'Woski samochodowe'],
  [['quick detailer', 'detailer'], 'Quick detailery'],
  [['ceramiczn', 'powłoka', 'powloka'], 'Powłoki ceramiczne i ochronne'],
  [['pasta polerska', 'poler'], 'Pasty polerskie'],
  [['plastik zewn'], 'Plastiki zewnętrzne'],
  [['silnik'], 'Czyszczenie silnika'],
  [['dpf', 'fap'], 'Czyszczenie DPF/FAP'],
  [['ultradzwiek', 'ultradźwięk'], 'Płyny do myjek ultradźwiękowych'],
  [['smar'], 'Smary techniczne'],
  [['zmywacz hamul'], 'Zmywacze do hamulców'],
  [['odtluszcz', 'odtłuszcz'], 'Odtłuszczacze przemysłowe'],
  [['czyściwo', 'czysciwo'], 'Czyściwa przemysłowe'],
  [['mikrofibr', 'mikrowlok', 'mikrowłok'], 'Mikrofibry uniwersalne'],
  [['gabka', 'gąbka', 'rekawic'], 'Gąbki i rękawice'],
  [['aplikator'], 'Pady i futra polerskie'],
  [['opryskiwacz', 'spryskiwacz'], 'Opryskiwacze ciśnieniowe uniwersalne'],
  [['dozownik'], 'Dozowniki'],
  [['butelka', 'opakowanie'], 'Butelki i opakowania'],
  [['mop', 'stelaz', 'stelaż'], 'Mopy i stelaże'],
  [['wiadro'], 'Wiadra i wyciskarki'],
  [['miotla', 'miotła'], 'Miotły przemysłowe'],
  [['szczotka', 'szczotki', 'vikan'], 'Szczotki do mycia samochodu'],
  [['sciagacz', 'ściągacz'], 'Ściągaczki do szyb i wody'],
  [['skrobaczka'], 'Skrobaczki do szyb'],
  [['worek', 'worki'], 'Worki na odpady'],
  [['ręcznik papier', 'recznik papier'], 'Ręczniki papierowe'],
  [['papier toaletowy'], 'Papier toaletowy'],
  [['lazienka', 'łazienka', 'sanitariat', 'wc', 'toaleta'], 'Łazienki i sanitariaty'],
  [['podloga', 'podłoga', 'posadzka'], 'Podłogi i posadzki'],
  [['kuchnia', 'gastronom'], 'Odtłuszczanie kuchni'],
  [['pranie', 'odplamiacz'], 'Płyny i żele do prania'],
  [['kostka brukowa', 'kamien', 'kamień'], 'Kostka brukowa i kamień'],
  [['fotowolta'], 'Mycie paneli fotowoltaicznych'],
];

let compiledRules: { needles: string[]; label: string }[] | null = null;

function inferTargetCategory(product: Product): string | null {
  const text = textForInference(product);
  // reguły normalizujemy raz, a nie przy każdym produkcie (to jest gorąca ścieżka przy ładowaniu katalogu)
  if (!compiledRules) compiledRules = INFERENCE_RULES.map(([needles, label]) => ({ needles: needles.map(normalizedNeedle), label }));
  for (let i = 0; i < compiledRules.length; i++) {
    const rule = compiledRules[i];
    for (let j = 0; j < rule.needles.length; j++) {
      if (text.includes(rule.needles[j])) return target(rule.label);
    }
  }
  return null;
}

export function getProductDisplayCategory(product: Product): string {
  const cached = displayCategoryCache.get(product);
  if (cached) return cached;

  let resolved = 'Do decyzji';
  const metaTarget = targetFromPath(product.meta?.shopCategoryPath);
  if (metaTarget) {
    displayCategoryCache.set(product, metaTarget);
    return metaTarget;
  }

  const raw = product.category?.trim() || '';
  const exactTarget = leafByNorm.get(normalize(raw));
  if (exactTarget && !isLikelyProducerCategory(raw, product)) {
    displayCategoryCache.set(product, exactTarget);
    return exactTarget;
  }

  const inferred = inferTargetCategory(product);
  if (inferred) resolved = inferred;

  displayCategoryCache.set(product, resolved);
  return resolved;
}

export function productNeedsCategoryDecision(product: Product): boolean {
  const raw = product.category?.trim() || '';
  const targetCategory = getProductDisplayCategory(product);
  if (targetCategory === 'Do decyzji') return true;
  if (isGenericSourceCategory(raw) || isLikelyProducerCategory(raw, product)) return true;
  return Boolean(raw && normalize(raw) !== normalize(targetCategory));
}

export function getProductSourceCategory(product: Product): string {
  return product.category?.trim() || 'brak';
}
