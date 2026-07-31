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
  | 'crm'
  | 'ean-hygiene'
  | 'role-matrix'
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

export function deriveCategories(products: Product[]): string[] {
  const counts = new Map<string, number>();
  for (const p of products) {
    counts.set(p.category, (counts.get(p.category) || 0) + 1);
  }

  const isShop = products.some((p) => (p.catalog || 'accessories') === 'shop');
  /** Produkty: najważniejsze kategorie handlowe na początku. */
  const shopPriority = [
    'Chemia',
    'Odświeżacze',
    'Abel Auto',
    'Dom i ogród',
    'Smary',
    'Mycie i dezynfekcja',
    'Inne',
  ];

  const rest = [...counts.keys()].sort(
    (a, b) => (counts.get(b) || 0) - (counts.get(a) || 0) || a.localeCompare(b, 'pl'),
  );

  if (!isShop) {
    return ['Wszystkie', ...rest];
  }

  const prioritized: string[] = [];
  for (const name of shopPriority) {
    if (counts.has(name)) prioritized.push(name);
  }
  for (const name of rest) {
    if (!prioritized.includes(name)) prioritized.push(name);
  }
  return ['Wszystkie', ...prioritized];
}
