import type { Product } from '../types';
import { CATALOG_LABELS } from '../types';
import { stripHtml } from './format';
import { formatLocationCode } from './warehouseLocation';
import { resolveProductLocation } from './locationStore';
import { formatDimensions, normalizeProductMeta, type ProductMeta } from './productMeta';

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
    category: product.category,
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
    `Kategoria: ${product.category}`,
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

const KNOWLEDGE_CHECKS: {
  label: string;
  weight: number;
  test: (p: Product, meta: ProductMeta) => boolean;
}[] = [
  {
    label: 'Krótki opis (co to jest)',
    weight: 22,
    test: (_p, m) => (m.shortDescription?.trim().length ?? 0) >= 18,
  },
  {
    label: 'Opis pełny',
    weight: 22,
    test: (p) => stripHtml(p.description || '').trim().length >= 40,
  },
  {
    label: 'Parametry techniczne',
    weight: 18,
    test: (_p, m) => Object.keys(m.parameters ?? {}).length >= 2,
  },
  {
    label: 'EAN',
    weight: 10,
    test: (p) => !!p.ean?.trim() || !!(p.variants?.some((v) => v.ean?.trim())),
  },
  {
    label: 'Zdjęcie',
    weight: 10,
    test: (p) => !!(p.hasImage || p.imageUrl || p.customImageUrl),
  },
  {
    label: 'Producent',
    weight: 6,
    test: (p) => {
      const m = p.manufacturer?.trim().toLowerCase();
      return !!m && m !== 'wapro';
    },
  },
  {
    label: 'Logistyka (waga / wymiary / j.m.)',
    weight: 6,
    test: (_p, m) =>
      m.weightKg != null || !!formatDimensions(m) || !!m.unit?.trim(),
  },
  {
    label: 'Lokalizacja magazynowa',
    weight: 6,
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
  const cat = product.category?.trim();
  if (cat && cat !== 'Inne' && !name.toLowerCase().includes(cat.toLowerCase())) {
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
    const cat = p.category || 'Inne';
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
