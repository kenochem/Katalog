import type { Product } from '../types';
import { CATALOG_LABELS } from '../types';
import { stripHtml } from './format';
import { formatLocationCode } from './warehouseLocation';
import { resolveProductLocation } from './locationStore';
import { formatDimensions, normalizeProductMeta, type ProductMeta } from './productMeta';
import { inferProductTypeLabel } from './catalogKind';
import { getProductDisplayCategory, productNeedsCategoryDecision } from './catalogCategory';

export type KnowledgeLevel = 'weak' | 'fair' | 'good' | 'rich';

/** Rekord pod export / boty AI — bez notatek wewnętrzych i cen (opcjonalnie). */
export type ProductKnowledgeRecord = {
  id: string;
  sku: string;
  ean: string | null;
  catalog: string;
  category: string;
  name: string;
  displayName: string;
  manufacturer: string | null;
  descriptionPlain: string | null;
  shortDescription: string | null;
  parameters: Record<string, string> | null;
  tags: string[];
  stock: number | null;
  warehouseLocation: string | null;
  weightKg: number | null;
  dimensions: string | null;
  unit: string | null;
  hasImage: boolean;
  imageUrl: string | null;
  extraImageCount: number;
  isGroup: boolean;
  variantSkus: string[];
  /** Tekst liniowy — wygodny do chunkowania w RAG. */
  knowledgeText: string;
  completenessScore: number;
  completenessLevel: KnowledgeLevel;
  missingKnowledge: string[];
};

export function buildProductKnowledgeRecord(
  product: Product,
  opts: { includeStock?: boolean } = {},
): ProductKnowledgeRecord {
  const meta = normalizeProductMeta(product.meta) ?? {};
  const includeStock = opts.includeStock !== false;
  const loc = formatLocationCode(
    resolveProductLocation(product.id, product.warehouseLocation),
  );
  const desc = stripHtml(product.description || '').trim() || null;
  const short = meta.shortDescription?.trim() || null;
  const params =
    meta.parameters && Object.keys(meta.parameters).length > 0
      ? meta.parameters
      : null;

  const variantSkus =
    product.variants?.map((v) => v.sku).filter(Boolean) ?? [];

  const knowledgeText = buildKnowledgeText(product, meta, {
    includeStock,
    loc,
    desc,
    short,
    params,
  });
  const completeness = assessProductKnowledge(product);

  return {
    id: product.id,
    sku: product.sku,
    ean: product.ean?.trim() || null,
    catalog: CATALOG_LABELS[product.catalog || 'accessories'],
    category: getProductDisplayCategory(product),
    name: product.name,
    displayName: product.displayName,
    manufacturer: product.manufacturer?.trim() || null,
    descriptionPlain: desc,
    shortDescription: short,
    parameters: params,
    tags: product.tags ?? [],
    stock: includeStock ? (product.stock ?? null) : null,
    warehouseLocation: loc || null,
    weightKg: meta.weightKg ?? null,
    dimensions: formatDimensions(meta) || null,
    unit: meta.unit?.trim() || null,
    hasImage: !!product.hasImage,
    imageUrl: product.imageUrl?.trim() || product.customImageUrl?.trim() || null,
    extraImageCount: product.extraImageUrls?.length ?? 0,
    isGroup: !!product.isGroup,
    variantSkus,
    knowledgeText,
    completenessScore: completeness.score,
    completenessLevel: completeness.level,
    missingKnowledge: completeness.missing,
  };
}

