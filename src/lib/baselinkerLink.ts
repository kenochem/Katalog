/** Czy produkt jest powiązany z ofertą BaseLinker (katalog shop / eksport BL). */
import type { Product } from '../types';
import { normalizeProductMeta } from './productMeta';

/** Pozycja z eksportu BaseLinker — katalog „Produkty” (shop), id shop-SKU. */
export function isBaselinkerCatalogProduct(product: Product): boolean {
  if ((product.catalog || 'accessories') === 'shop') return true;
  return Boolean(product.id?.startsWith('shop-'));
}

/**
 * Tag B — prosta reguła:
 * - cały katalog shop (eksport BaseLinker) = BaseLinker,
 * - pozycje WAPRO z meta.baselinkerProductId (ręczne powiązanie).
 */
export function hasBaselinkerLink(product: Product): boolean {
  if (isBaselinkerCatalogProduct(product)) return true;

  const meta = normalizeProductMeta(product.meta);
  const id = (meta?.baselinkerProductId ?? '').trim();
  return Boolean(id);
}

export function baselinkerLinkLabel(product: Product): string | null {
  if (!hasBaselinkerLink(product)) return null;

  const meta = normalizeProductMeta(product.meta);
  const id = (meta?.baselinkerProductId ?? '').trim();
  if (id) return `Base #${id}`;

  if (isBaselinkerCatalogProduct(product)) return 'Katalog BL';

  return 'Base';
}
