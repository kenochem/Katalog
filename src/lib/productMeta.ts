/** Pola rozszerzone (inspirowane BaseLinker — waga, wymiary, parametry, notatki). */
export interface ProductMeta {
  baselinkerProductId?: string;
  weightKg?: number;
  widthCm?: number;
  heightCm?: number;
  depthCm?: number;
  unit?: string;
  vatRate?: number;
  shortDescription?: string;
  internalNote?: string;
  /** Poprzedni / błędny kod (np. BL…) — sync WAPRO próbuje też ten indeks. */
  legacySku?: string;
  /** Jawny indeks WAPRO, gdy różni się od SKU w katalogu. */
  waproSku?: string;
  /** @deprecated alias legacySku */
  previousSku?: string;
  /** Ścieżka kategorii ze sklepu WP (pełne drzewo). */
  shopCategoryPath?: string;
  /** Import opisów z BaseLinkera bez konieczności wożenia pełnego HTML-a na liście. */
  baselinkerDescriptionImportedAt?: string;
  baselinkerDescriptionChars?: number;
  baselinkerDescriptionFull?: boolean;
  parameters?: Record<string, string>;
  /** Ostatnia aktualizacja z zewnętrznego bota (API wiedzy). */
  knowledgeBotLast?: { source: string; at: string; fields: string[] };
  /** Pozycja założona automatycznie z Mag WAPRO — do uzupełnienia zdjęcia/opisu. */
  waproImport?: boolean;
  waproSkeleton?: boolean;
  waproImportedAt?: string;
  /** Nie sumuj w analizie sprzedaży Ops (np. rozpis składników / kwiatek na FV). */
  salesExcludeFromSum?: boolean;
  /** Produkt celowo wycofany z widoku katalogu, ale zostaje w bazie i syncu. */
  catalogHidden?: boolean;
  /** Krótki powód ukrycia, np. stara marka, produkt przestarzały. */
  catalogHiddenReason?: string;
  catalogHiddenAt?: string;
}

export const PRODUCT_META_LABELS: Record<
  Exclude<
    keyof ProductMeta,
    | 'knowledgeBotLast'
    | 'parameters'
    | 'shopCategoryPath'
    | 'baselinkerDescriptionImportedAt'
    | 'baselinkerDescriptionChars'
    | 'baselinkerDescriptionFull'
    | 'waproImport'
    | 'waproSkeleton'
    | 'waproImportedAt'
    | 'salesExcludeFromSum'
    | 'catalogHidden'
    | 'catalogHiddenAt'
  >,
  string
> & { parameters: string } = {
  baselinkerProductId: 'ID BaseLinker',
  weightKg: 'Waga (kg)',
  widthCm: 'Szerokość (cm)',
  heightCm: 'Wysokość (cm)',
  depthCm: 'Głębokość (cm)',
  unit: 'Jednostka',
  vatRate: 'Stawka VAT (%)',
  shortDescription: 'Krótki opis (oferta)',
  internalNote: 'Notatka wewnętrzna',
  legacySku: 'Poprzedni SKU (sync WAPRO)',
  waproSku: 'Indeks WAPRO (jeśli inny niż SKU)',
  previousSku: 'Poprzedni SKU (legacy)',
  catalogHiddenReason: 'Powód ukrycia',
  parameters: 'Parametry',
};

export function normalizeProductMeta(raw: unknown): ProductMeta | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  const meta: ProductMeta = {};

  const str = (k: keyof ProductMeta) => {
    const v = o[k];
    if (typeof v === 'string' && v.trim()) meta[k] = v.trim() as never;
  };
  const num = (k: 'weightKg' | 'widthCm' | 'heightCm' | 'depthCm' | 'vatRate') => {
    const v = o[k];
    const n = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v.replace(',', '.')) : NaN;
    if (Number.isFinite(n)) meta[k] = n;
  };

  str('baselinkerProductId');
  str('legacySku');
  str('waproSku');
  str('previousSku');
  str('unit');
  str('shortDescription');
  str('internalNote');
  str('shopCategoryPath');
  str('baselinkerDescriptionImportedAt');
  str('waproImportedAt');
  str('catalogHiddenReason');
  str('catalogHiddenAt');
  num('weightKg');
  num('widthCm');
  num('heightCm');
  num('depthCm');
  num('vatRate');
  {
    const v = o.baselinkerDescriptionChars;
    const n = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v.replace(',', '.')) : NaN;
    if (Number.isFinite(n)) meta.baselinkerDescriptionChars = n;
  }

  if (o.parameters && typeof o.parameters === 'object' && !Array.isArray(o.parameters)) {
    const params: Record<string, string> = {};
    for (const [key, val] of Object.entries(o.parameters as Record<string, unknown>)) {
      const k = key.trim();
      const s = val != null ? String(val).trim() : '';
      if (k && s) params[k] = s;
    }
    if (Object.keys(params).length > 0) meta.parameters = params;
  }

  if (typeof o.waproImport === 'boolean') meta.waproImport = o.waproImport;
  if (typeof o.waproSkeleton === 'boolean') meta.waproSkeleton = o.waproSkeleton;
  if (typeof o.baselinkerDescriptionFull === 'boolean') meta.baselinkerDescriptionFull = o.baselinkerDescriptionFull;
  if (typeof o.salesExcludeFromSum === 'boolean') meta.salesExcludeFromSum = o.salesExcludeFromSum;
  if (typeof o.catalogHidden === 'boolean') meta.catalogHidden = o.catalogHidden;

  return Object.keys(meta).length > 0 ? meta : undefined;
}

export function isCatalogHiddenProduct(product: { meta?: ProductMeta }): boolean {
  return product.meta?.catalogHidden === true;
}

/** Pozycja z Mag WAPRO bez zdjęcia — do ręcznego uzupełnienia w katalogu. */
export function isWaproSkeletonProduct(product: {
  meta?: ProductMeta;
  tags?: string[];
  imageUrl?: string;
  customImageUrl?: string;
  hasImage?: boolean;
}): boolean {
  if (product.meta?.waproSkeleton) return true;
  const tags = product.tags ?? [];
  if (tags.includes('do-uzupelnienia') && tags.includes('wapro-import')) {
    return !(product.customImageUrl || product.imageUrl || product.hasImage);
  }
  return false;
}

export function mergeProductMeta(base: ProductMeta | undefined, patch: ProductMeta): ProductMeta {
  return {
    ...base,
    ...patch,
    parameters: {
      ...base?.parameters,
      ...patch.parameters,
    },
  };
}

export function formatDimensions(meta: ProductMeta | undefined): string {
  if (!meta) return '';
  const parts: string[] = [];
  if (meta.widthCm != null) parts.push(`${meta.widthCm} ×`);
  if (meta.heightCm != null) parts.push(`${meta.heightCm} ×`);
  if (meta.depthCm != null) parts.push(String(meta.depthCm));
  const joined = parts.join(' ').replace(/ × $/, '').replace(/× /g, '×').trim();
  if (joined.endsWith('×')) return joined.slice(0, -1).trim();
  return joined.includes('×') ? `${joined} cm` : '';
}

export function parseParametersText(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    const sep = t.includes('\t') ? '\t' : t.includes(':') ? ':' : null;
    if (!sep) continue;
    const [k, ...rest] = sep === '\t' ? t.split('\t') : t.split(':');
    const key = k?.trim();
    const val = rest.join(sep === ':' ? ':' : '').trim();
    if (key && val) out[key] = val;
  }
  return out;
}

export function parametersToText(params: Record<string, string> | undefined): string {
  if (!params) return '';
  return Object.entries(params)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');
}