function buildKnowledgeText(
  product: Product,
  meta: ProductMeta,
  ctx: {
    includeStock: boolean;
    loc: string;
    desc: string | null;
    short: string | null;
    params: Record<string, string> | null;
  },
): string {
  const lines: string[] = [
    `Produkt Kenochem: ${product.displayName}`,
    `SKU: ${product.sku}`,
    product.ean ? `EAN: ${product.ean}` : '',
    `Katalog: ${CATALOG_LABELS[product.catalog || 'accessories']}`,
    `Kategoria docelowa: ${getProductDisplayCategory(product)}`,
    product.manufacturer ? `Producent: ${product.manufacturer}` : '',
    ctx.includeStock && product.stock != null ? `Stan magazynowy: ${product.stock}` : '',
    ctx.loc ? `Lokalizacja magazynowa: ${ctx.loc}` : '',
    meta.weightKg != null ? `Waga: ${meta.weightKg} kg` : '',
    formatDimensions(meta) ? `Wymiary: ${formatDimensions(meta)}` : '',
    meta.unit ? `Jednostka: ${meta.unit}` : '',
    product.isGroup && product.variants?.length
      ? `Warianty SKU: ${product.variants.map((v) => v.sku).join(', ')}`
      : '',
    ctx.short ? `Krótki opis: ${ctx.short}` : '',
    ctx.desc ? `Opis: ${ctx.desc}` : '',
  ];

  if (ctx.params) {
    lines.push('Parametry:');
    for (const [k, v] of Object.entries(ctx.params)) {
      lines.push(`${k}: ${v}`);
    }
  }

  if (product.tags?.length) {
    lines.push(`Tagi: ${product.tags.join(', ')}`);
  }

  return lines.filter(Boolean).join('\n');
}

export type ProductKnowledgeCompleteness = {
  score: number;
  level: KnowledgeLevel;
  filled: string[];
  missing: string[];
};

export const MIN_FULL_DESCRIPTION_CHARS = 450;
export const MIN_SHORT_DESCRIPTION_CHARS = 120;

const GENERIC_CATEGORIES = new Set([
  '',
  'produkty',
  'akcesoria sklepowe',
  'akcesoria',
  'inne',
  'pozostałe',
  'pozostale',
]);

function cleanText(value: string | undefined | null): string {
  return stripHtml(value || '').replace(/\s+/g, ' ').trim();
}

function hasUsefulDescription(product: Product, meta: ProductMeta): boolean {
  if (meta.baselinkerDescriptionFull) return true;
  if ((meta.baselinkerDescriptionChars ?? 0) >= MIN_FULL_DESCRIPTION_CHARS) return true;
  const full = cleanText(product.description);
  const short = cleanText(meta.shortDescription);
  const fullWords = full.split(/\s+/).filter((word) => word.length >= 2).length;
  return (
    (full.length >= MIN_FULL_DESCRIPTION_CHARS && fullWords >= 45) ||
    (full.length >= 300 && short.length >= MIN_SHORT_DESCRIPTION_CHARS)
  );
}

function hasProductImage(product: Product): boolean {
  return Boolean(
    product.hasImage ||
      product.imageUrl ||
      product.customImageUrl ||
      product.extraImageUrls?.length,
  );
}

function hasSpecificCategory(product: Product): boolean {
  if (productNeedsCategoryDecision(product)) return false;
  const category = getProductDisplayCategory(product).trim().toLowerCase();
  if (GENERIC_CATEGORIES.has(category)) return false;
  return category.length >= 3;
}

const KNOWLEDGE_CHECKS: {
  label: string;
  weight: number;
  test: (p: Product, meta: ProductMeta) => boolean;
}[] = [
  {
    label: 'Nazwa produktu',
    weight: 14,
    test: (p) => cleanText(p.displayName || p.name).length >= 8,
  },
  {
    label: 'Zdjęcie',
    weight: 16,
    test: (p) => hasProductImage(p),
  },
  {
    label: `Pełny opis min. ${MIN_FULL_DESCRIPTION_CHARS} znaków`,
    weight: 18,
    test: hasUsefulDescription,
  },
  {
    label: 'Kategoria szczegółowa',
    weight: 12,
    test: hasSpecificCategory,
  },
  {
    label: 'EAN',
    weight: 10,
    test: (p) => !!p.ean?.trim() || !!(p.variants?.some((v) => v.ean?.trim())),
  },
  {
    label: 'Producent',
    weight: 10,
    test: (p) => {
      const m = p.manufacturer?.trim().toLowerCase();
      return !!m && m !== 'wapro';
    },
  },
  {
    label: 'Cena sprzedaży',
    weight: 8,
    test: (p) => p.priceSaleGross != null || p.priceSaleNet != null,
  },
  {
    label: 'Stan z WAPRO',
    weight: 6,
    test: (p) => typeof p.stock === 'number',
  },
  {
    label: 'Typ rozpoznany',
    weight: 6,
    test: (p) => !['Akcesoria', 'Produkt sklepowy'].includes(inferProductTypeLabel(p)),
  },
  {
    label: 'Parametry techniczne',
    weight: 6,
    test: (_p, m) => Object.keys(m.parameters ?? {}).length >= 2,
  },
  {
    label: 'Logistyka (waga / wymiary / j.m.)',
    weight: 5,
    test: (_p, m) =>
      m.weightKg != null || !!formatDimensions(m) || !!m.unit?.trim(),
  },
  {
    label: 'Lokalizacja magazynowa',
    weight: 5,
    test: (p) =>
      !!formatLocationCode(
        resolveProductLocation(p.id, p.warehouseLocation),
      ),
  },
];

