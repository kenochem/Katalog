/**
 * Produkty Kenochem: ktore moduly wchodza do danego buildu.
 * Domyslnie `suite` = pelny hub.
 */

export type AppProduct =
  | 'catalog'
  | 'suite'
  | 'sell'
  | 'stock'
  | 'ops'
  | 'talk'
  | 'logistics'
  | 'calendar';

export type HubModuleId = 'catalog' | 'crm' | 'ops' | 'comms' | 'calendar';

/** Talk wyłączony tymczasowo — zero pollingu, Realtime i Storage z Supabase. */
export const TALK_SUSPENDED = true;

const ENV_PRODUCT = import.meta.env.VITE_APP_PRODUCT;

function parseAppProduct(): AppProduct {
  switch (ENV_PRODUCT) {
    case 'catalog':
    case 'sell':
    case 'stock':
    case 'ops':
    case 'talk':
    case 'logistics':
    case 'calendar':
      return ENV_PRODUCT;
    default:
      return 'suite';
  }
}

export const APP_PRODUCT = parseAppProduct();

const MODULES_BY_PRODUCT: Record<AppProduct, readonly HubModuleId[]> = {
  catalog: ['catalog'],
  stock: ['catalog'],
  suite: TALK_SUSPENDED
    ? ['catalog', 'crm', 'ops', 'calendar']
    : ['catalog', 'crm', 'ops', 'comms', 'calendar'],
  sell: TALK_SUSPENDED ? ['catalog', 'crm'] : ['catalog', 'crm', 'comms'],
  ops: ['ops'],
  talk: TALK_SUSPENDED ? [] : ['comms'],
  logistics: [],
  calendar: ['calendar'],
};

export const ENABLED_MODULES: readonly HubModuleId[] =
  MODULES_BY_PRODUCT[APP_PRODUCT];

export const BUILD_HAS_CRM =
  APP_PRODUCT === 'suite' || APP_PRODUCT === 'sell';
export const BUILD_HAS_OPS = APP_PRODUCT === 'suite' || APP_PRODUCT === 'ops';
export const BUILD_HAS_COMMS =
  !TALK_SUSPENDED &&
  (APP_PRODUCT === 'suite' ||
    APP_PRODUCT === 'talk' ||
    APP_PRODUCT === 'sell');
export const BUILD_HAS_CATALOG =
  APP_PRODUCT === 'catalog' ||
  APP_PRODUCT === 'stock' ||
  APP_PRODUCT === 'suite' ||
  APP_PRODUCT === 'sell';
export const BUILD_HAS_CALENDAR =
  APP_PRODUCT === 'suite' || APP_PRODUCT === 'calendar';

export function moduleEnabled(id: HubModuleId): boolean {
  return ENABLED_MODULES.includes(id);
}

export interface ProductBranding {
  appTitle: string;
  headerTitle: string;
  manifestName: string;
  manifestShortName: string;
  description: string;
}

export const PRODUCT_BRANDING: Record<AppProduct, ProductBranding> = {
  catalog: {
    appTitle: 'Katalog - Kenochem',
    headerTitle: 'Katalog',
    manifestName: 'Kenochem Katalog',
    manifestShortName: 'Katalog',
    description:
      'Katalog produktow Kenochem - stany, etykiety, wyszukiwanie, zdjecia',
  },
  stock: {
    appTitle: 'Magazyn - Kenochem',
    headerTitle: 'Magazyn',
    manifestName: 'Kenochem Magazyn',
    manifestShortName: 'Magazyn',
    description: 'Stany, sync WAPRO, etykiety i zdjecia - modul magazynu',
  },
  suite: {
    appTitle: 'Suite - Kenochem',
    headerTitle: 'Kenochem Suite',
    manifestName: 'Kenochem Suite',
    manifestShortName: 'Suite',
    description: 'Katalog, CRM, operacje i czat - pelny hub Kenochem',
  },
  sell: {
    appTitle: 'Handel - Kenochem',
    headerTitle: 'Handel',
    manifestName: 'Kenochem Handel',
    manifestShortName: 'Handel',
    description: 'CRM, oferty, mapa tras i katalog produktow',
  },
  ops: {
    appTitle: 'Operacje - Kenochem',
    headerTitle: 'Operacje',
    manifestName: 'Kenochem Operacje',
    manifestShortName: 'Operacje',
    description: 'Finanse firmy, marze i analityka',
  },
  talk: {
    appTitle: 'Talk - Kenochem',
    headerTitle: 'Talk',
    manifestName: 'Kenochem Talk',
    manifestShortName: 'Talk',
    description: 'Czat zespolu Kenochem',
  },
  logistics: {
    appTitle: 'Logistyka - Kenochem',
    headerTitle: 'Logistyka',
    manifestName: 'Kenochem Logistyka',
    manifestShortName: 'Logistyka',
    description: 'Dostawy i trasy - w przygotowaniu',
  },
  calendar: {
    appTitle: 'Kalendarz - Kenochem',
    headerTitle: 'Kalendarz',
    manifestName: 'Kenochem Kalendarz',
    manifestShortName: 'Kalendarz',
    description: 'Plan firmy, wizyty, dostawy, raporty i wydarzenia',
  },
};

export const branding = PRODUCT_BRANDING[APP_PRODUCT];

export const ALL_APP_PRODUCTS: AppProduct[] = [
  'catalog',
  'suite',
  'sell',
  'stock',
  'ops',
  'talk',
  'logistics',
  'calendar',
];

export const HOSTING_SITE_BY_PRODUCT: Record<AppProduct, string> = {
  catalog: 'kenochem-katalog',
  suite: 'kenochem-f4a5b',
  sell: 'kenochem-sell',
  stock: 'kenochem-stock',
  ops: 'kenochem-ops',
  talk: 'kenochem-talk',
  logistics: 'kenochem-logistics',
  calendar: 'kenochem-calendar',
};
