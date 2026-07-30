export type CatalogType = 'accessories' | 'shop';

export interface ProductVariant {
  sku: string;
  name: string;
  ean?: string;
  /** Stan magazynowy tego SKU (w grupach dysz itd.) */
  stock?: number;
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
  catalog: CatalogType;
  variants?: ProductVariant[];
  isGroup?: boolean;
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
  | 'catalog'
  | 'kits'
  | 'missing-images'
  | 'progress'
  | 'favorites'
  | 'labels'
  | 'admin'
  | 'crm';

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

export function deriveCategories(products: Product[]): string[] {
  const counts = new Map<string, number>();
  for (const p of products) {
    counts.set(p.category, (counts.get(p.category) || 0) + 1);
  }
  const cats = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pl'))
    .map(([c]) => c);
  return ['Wszystkie', ...cats];
}