export function assessProductKnowledge(product: Product): ProductKnowledgeCompleteness {
  const meta = normalizeProductMeta(product.meta) ?? {};
  let score = 0;
  const filled: string[] = [];
  const missing: string[] = [];

  for (const check of KNOWLEDGE_CHECKS) {
    if (check.test(product, meta)) {
      score += check.weight;
      filled.push(check.label);
    } else {
      missing.push(check.label);
    }
  }

  score = Math.min(100, score);
  let level: KnowledgeLevel = 'weak';
  if (score >= 85) level = 'rich';
  else if (score >= 65) level = 'good';
  else if (score >= 40) level = 'fair';

  return { score, level, filled, missing };
}

export function isWeakProductKnowledge(product: Product): boolean {
  return assessProductKnowledge(product).score < 55;
}

export function suggestShortDescription(product: Product): string {
  const name = product.displayName?.trim() || product.name?.trim() || product.sku;
  const cat = getProductDisplayCategory(product);
  if (cat && cat !== 'Do decyzji' && !name.toLowerCase().includes(cat.toLowerCase())) {
    return `${name} — ${cat.toLowerCase()} (Kenochem).`;
  }
  return `${name} — pozycja katalogowa Kenochem.`;
}

export function countByKnowledgeLevel(products: Product[]): Record<KnowledgeLevel, number> {
  const out: Record<KnowledgeLevel, number> = {
    weak: 0,
    fair: 0,
    good: 0,
    rich: 0,
  };
  for (const p of products) {
    out[assessProductKnowledge(p).level]++;
  }
  return out;
}

export type CategoryKnowledgeStats = {
  category: string;
  total: number;
  weak: number;
  avgScore: number;
  percentGood: number;
};

export function computeKnowledgeStatsByCategory(products: Product[]): CategoryKnowledgeStats[] {
  const map = new Map<string, { total: number; weak: number; scoreSum: number; good: number }>();

  for (const p of products) {
    const cat = getProductDisplayCategory(p) || 'Do decyzji';
    const entry = map.get(cat) || { total: 0, weak: 0, scoreSum: 0, good: 0 };
    const k = assessProductKnowledge(p);
    entry.total += 1;
    entry.scoreSum += k.score;
    if (k.score < 55) entry.weak += 1;
    if (k.score >= 65) entry.good += 1;
    map.set(cat, entry);
  }

  return [...map.entries()]
    .map(([category, data]) => ({
      category,
      total: data.total,
      weak: data.weak,
      avgScore: data.total ? Math.round(data.scoreSum / data.total) : 0,
      percentGood: data.total ? Math.round((data.good / data.total) * 100) : 0,
    }))
    .filter((s) => s.total > 0)
    .sort((a, b) => a.avgScore - b.avgScore || a.category.localeCompare(b.category, 'pl'));
}

export function averageKnowledgeScore(products: Product[]): number {
  if (!products.length) return 0;
  let sum = 0;
  for (const p of products) sum += assessProductKnowledge(p).score;
  return Math.round(sum / products.length);
}
