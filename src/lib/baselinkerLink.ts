/** Czy produkt jest powiązany z ofertą BaseLinker (katalog shop / eksport BL). */
import type { Product } from '../types';
import { normalizeProductMeta } from './productMeta';
import { BASELINKER_SKU_TO_ID } from './baselinkerSkuIndex.generated';

function normalizeBaselinkerSku(raw: string | undefined | null): string {
  const compact = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const match = compact.match(/^([A-Z]+)0*([0-9]+)$/);
  if (match) return `${match[1]}${Number(match[2])}`;
  return compact;
}

function baselinkerIdForProduct(product: Product): string {
  const candidates = [
    product.sku,
    product.id?.startsWith('shop-') ? product.id.slice(5) : '',
    product.meta?.legacySku,
    product.meta?.previousSku,
  ];

  for (const raw of candidates) {
    const direct = String(raw || '').trim().toUpperCase();
    const normalized = normalizeBaselinkerSku(raw);
    const id = BASELINKER_SKU_TO_ID[direct] || BASELINKER_SKU_TO_ID[normalized];
    if (id) return id;
  }

  return '';
}

/**
 * Tag B — prosta reguła:
 * - tylko SKU obecne w aktualnym eksporcie BaseLinker,
 * - meta.baselinkerProductId jest opisem powiązania, ale nie wystarcza bez SKU z indeksu.
 */
export function hasBaselinkerLink(product: Product): boolean {
  return Boolean(baselinkerIdForProduct(product));
}

export function baselinkerLinkLabel(product: Product): string | null {
  if (!hasBaselinkerLink(product)) return null;

  const meta = normalizeProductMeta(product.meta);
  const id = (meta?.baselinkerProductId ?? '').trim() || baselinkerIdForProduct(product);
  if (id) return `Base #${id}`;

  return 'Base';
}
