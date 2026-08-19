import type { Product } from '../types';

/**
 * Producenci (marki) z drzewa kategorii WAPRO Mag — odpowiadają polu „Producent” w Baselinkerze.
 * Kategoria produktu (Chemia, Dysze…) jest osobnym polem `category`.
 */
export const WAPRO_MANUFACTURERS = [
  'ABEL AUTO',
  'ADBL',
  'Aldis',
  'Aroma',
  'ATAS',
  'BASSAU',
  'BOLL',
  'Bradas',
  'CARPET',
  'CARTEC',
  'Chemitech',
  'CHEMOPAK',
  'CID LINES',
  'Clean Tech',
  'CONCEPT',
  'DAFI',
  'DETAILING',
  'DOLPHIN',
  'DRACO BIS',
  'DREUMEX',
  'EASY WASH',
  'ECO',
  'ECO SHINE',
  'ECOCHEM',
  'EILFIX',
  'FOEN',
  'FRABER',
  'FRESHTEK',
  'GRASS',
  'Hadwao',
  'HIGIENA',
  'HYDROFLEX',
  'JACK',
  'JAX',
  'K2',
  'KALA',
  'KARCHER',
  'KENOCHEM',
  'KWAZAR',
  'LAVOR',
  'LINEA TRADE',
  'MER',
  'MTM',
  'SONAX',
  'VIKAN',
  'Inne',
] as const;

export type WaproManufacturer = (typeof WAPRO_MANUFACTURERS)[number];

/** Prefiksy indeksu katalogowego → producent (najdłuższe dopasowanie wygrywa). */
const SKU_PREFIX_MANUFACTURERS: readonly [string, string][] = [
  ['FRAB', 'FRABER'],
  ['ELFX', 'EILFIX'],
  ['CART', 'CARTEC'],
  ['KARC', 'KARCHER'],
  ['KENO', 'KENOCHEM'],
  ['SONA', 'SONAX'],
  ['SONX', 'SONAX'],
  ['VIKA', 'VIKAN'],
  ['ABEA', 'ABEL AUTO'],
  ['ABE', 'ABEL AUTO'],
  ['ADBL', 'ADBL'],
  ['BOLL', 'BOLL'],
  ['BRAD', 'Bradas'],
  ['CHEM', 'Chemitech'],
  ['ECOC', 'ECOCHEM'],
  ['ECOS', 'ECO SHINE'],
  ['FOEN', 'FOEN'],
  ['GRAS', 'GRASS'],
  ['HYDR', 'HYDROFLEX'],
  ['JACK', 'JACK'],
  ['KALA', 'KALA'],
  ['KWAZ', 'KWAZAR'],
  ['LAVO', 'LAVOR'],
  ['MER', 'MER'],
  ['MTM', 'MTM'],
];

const MANUFACTURER_LOOKUP = new Map<string, string>(
  WAPRO_MANUFACTURERS.map((m) => [normalizeManufacturerKey(m), m]),
);

function normalizeManufacturerKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function normalizeManufacturer(value: string): string {
  const key = normalizeManufacturerKey(value);
  return MANUFACTURER_LOOKUP.get(key) ?? value.trim();
}

export function isPlaceholderManufacturer(value: string | undefined | null): boolean {
  const v = (value || '').trim().toLowerCase();
  return !v || v === 'wapro' || v === 'inne';
}

export function inferManufacturerFromSku(sku: string): string {
  const upper = sku.trim().toUpperCase();
  if (!upper) return '';
  let best = '';
  for (const [prefix, manufacturer] of SKU_PREFIX_MANUFACTURERS) {
    if (upper.startsWith(prefix) && prefix.length > best.length) {
      best = manufacturer;
    }
  }
  return best;
}

/** Producent do wyświetlania i filtrowania — pole z bazy, potem heurystyka SKU. */
export function effectiveManufacturer(product: Pick<Product, 'manufacturer' | 'sku'>): string {
  const stored = product.manufacturer?.trim();
  if (stored && !isPlaceholderManufacturer(stored)) {
    return normalizeManufacturer(stored);
  }
  return inferManufacturerFromSku(product.sku);
}

export function manufacturerOptions(existing: string[] = []): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const name of WAPRO_MANUFACTURERS) {
    if (!seen.has(name)) {
      seen.add(name);
      out.push(name);
    }
  }
  for (const raw of existing) {
    const m = raw?.trim();
    if (!m || isPlaceholderManufacturer(m)) continue;
    const norm = normalizeManufacturer(m);
    if (!seen.has(norm)) {
      seen.add(norm);
      out.push(norm);
    }
  }
  return out.sort((a, b) => a.localeCompare(b, 'pl', { sensitivity: 'base' }));
}

export function deriveManufacturers(products: Product[]): string[] {
  const counts = new Map<string, number>();
  for (const p of products) {
    const m = effectiveManufacturer(p);
    if (!m) continue;
    counts.set(m, (counts.get(m) || 0) + 1);
  }

  const ordered: string[] = [];
  const seen = new Set<string>();
  for (const name of WAPRO_MANUFACTURERS) {
    if (counts.has(name)) {
      ordered.push(name);
      seen.add(name);
    }
  }

  const rest = [...counts.keys()]
    .filter((m) => !seen.has(m))
    .sort(
      (a, b) =>
        (counts.get(b) || 0) - (counts.get(a) || 0) ||
        a.localeCompare(b, 'pl', { sensitivity: 'base' }),
    );

  return ['Wszyscy', ...ordered, ...rest];
}

export function manufacturerCounts(products: Product[]): Record<string, number> {
  const counts: Record<string, number> = { Wszyscy: products.length };
  for (const p of products) {
    const m = effectiveManufacturer(p);
    if (!m) {
      counts['Bez producenta'] = (counts['Bez producenta'] || 0) + 1;
      continue;
    }
    counts[m] = (counts[m] || 0) + 1;
  }
  return counts;
}
