import type { CatalogListFilter } from '../types';
import type { CatalogType } from '../types';

export function catalogFilterNeedsAccessories(
  filter: CatalogListFilter,
): boolean {
  return filter === 'all' || filter === 'accessories';
}

export function catalogFilterNeedsShop(filter: CatalogListFilter): boolean {
  return filter === 'all' || filter === 'shop';
}

export function primaryCatalogForFilter(
  filter: CatalogListFilter,
): CatalogType | null {
  if (filter === 'accessories') return 'accessories';
  if (filter === 'shop') return 'shop';
  return null;
}
