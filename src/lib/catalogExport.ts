import type { Product } from '../types';
import { downloadCsv, stampFile } from './exportReport';
import { resolveProductLocation } from './locationStore';
import { formatLocationCode } from './warehouseLocation';
import { assessProductKnowledge } from './productKnowledge';

export interface CatalogStats {
  total: number;
  inStock: number;
  outOfStock: number;
  lowStock: number;
  withoutImage: number;
  withEan: number;
  weakKnowledge: number;
  avgKnowledgeScore: number;
}

export function computeCatalogStats(products: Product[]): CatalogStats {
  let inStock = 0;
  let outOfStock = 0;
  let lowStock = 0;
  let withoutImage = 0;
  let withEan = 0;
  let weakKnowledge = 0;
  let knowledgeSum = 0;

  for (const p of products) {
    const s = p.stock ?? 0;
    if (s > 0) inStock++;
    else outOfStock++;
    if (s > 0 && s <= 5) lowStock++;
    if (!p.hasImage && !p.customImageUrl) withoutImage++;
    if (p.ean?.trim()) withEan++;
    const k = assessProductKnowledge(p);
    knowledgeSum += k.score;
    if (k.score < 55) weakKnowledge++;
  }

  const total = products.length;

  return {
    total,
    inStock,
    outOfStock,
    lowStock,
    withoutImage,
    withEan,
    weakKnowledge,
    avgKnowledgeScore: total ? Math.round(knowledgeSum / total) : 0,
  };
}

export function exportProductsCsv(
  products: Product[],
  catalogLabel: string,
): void {
  const headers = [
    'SKU',
    'Nazwa',
    'Kategoria',
    'EAN',
    'Stan',
    'Lokalizacja',
    'Ma zdjęcie',
    'Katalog',
  ];
  const rows = products.map((p) => [
    p.sku,
    p.displayName,
    p.category,
    p.ean || '',
    p.stock ?? 0,
    formatLocationCode(resolveProductLocation(p.id, p.warehouseLocation)),
    p.hasImage || p.customImageUrl ? 'tak' : 'nie',
    p.catalog || 'accessories',
  ]);
  downloadCsv(
    stampFile(`katalog_${catalogLabel.replace(/\s+/g, '_')}`),
    headers,
    rows,
  );
}
