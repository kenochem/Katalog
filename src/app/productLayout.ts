import type { View } from '../types';
import { APP_PRODUCT, moduleEnabled, type AppProduct } from './moduleRegistry';

/** Czy pokazać przełącznik Akcesoria / Produkty w nagłówku. */
export function showsCatalogSwitcher(): boolean {
  return (
    moduleEnabled('catalog') &&
    APP_PRODUCT !== 'ops' &&
    APP_PRODUCT !== 'sell' &&
    APP_PRODUCT !== 'stock'
  );
}

/** Katalog jako osobny produkt (nie Suite / Sell). */
export function isCatalogProduct(): boolean {
  return APP_PRODUCT === 'catalog' || APP_PRODUCT === 'stock';
}

export function isStockProduct(): boolean {
  return APP_PRODUCT === 'stock';
}

export function getInitialView(): View {
  switch (APP_PRODUCT as AppProduct) {
    case 'ops':
      return 'ops';
    case 'sell':
      return 'crm';
    case 'stock':
      return 'warehouse';
    default:
      return moduleEnabled('catalog') ? 'home' : 'catalog';
  }
}

/** Liczba kolumn w górnym switcherze (Operacje / CRM — bez Akcesoria/Produkty). */
export function modeSwitcherColumns(roleOps: boolean, roleCrm: boolean): number {
  if (!showsCatalogSwitcher()) return 1;
  let cols = 0;
  if (roleOps && moduleEnabled('ops')) cols += 1;
  if (roleCrm && moduleEnabled('crm')) cols += 1;
  return cols;
}

export const PRODUCT_URLS: Record<
  AppProduct,
  { label: string; href: string } | null
> = {
  catalog: { label: 'Suite', href: 'https://kenochem-f4a5b.web.app' },
  suite: null,
  sell: { label: 'Talk', href: 'https://kenochem-talk.web.app' },
  stock: { label: 'Suite', href: 'https://kenochem-f4a5b.web.app' },
  ops: { label: 'Suite', href: 'https://kenochem-f4a5b.web.app' },
  talk: { label: 'Suite', href: 'https://kenochem-f4a5b.web.app' },
  logistics: { label: 'Suite', href: 'https://kenochem-f4a5b.web.app' },
  calendar: { label: 'Suite', href: 'https://kenochem-f4a5b.web.app' },
};
