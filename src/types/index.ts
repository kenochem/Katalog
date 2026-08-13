export type CatalogType = 'accessories' | 'shop';

import type { ProductMeta } from '../lib/productMeta';
import type { WarehouseLocation } from '../lib/warehouseLocation';
import { deriveShopCategoryOptions } from '../lib/shopCategoryTree';

export type { WarehouseLocation };

/** Filtr listy: oba katalogi naraz albo jeden z nich. */
export type CatalogListFilter = 'all' | CatalogType;

export interface ProductVariant {
  sku: string;
  name: string;
  ean?: string;
  /** Stan magazynowy tego SKU (w grupach dysz itd.) */
  stock?: number;
}

export interface WaproSalesPeriod {
  months: 1 | 3 | 6 | 12;
  qty: number;
  netValue?: number | null;
}

export interface WaproSalesMonthBucket {
  /** Klucz yyyy-MM (kalendarz). */
  month: string;
  qty: number;
  netValue?: number | null;
}

export interface WaproSalesPrevPeriod {
  qty: number;
  netValue?: number | null;
}

export interface WaproSalesResult {
  sku: string;
  skus?: string[];
  fetchedAt: string;
  periods: WaproSalesPeriod[];
  /** 12 miesięcy kalendarzowych (najstarszy → najnowszy). */
  monthly?: WaproSalesMonthBucket[];
  /** Rolling 12–24 m wstecz (do porównania z bieżącymi 12 m). */
  prev12m?: WaproSalesPrevPeriod;
  lastSaleDate?: string | null;
  source?: string;
  schemaVersion?: number;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  displayName: string;
  category: string;
  manufacturer: string;
  ean: string;
  imageUrl: string;
  customImageUrl?: string;
  extraImageUrls?: string[];
  description: string;
  hasImage: boolean;
  stock: number;
  stockManual?: boolean;
  /** Cena zakupu netto (WAPRO) */
  pricePurchaseNet?: number;
  /** Cena sprzedaży netto (WAPRO) */
  priceSaleNet?: number;
  /** Cena sprzedaży brutto (WAPRO) — sklep / klient */
  priceSaleGross?: number;
  /** Tag źródła / oznaczenia (np. Sonax = katalog z sonax.sklep.pl) */
  tags?: string[];
  catalog: CatalogType;
  variants?: ProductVariant[];
  isGroup?: boolean;
  warehouseLocation?: WarehouseLocation;
  meta?: ProductMeta;
  /** Cache statystyk sprzedaży Mag (sync zbiorczy) */
  waproSalesStats?: WaproSalesResult;
  waproSalesSyncedAt?: string;
}

export interface KitItem {
  productId: string;
  sku: string;
  name: string;
  quantity: number;
}

export interface Kit {
  id: string;
  name: string;
  description: string;
  category: string;
  items: KitItem[];
  imageUrl?: string;
  createdAt: number;
}

export type View =
  | 'home'
  | 'catalog'
  | 'collections'
  | 'kits'
  | 'missing-images'
  | 'progress'
  | 'favorites'
  | 'labels'
  | 'warehouse'
  | 'admin'
  | 'crm'
  | 'ops';

export const CATALOG_LABELS: Record<CatalogType, string> = {
  accessories: 'Akcesoria',
  shop: 'Produkty',
};

export const CATALOG_SUBTITLES: Record<CatalogType, string> = {
  accessories: 'Kenochem · drobnica / części do myjek',
  shop: 'Kenochem · chemia, banie i produkty sklepowe',
};

/** Kategorie katalogu akcesoriów (Wapro). */
export const ACCESSORY_CATEGORIES = [
  'Wszystkie',
  'Dysze',
  'Lance',
  'Węże',
  'Pianownice',
  'Pistolety',
  'Szybkozłącza',
  'Końcówki odkurzaczy',
  'Rurki',
  'Zbiorniki',
  'Opryskiwacze',
  'Zawory',
  'Adaptery',
  'Filtry',
  'Manometry',
  'Szczotki do myjni',
  'Zestawy piaskowania',
  'Trójniki',
  'Kolanka',
  'Przedłużacze',
  'Inne części',
] as const;

/** @deprecated używaj ACCESSORY_CATEGORIES albo deriveCategories() */
export const CATEGORIES = ACCESSORY_CATEGORIES;

function orderAccessoryCategories(categories: string[]): string[] {
  const order = ACCESSORY_CATEGORIES as readonly string[];
  const inList: string[] = [];
  const rest: string[] = [];
  for (const c of categories) {
    if (order.includes(c)) inList.push(c);
    else rest.push(c);
  }
  inList.sort((a, b) => order.indexOf(a) - order.indexOf(b));
  rest.sort((a, b) => a.localeCompare(b, 'pl'));
  return [...inList, ...rest];
}

export function deriveCategories(
  products: Product[],
  catalogListFilter: CatalogListFilter = 'all',
): string[] {
  const counts = new Map<string, number>();
  for (const p of products) {
    const c = p.category?.trim();
    if (c) counts.set(c, (counts.get(c) || 0) + 1);
  }

  const rest = [...counts.keys()].sort(
    (a, b) => (counts.get(b) || 0) - (counts.get(a) || 0) || a.localeCompare(b, 'pl'),
  );

  if (catalogListFilter === 'shop') {
    return deriveShopCategoryOptions(products);
  }

  if (catalogListFilter === 'accessories') {
    return ['Wszystkie', ...orderAccessoryCategories(rest)];
  }

  const shopProducts = products.filter((p) => (p.catalog || 'accessories') === 'shop');
  const accProducts = products.filter((p) => (p.catalog || 'accessories') !== 'shop');

  if (shopProducts.length && accProducts.length) {
    const shopCats = deriveShopCategoryOptions(shopProducts).filter((c) => c !== 'Wszystkie');
    const accCats = orderAccessoryCategories(
      [...new Set(accProducts.map((p) => p.category?.trim()).filter(Boolean) as string[])],
    );
    const seen = new Set(shopCats);
    const mergedAcc = accCats.filter((c) => !seen.has(c));
    return ['Wszystkie', ...shopCats, ...mergedAcc];
  }

  if (shopProducts.length) {
    return deriveShopCategoryOptions(shopProducts);
  }

  return ['Wszystkie', ...orderAccessoryCategories(rest)];
}
