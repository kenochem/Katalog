import type { Product } from '../types';
import { findCapacities } from './nameStandard';
import { getProductImage } from './products';

/**
 * Grupy wariantów po pojemności: jeden produkt (np. jeden zapach) i jego pojemności 100 ml / 250 ml / 500 ml / 1 kg.
 * Zdjęcie i cena grupy pochodzą z wariantu „głównego” — domyślnie 500 ml (albo najbliższego).
 */
export const PRIMARY_AMOUNT = 500;

export interface VariantMember {
  product: Product;
  /** Pojemność w oryginalnym zapisie, np. „500ml”. */
  capText: string;
  /** Ilość w ml albo g. */
  amount: number;
  kind: 'vol' | 'mass';
}

export interface VariantFamily {
  key: string;
  /** Nazwa grupy = nazwa produktu bez pojemności. */
  name: string;
  members: VariantMember[];
  primary: VariantMember;
  /** Zdjęcie grupy (z wariantu głównego, a gdy go nie ma — z innego). */
  imageUrl: string;
  imageFromPrimary: boolean;
}

const fold = (s: string) =>
  s
    .toLowerCase()
    .replace(/ł/g, 'l')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** Nazwa bez (jedynej) pojemności, z uporządkowanymi separatorami. */
export function stripCapacity(name: string): string {
  const caps = findCapacities(name);
  if (caps.length !== 1) return name.trim();
  const c = caps[0];
  let end = c.index + c.text.length;
  if (name[end] === '.' && !/[\p{L}\d]/u.test(name[end + 1] ?? '')) end++;
  return (name.slice(0, c.index) + name.slice(end))
    .replace(/(\s-)(\s*-)+/g, '$1')
    .replace(/\s+-\s*$/, '')
    .replace(/^\s*-\s+/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function parseAmount(num: string, unit: string): { amount: number; kind: 'vol' | 'mass' } | null {
  const n = Number(num.replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) return null;
  switch (unit.toLowerCase()) {
    case 'ml':
      return { amount: n, kind: 'vol' };
    case 'l':
      return { amount: n * 1000, kind: 'vol' };
    case 'g':
      return { amount: n, kind: 'mass' };
    case 'kg':
      return { amount: n * 1000, kind: 'mass' };
    default:
      return null;
  }
}

function memberOf(p: Product): VariantMember | null {
  const name = (p.displayName || p.name || '').trim();
  const caps = findCapacities(name);
  if (caps.length !== 1) return null;
  const m = caps[0].normalized.match(/^(\d+(?:[.,]\d+)?)(ml|L|kg|g)$/);
  if (!m) return null;
  const parsed = parseAmount(m[1], m[2]);
  if (!parsed) return null;
  return { product: p, capText: caps[0].normalized, amount: parsed.amount, kind: parsed.kind };
}

/** Wariant najbliższy 500 ml (w skali logarytmicznej); przy remisie — większy. */
export function pickPrimary(members: VariantMember[]): VariantMember {
  return [...members].sort((a, b) => {
    const da = Math.abs(Math.log(a.amount / PRIMARY_AMOUNT));
    const db = Math.abs(Math.log(b.amount / PRIMARY_AMOUNT));
    return da - db || b.amount - a.amount;
  })[0];
}

/** SKU produktów, które są już wariantami jakiejś grupy. */
export function groupedSkus(products: Product[]): Set<string> {
  const set = new Set<string>();
  for (const g of products) {
    if (!g.isGroup) continue;
    for (const v of g.variants ?? []) if (v.sku) set.add(String(v.sku).toUpperCase());
  }
  return set;
}

/** Rodziny produktów różniących się wyłącznie pojemnością (ta sama nazwa i producent). */
export function findVariantFamilies(products: Product[]): { families: VariantFamily[]; skippedDuplicates: number } {
  const taken = groupedSkus(products);
  const buckets = new Map<string, VariantMember[]>();
  for (const p of products) {
    if (p.isGroup || p.meta?.catalogHidden || taken.has(String(p.sku).toUpperCase())) continue;
    const m = memberOf(p);
    if (!m) continue;
    const base = stripCapacity(p.displayName || p.name || '');
    if (fold(base).length < 8) continue;
    const key = `${fold(p.manufacturer || '')}|${fold(base)}`;
    const arr = buckets.get(key) ?? [];
    arr.push(m);
    buckets.set(key, arr);
  }
  const families: VariantFamily[] = [];
  let skippedDuplicates = 0;
  for (const [key, members] of buckets) {
    if (members.length < 2) continue;
    const amounts = new Set(members.map((m) => m.amount));
    if (amounts.size !== members.length) {
      skippedDuplicates++;
      continue;
    }
    const sorted = [...members].sort((a, b) => a.amount - b.amount);
    const primary = pickPrimary(sorted);
    const primaryImg = getProductImage(primary.product) || '';
    const imageUrl = primaryImg || sorted.map((m) => getProductImage(m.product) || '').find(Boolean) || '';
    families.push({
      key,
      name: stripCapacity(primary.product.displayName || primary.product.name || ''),
      members: sorted,
      primary,
      imageUrl,
      imageFromPrimary: !!primaryImg,
    });
  }
  return { families, skippedDuplicates };
}

export function groupSkuFor(name: string, taken: Set<string>): string {
  const slug = name
    .toUpperCase()
    .replace(/Ł/g, 'L')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  let sku = `GROUP-${slug || 'WARIANTY'}`;
  let i = 2;
  while (taken.has(sku)) sku = `GROUP-${slug}-${i++}`;
  taken.add(sku);
  return sku;
}

/** Dane produktu-grupy do zapisania (createProduct). */
export function buildGroupData(family: VariantFamily, sku: string): Omit<Product, 'id' | 'hasImage'> {
  const p = family.primary.product;
  return {
    sku,
    name: family.name,
    displayName: family.name,
    category: p.category,
    manufacturer: p.manufacturer,
    ean: '',
    imageUrl: family.imageUrl,
    description: p.description || `${family.members.length} wariantów — wybierz SKU z listy poniżej`,
    stock: family.members.reduce((n, m) => n + (m.product.stock ?? 0), 0),
    stockManual: false,
    pricePurchaseNet: p.pricePurchaseNet,
    priceSaleNet: p.priceSaleNet,
    priceSaleGross: p.priceSaleGross,
    catalog: p.catalog || 'accessories',
    isGroup: true,
    variants: family.members.map((m) => ({
      sku: m.product.sku,
      name: m.product.displayName || m.product.name,
      stock: m.product.stock ?? 0,
      ...(m.product.ean ? { ean: m.product.ean } : {}),
    })),
    meta: { groupPrimarySku: p.sku },
  };
}

/** Grupy utworzone jako warianty pojemności (mają wskazany wariant główny). */
export function capacityGroups(products: Product[]): Product[] {
  return products.filter((p) => p.isGroup && p.meta?.groupPrimarySku);
}

/** Zdjęcie grupy powinno być zdjęciem wariantu głównego — zwraca zmianę, jeśli grupa jest nieaktualna. */
export function groupImageFix(group: Product, products: Product[]): { imageUrl: string } | null {
  const primarySku = group.meta?.groupPrimarySku?.toUpperCase();
  if (!primarySku) return null;
  const primary = products.find((p) => !p.isGroup && p.sku.toUpperCase() === primarySku);
  const url = primary ? getProductImage(primary) || '' : '';
  if (!url || url === (group.customImageUrl || group.imageUrl)) return null;
  return { imageUrl: url };
}

/** Rodzina z innym wariantem głównym (zdjęcie grupy liczone od nowa). */
export function withPrimary(family: VariantFamily, sku: string): VariantFamily {
  const primary = family.members.find((m) => m.product.sku === sku) ?? family.primary;
  const primaryImg = getProductImage(primary.product) || '';
  const imageUrl = primaryImg || family.members.map((m) => getProductImage(m.product) || '').find(Boolean) || '';
  return { ...family, primary, imageUrl, imageFromPrimary: !!primaryImg };
}
