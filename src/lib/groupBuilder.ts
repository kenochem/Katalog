import type { Product } from '../types';
import { getProductImage } from './products';
import { groupedSkus, type VariantFamily, type VariantMember } from './variantGroups';

/**
 * Dowolne grupy produktów (np. dysze, części) — nie tylko po pojemności: ręczne składanie grupy z wybranych produktów,
 * edycja istniejących grup oraz propozycje rodzin części różniących się kodem na końcu nazwy.
 */
const naturalCollator = new Intl.Collator('pl', { numeric: true, sensitivity: 'base' });

const fold = (s: string) =>
  s
    .toLowerCase()
    .replace(/ł/g, 'l')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

export interface GroupDraft {
  name: string;
  members: Product[];
  primarySku: string;
}

function pickDraftPrimary(draft: GroupDraft): Product {
  return draft.members.find((m) => m.sku === draft.primarySku) ?? draft.members[0];
}

function variantsOf(members: Product[]) {
  return [...members]
    .sort((a, b) => naturalCollator.compare(a.displayName || a.name || '', b.displayName || b.name || ''))
    .map((m) => ({
      sku: m.sku,
      name: m.displayName || m.name,
      stock: m.stock ?? 0,
      ...(m.ean ? { ean: m.ean } : {}),
    }));
}

/** Dane nowej grupy z dowolnych produktów (wariant główny daje zdjęcie, cenę, kategorię i producenta). */
export function draftGroupData(draft: GroupDraft, sku: string): Omit<Product, 'id' | 'hasImage'> {
  const primary = pickDraftPrimary(draft);
  const imageUrl = getProductImage(primary) || draft.members.map((m) => getProductImage(m) || '').find(Boolean) || '';
  return {
    sku,
    name: draft.name,
    displayName: draft.name,
    category: primary.category,
    manufacturer: primary.manufacturer,
    ean: '',
    imageUrl,
    description: primary.description || `${draft.members.length} wariantów — wybierz SKU z listy poniżej`,
    stock: draft.members.reduce((n, m) => n + (m.stock ?? 0), 0),
    stockManual: false,
    pricePurchaseNet: primary.pricePurchaseNet,
    priceSaleNet: primary.priceSaleNet,
    priceSaleGross: primary.priceSaleGross,
    catalog: primary.catalog || 'accessories',
    isGroup: true,
    variants: variantsOf(draft.members),
    meta: { groupPrimarySku: primary.sku },
  };
}

/** Zmiana istniejącej grupy: nazwa, lista wariantów i wariant główny (kategoria i producent grupy zostają). */
export function draftGroupPatch(group: Product, draft: GroupDraft, keepRaw: NonNullable<Product['variants']> = []): Partial<Product> {
  const primary = pickDraftPrimary(draft);
  const imageUrl = getProductImage(primary) || draft.members.map((m) => getProductImage(m) || '').find(Boolean) || group.imageUrl;
  return {
    name: draft.name,
    displayName: draft.name,
    variants: [...variantsOf(draft.members), ...keepRaw],
    stock: draft.members.reduce((n, m) => n + (m.stock ?? 0), 0) + keepRaw.reduce((n, v) => n + (v.stock ?? 0), 0),
    // własne zdjęcie grupy zostaje; bez niego pokazujemy pierwsze zdjęcie z produktów grupy
    ...(group.customImageUrl ? {} : { imageUrl, customImageUrl: '', hasImage: !!imageUrl }),
    pricePurchaseNet: primary.pricePurchaseNet ?? group.pricePurchaseNet,
    priceSaleNet: primary.priceSaleNet ?? group.priceSaleNet,
    priceSaleGross: primary.priceSaleGross ?? group.priceSaleGross,
    meta: { ...(group.meta ?? {}), groupPrimarySku: primary.sku },
  };
}

/** Produkty, które można dodać do grupy: nie-grupy, nieukryte i jeszcze niebędące wariantem żadnej grupy. */
export function groupableProducts(products: Product[], exceptGroupId?: string): Product[] {
  const taken = new Set<string>();
  for (const g of products) {
    if (!g.isGroup || g.id === exceptGroupId) continue;
    for (const v of g.variants ?? []) if (v.sku) taken.add(String(v.sku).toUpperCase());
  }
  return products.filter((p) => !p.isGroup && !p.meta?.catalogHidden && !taken.has(String(p.sku).toUpperCase()));
}

/** Wszystkie grupy produktów (także utworzone skryptem importu, np. dysze). */
export function allGroups(products: Product[]): Product[] {
  return products.filter((p) => p.isGroup);
}

const CODE_TOKEN = /^\d[\d\-./,x]*$/i;

/**
 * Rodziny części różniących się tylko kodem na końcu nazwy (np. „Dysza 1/4 25-055”, „Dysza 1/4 25-040”…):
 * ta sama nazwa bez ostatniego kodu, ten sam producent i dopisek po „ - ”. Pokazujemy rodziny od 3 wariantów.
 */
export function findPartFamilies(products: Product[], minMembers = 3): VariantFamily[] {
  const taken = groupedSkus(products);
  const buckets = new Map<string, { base: string; members: { product: Product; code: string }[] }>();
  for (const p of products) {
    if (p.isGroup || p.meta?.catalogHidden || taken.has(String(p.sku).toUpperCase())) continue;
    const name = (p.displayName || p.name || '').trim();
    const dash = name.indexOf(' - ');
    const main = (dash >= 0 ? name.slice(0, dash) : name).trim();
    const suffix = dash >= 0 ? name.slice(dash) : '';
    const tokens = main.split(/\s+/);
    if (tokens.length < 3) continue;
    const code = tokens[tokens.length - 1];
    if (!CODE_TOKEN.test(code)) continue;
    const base = `${tokens.slice(0, -1).join(' ')}${suffix}`.trim();
    if (fold(base).length < 8) continue;
    const key = `part|${fold(p.manufacturer || '')}|${fold(base)}`;
    const bucket = buckets.get(key) ?? { base, members: [] };
    bucket.members.push({ product: p, code });
    buckets.set(key, bucket);
  }
  const families: VariantFamily[] = [];
  for (const [key, b] of buckets) {
    const codes = new Set(b.members.map((m) => m.code));
    if (b.members.length < minMembers || codes.size !== b.members.length) continue;
    const sorted = [...b.members].sort((a, c) => naturalCollator.compare(a.code, c.code));
    const members: VariantMember[] = sorted.map((m, i) => ({ product: m.product, capText: m.code, amount: i + 1, kind: 'vol' }));
    // wariant główny: pierwszy ze zdjęciem (a gdy nikt go nie ma — pierwszy)
    const primary = members.find((m) => !!getProductImage(m.product)) ?? members[0];
    const primaryImg = getProductImage(primary.product) || '';
    families.push({
      key,
      name: b.base,
      members,
      primary,
      imageUrl: primaryImg,
      imageFromPrimary: !!primaryImg,
    });
  }
  return families;
}
