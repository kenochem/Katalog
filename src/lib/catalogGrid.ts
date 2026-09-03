import { getCachedCatalogPreferences } from './userPreferences';

export type GridDensity = 'sm' | 'md' | 'lg';

export const GRID_DENSITY_KEY = 'katalog-grid-density';

export const GRID_DENSITY_CLASS: Record<GridDensity, string> = {
  sm: 'grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8',
  md: 'grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6',
  lg: 'grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4',
};

export function loadGridDensity(): GridDensity {
  const cached = getCachedCatalogPreferences().gridDensity;
  if (cached === 'sm' || cached === 'md' || cached === 'lg') return cached;
  try {
    const v = localStorage.getItem(GRID_DENSITY_KEY);
    if (v === 'sm' || v === 'md' || v === 'lg') return v;
  } catch {
    /* ignore */
  }
  return 'md';
}

export function saveGridDensity(next: GridDensity): void {
  try {
    localStorage.setItem(GRID_DENSITY_KEY, next);
  } catch {
    /* ignore */
  }
}
