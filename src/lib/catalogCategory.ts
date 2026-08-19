import type { Product } from '../types';
import { getShopCategoryTree, walkShopLeaves } from './shopCategoryTree';
import { effectiveManufacturer } from './waproManufacturers';

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

const shopLeaves = walkShopLeaves(getShopCategoryTree().roots);
const leafByNorm = new Map(shopLeaves.map((leaf) => [normalize(leaf.label), leaf.label]));
const displayCategoryCache = new WeakMap<Product, string>();

function normalize(value: string): string {
  return value
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pl')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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

function has(text: string, ...needles: string[]): boolean {
  return needles.some((needle) => text.includes(normalize(needle)));
}

function inferTargetCategory(product: Product): string | null {
  const text = textForInference(product);

  if (has(text, 'dysza', 'dysze')) return target('Dysze do myjek');
  if (has(text, 'lanca', 'lance', 'pistolet')) return target('Lance i pistolety');
  if (has(text, 'szybkoz', 'adapter', 'zlacz', 'złącz', 'mufa', 'nypel')) return target('Szybkozłącza i adaptery');
  if (has(text, 'waz', 'wąż', 'weze', 'węże', 'beben', 'bęben')) return target('Węże i bębny');
  if (has(text, 'filtr', 'redukc', 'zawor', 'zawór', 'by pass', 'bypass', 'manometr')) {
    return target('Filtry, redukcje i zawory');
  }
  if (has(text, 'pianownica', 'pianownice')) return target('Pianownice do myjek');
  if (has(text, 'tornador')) return target('Tornadory');
  if (has(text, 'odkurzacz', 'odkurzacza')) return target('Akcesoria do odkurzaczy');

  if (has(text, 'aktywna piana', 'piana aktywna', 'foam')) return target('Aktywne piany');
  if (has(text, 'szampon')) return target('Szampony samochodowe');
  if (has(text, 'pre wash', 'prewash', 'tfr')) return target('Pre-wash i TFR');
  if (has(text, 'apc')) return target('APC do samochodu');
  if (has(text, 'owad', 'insekt')) return target('Usuwanie owadów');
  if (has(text, 'smoła', 'smola', 'asfalt', 'klej', 'zywic', 'żywic')) {
    return target('Usuwanie smoły, asfaltu, kleju i żywicy');
  }
  if (has(text, 'felg', 'deiron', 'krwawa')) return target('Płyny do felg');
  if (has(text, 'opon', 'czernid', 'dressing')) return target('Dressingi i czernidła do opon');
  if (has(text, 'szyb', 'spryskiwacz samochod')) return target('Płyny do szyb samochodowych');
  if (has(text, 'niewidzialna wycieracz')) return target('Niewidzialne wycieraczki');
  if (has(text, 'antypara', 'parowanie')) return target('Antypara');
  if (has(text, 'kokpit')) return target('Kokpit i plastiki');
  if (has(text, 'skora', 'skóra')) return target('Skóra samochodowa');
  if (has(text, 'tapicerk')) return target('Tapicerka materiałowa');
  if (has(text, 'klimatyzac')) return target('Klimatyzacja samochodowa');
  if (has(text, 'zapach', 'neutralizator')) return target('Zapachy i neutralizatory do samochodu');
  if (has(text, 'wosk')) return target('Woski samochodowe');
  if (has(text, 'quick detailer', 'detailer')) return target('Quick detailery');
  if (has(text, 'ceramiczn', 'powłoka', 'powloka')) return target('Powłoki ceramiczne i ochronne');
  if (has(text, 'pasta polerska', 'poler')) return target('Pasty polerskie');
  if (has(text, 'plastik zewn')) return target('Plastiki zewnętrzne');
  if (has(text, 'silnik')) return target('Czyszczenie silnika');

  if (has(text, 'dpf', 'fap')) return target('Czyszczenie DPF/FAP');
  if (has(text, 'ultradzwiek', 'ultradźwięk')) return target('Płyny do myjek ultradźwiękowych');
  if (has(text, 'smar')) return target('Smary techniczne');
  if (has(text, 'zmywacz hamul')) return target('Zmywacze do hamulców');
  if (has(text, 'odtluszcz', 'odtłuszcz')) return target('Odtłuszczacze przemysłowe');
  if (has(text, 'czyściwo', 'czysciwo')) return target('Czyściwa przemysłowe');

  if (has(text, 'mikrofibr', 'mikrowlok', 'mikrowłok')) return target('Mikrofibry uniwersalne');
  if (has(text, 'gabka', 'gąbka', 'rekawic')) return target('Gąbki i rękawice');
  if (has(text, 'aplikator')) return target('Pady i futra polerskie');
  if (has(text, 'opryskiwacz', 'spryskiwacz')) return target('Opryskiwacze ciśnieniowe uniwersalne');
  if (has(text, 'dozownik')) return target('Dozowniki');
  if (has(text, 'butelka', 'opakowanie')) return target('Butelki i opakowania');
  if (has(text, 'mop', 'stelaz', 'stelaż')) return target('Mopy i stelaże');
  if (has(text, 'wiadro')) return target('Wiadra i wyciskarki');
  if (has(text, 'miotla', 'miotła')) return target('Miotły przemysłowe');
  if (has(text, 'szczotka', 'szczotki', 'vikan')) return target('Szczotki do mycia samochodu');
  if (has(text, 'sciagacz', 'ściągacz')) return target('Ściągaczki do szyb i wody');
  if (has(text, 'skrobaczka')) return target('Skrobaczki do szyb');
  if (has(text, 'worek', 'worki')) return target('Worki na odpady');
  if (has(text, 'ręcznik papier', 'recznik papier')) return target('Ręczniki papierowe');
  if (has(text, 'papier toaletowy')) return target('Papier toaletowy');

  if (has(text, 'lazienka', 'łazienka', 'sanitariat', 'wc', 'toaleta')) return target('Łazienki i sanitariaty');
  if (has(text, 'podloga', 'podłoga', 'posadzka')) return target('Podłogi i posadzki');
  if (has(text, 'kuchnia', 'gastronom')) return target('Odtłuszczanie kuchni');
  if (has(text, 'pranie', 'odplamiacz')) return target('Płyny i żele do prania');
  if (has(text, 'kostka brukowa', 'kamien', 'kamień')) return target('Kostka brukowa i kamień');
  if (has(text, 'fotowolta')) return target('Mycie paneli fotowoltaicznych');

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
