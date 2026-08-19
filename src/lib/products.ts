import { supabase, isSupabaseConfigured, STORAGE_BUCKET } from './supabase';
import { getLocalProducts, saveLocalProduct, mergeProducts, hideProductId, removeLocalProduct, getHiddenProductIds } from './localStore';
import {
  rowToProduct,
  productToRow,
  rowToKit,
  kitToRow,
  type ProductRow,
  type KitRow,
} from './db';
import type { Product, Kit } from '../types';
import type { CatalogType } from '../types';
import type { ProductMeta } from './productMeta';

let localCache: Product[] | null = null;
let shopCache: Product[] | null = null;
let accessorySkuCache: Set<string> | null = null;

/** Cache w pamięci — unika ponownego pobierania z Supabase przy przełączaniu widoków. */
const FETCH_TTL_MS = 15 * 60_000;

export type ProductFetchSource = 'json' | 'supabase';
const fetchMem = new Map<string, { at: number; data: Product[]; inflight?: Promise<Product[]> }>();

function fetchCacheKey(catalog?: CatalogType): string {
  return catalog || 'all';
}

export function invalidateProductsCache(catalog?: CatalogType): void {
  if (catalog) {
    fetchMem.delete(`${catalog}:json`);
    fetchMem.delete(`${catalog}:supabase`);
  } else {
    fetchMem.clear();
  }
  void import('./productSearchIndex').then((m) => m.invalidateProductSearchIndex());
}

/** SKU z katalogu Akcesoria (WAPRO) — nie dublujemy ich w Produktach. */
async function getAccessorySkuSet(): Promise<Set<string>> {
  if (accessorySkuCache) return accessorySkuCache;
  const acc = await loadBaseProducts('accessories');
  const set = new Set<string>();
  for (const p of acc) {
    if (p.sku) set.add(String(p.sku).toUpperCase());
    for (const v of p.variants || []) {
      if (v.sku) set.add(String(v.sku).toUpperCase());
    }
  }
  accessorySkuCache = set;
  return set;
}

/**
 * Produkty = cały Baselinker poza pozycjami, które są już w Akcesoriach (WAPRO).
 * Nie filtrujemy po kategorii BL „Akcesoria sklepowe” — tam jest też chemia.
 */
export function isShopProductAllowed(p: Product, accessorySkus?: Set<string>): boolean {
  if ((p.catalog || 'accessories') !== 'shop') return true;
  if (!accessorySkus || accessorySkus.size === 0) return true;
  const sku = String(p.sku || '').toUpperCase();
  if (sku && accessorySkus.has(sku)) return false;
  return true;
}

function filterShopProducts(list: Product[], accessorySkus?: Set<string>): Product[] {
  return list.filter((p) => isShopProductAllowed(p, accessorySkus));
}

function withoutHiddenProducts(list: Product[]): Product[] {
  const hidden = getHiddenProductIds();
  if (!hidden.size) return list;
  return list.filter((p) => !hidden.has(p.id));
}

function visibleShopProducts(list: Product[], accessorySkus?: Set<string>): Product[] {
  return filterShopProducts(withoutHiddenProducts(list), accessorySkus);
}

function lightProductMeta(meta?: ProductMeta): ProductMeta | undefined {
  if (!meta) return undefined;
  const light: ProductMeta = {};
  for (const key of [
    'baselinkerProductId',
    'legacySku',
    'waproSku',
    'previousSku',
    'shopCategoryPath',
    'baselinkerDescriptionImportedAt',
    'baselinkerDescriptionChars',
    'catalogHiddenReason',
    'catalogHiddenAt',
  ] as const) {
    if (meta[key] != null && meta[key] !== '') {
      (light as Record<string, unknown>)[key] = meta[key];
    }
  }
  if (typeof meta.baselinkerDescriptionFull === 'boolean') {
    light.baselinkerDescriptionFull = meta.baselinkerDescriptionFull;
  }
  if (typeof meta.waproImport === 'boolean') light.waproImport = meta.waproImport;
  if (typeof meta.waproSkeleton === 'boolean') light.waproSkeleton = meta.waproSkeleton;
  if (typeof meta.salesExcludeFromSum === 'boolean') {
    light.salesExcludeFromSum = meta.salesExcludeFromSum;
  }
  if (typeof meta.catalogHidden === 'boolean') light.catalogHidden = meta.catalogHidden;
  return Object.keys(light).length ? light : undefined;
}

function toListProduct(product: Product): Product {
  return {
    ...product,
    description: '',
    meta: lightProductMeta(product.meta),
  };
}

async function loadBaseProducts(catalog: CatalogType = 'accessories'): Promise<Product[]> {
  if (catalog === 'shop') {
    if (shopCache) return shopCache;
    try {
      let res = await fetch('/data/shop-products-lite.json');
      if (!res.ok) res = await fetch('/data/shop-products.json');
      if (!res.ok) return [];
      const accessorySkus = await getAccessorySkuSet();
      shopCache = filterShopProducts(
        ((await res.json()) as Product[]).map((p) => ({
          ...toListProduct(p),
          catalog: 'shop' as const,
        })),
        accessorySkus,
      );
      return shopCache;
    } catch {
      return [];
    }
  }

  if (localCache) return localCache;
  let res = await fetch('/data/products-lite.json');
  if (!res.ok) res = await fetch('/data/products.json');
  localCache = ((await res.json()) as Product[]).map((p) => ({
    ...toListProduct(p),
    catalog: p.catalog || 'accessories',
  }));
  return localCache;
}

async function loadFullJsonProducts(catalog: CatalogType): Promise<Product[]> {
  const file = catalog === 'shop' ? '/data/shop-products.json' : '/data/products.json';
  try {
    const res = await fetch(file);
    if (!res.ok) return [];
    return ((await res.json()) as Product[]).map((p) => ({
      ...p,
      catalog,
    }));
  } catch {
    return [];
  }
}

export async function fetchProducts(
  catalog?: CatalogType,
  opts?: { force?: boolean; source?: ProductFetchSource },
): Promise<Product[]> {
  const key = fetchCacheKey(catalog);
  const source = opts?.source ?? 'json';
  const cacheKey = `${key}:${source}`;
  const hit = fetchMem.get(cacheKey);
  if (!opts?.force && hit) {
    if (hit.inflight) return hit.inflight;
    if (Date.now() - hit.at < FETCH_TTL_MS) return hit.data;
  }

  const inflight = (async () => {
    const data = await fetchProductsUncached(catalog, source);
    fetchMem.set(cacheKey, { at: Date.now(), data });
    return data;
  })();

  fetchMem.set(cacheKey, {
    at: hit?.at ?? 0,
    data: hit?.data ?? [],
    inflight,
  });

  try {
    return await inflight;
  } catch (err) {
    fetchMem.delete(cacheKey);
    throw err;
  }
}

async function fetchProductsUncached(
  catalog?: CatalogType,
  source: ProductFetchSource = 'json',
): Promise<Product[]> {
  const local = getLocalProducts();
  const accessorySkus = await getAccessorySkuSet();

  const fromJsonAndLocal = async (cat?: CatalogType): Promise<Product[]> => {
    if (cat) {
      const base = await loadBaseProducts(cat);
      return visibleShopProducts(
        mergeProducts(base, local.filter((p) => (p.catalog || 'accessories') === cat).map(toListProduct)),
        accessorySkus,
      );
    }
    const [acc, shop] = await Promise.all([
      loadBaseProducts('accessories'),
      loadBaseProducts('shop'),
    ]);
    return visibleShopProducts(mergeProducts([...acc, ...shop], local.map(toListProduct)), accessorySkus);
  };

  if (source !== 'supabase' || !isSupabaseConfigured || !supabase) {
    return fromJsonAndLocal(catalog);
  }

  const all: ProductRow[] = [];
  const pageSize = 1000;
  let from = 0;

  const LIST_SELECT =
    'id,sku,name,display_name,category,manufacturer,ean,image_url,custom_image_url,has_image,stock,stock_manual,price_purchase_net,price_sale_net,price_sale_gross,tags,catalog,variants,is_group,warehouse_location,product_meta';

  while (true) {
    let pageQuery = supabase.from('products').select(LIST_SELECT).order('sku');
    if (catalog) {
      pageQuery = pageQuery.eq('catalog', catalog);
    }
    const { data, error } = await pageQuery.range(from, from + pageSize - 1);

    if (error || !data?.length) break;
    all.push(...(data as ProductRow[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }

  if (!all.length) {
    if (catalog) {
      const base = await loadBaseProducts(catalog);
      return visibleShopProducts(
        mergeProducts(base, local.filter((p) => (p.catalog || 'accessories') === catalog).map(toListProduct)),
        accessorySkus,
      );
    }
    const base = await loadBaseProducts('accessories');
    return visibleShopProducts(mergeProducts(base, local.map(toListProduct)), accessorySkus);
  }

  const mapped = all.map(rowToProduct).map(toListProduct);
  const hasShop = mapped.some((p) => p.catalog === 'shop');
  let combined = mapped;
  if (!hasShop) {
    const shop = await loadBaseProducts('shop');
    combined = [...mapped, ...shop];
  }

  const localFiltered = catalog
    ? local.filter((p) => (p.catalog || 'accessories') === catalog)
    : local;
  const merged = mergeProducts(combined, localFiltered.map(toListProduct));
  const scoped = catalog
    ? merged.filter((p) => (p.catalog || 'accessories') === catalog)
    : merged;
  return visibleShopProducts(scoped, accessorySkus);
}

export async function fetchProductById(productId: string): Promise<Product | null> {
  if (!isSupabaseConfigured || !supabase) {
    const [acc, shop] = await Promise.all([
      loadFullJsonProducts('accessories'),
      loadFullJsonProducts('shop'),
    ]);
    return (
      [...acc, ...shop].find((p) => p.id === productId) ||
      getLocalProducts().find((p) => p.id === productId) ||
      null
    );
  }

  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', productId)
    .single();

  if (error || !data) return null;
  return rowToProduct(data as ProductRow);
}

export async function createProduct(
  data: Omit<Product, 'id' | 'hasImage'> & { id?: string },
  imageFile?: File,
): Promise<Product> {
  const sku = data.sku.trim().toUpperCase();
  const catalog = data.catalog || 'accessories';
  const id =
    data.id ||
    (catalog === 'shop' ? `shop-${sku}` : sku) ||
    `custom-${Date.now()}`;

  let customImageUrl = data.customImageUrl || '';
  if (imageFile) {
    customImageUrl = await uploadProductImageFile(id, imageFile);
  }

  const product: Product = {
    ...data,
    id,
    sku,
    catalog,
    hasImage: !!(customImageUrl || data.imageUrl || data.extraImageUrls?.length),
    customImageUrl: customImageUrl || undefined,
    stock: data.stock ?? 0,
    stockManual: data.stockManual ?? false,
  };

  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase
      .from('products')
      .upsert(productToRow(product));
    if (error) throw error;
  } else {
    saveLocalProduct(product);
  }

  return product;
}

export async function updateProduct(
  productId: string,
  updates: Partial<Product>,
): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    const row: Record<string, unknown> = {};
    if (updates.displayName !== undefined) row.display_name = updates.displayName;
    if (updates.category !== undefined) row.category = updates.category;
    if (updates.manufacturer !== undefined) row.manufacturer = updates.manufacturer;
    if (updates.description !== undefined) row.description = updates.description;
    if (updates.customImageUrl !== undefined) row.custom_image_url = updates.customImageUrl;
    if (updates.imageUrl !== undefined) row.image_url = updates.imageUrl;
    if (updates.hasImage !== undefined) row.has_image = updates.hasImage;
    if (updates.name !== undefined) row.name = updates.name;
    if (updates.ean !== undefined) row.ean = updates.ean;
    if (updates.stock !== undefined) row.stock = updates.stock;
    if (updates.stockManual !== undefined) row.stock_manual = updates.stockManual;
    if (updates.extraImageUrls !== undefined) row.extra_images = updates.extraImageUrls;
    if (updates.catalog !== undefined) row.catalog = updates.catalog;
    if (updates.sku !== undefined) row.sku = updates.sku.trim().toUpperCase();
    if (updates.pricePurchaseNet !== undefined) row.price_purchase_net = updates.pricePurchaseNet;
    if (updates.priceSaleNet !== undefined) row.price_sale_net = updates.priceSaleNet;
    if (updates.priceSaleGross !== undefined) row.price_sale_gross = updates.priceSaleGross;
    if (updates.warehouseLocation !== undefined) {
      row.warehouse_location = updates.warehouseLocation ?? null;
    }
    if (updates.meta !== undefined) {
      row.product_meta = updates.meta ?? {};
    }

    const { data, error } = await supabase
      .from('products')
      .update(row)
      .eq('id', productId)
      .select('id');
    if (error) throw error;

    if (!data?.length) {
      const existing = await fetchProductById(productId);
      if (!existing) {
        throw new Error('Nie znaleziono produktu do zapisu (brak w Supabase i w eksporcie JSON).');
      }
      const merged: Product = {
        ...existing,
        ...updates,
        sku: updates.sku !== undefined ? updates.sku.trim().toUpperCase() : existing.sku,
      };
      const { error: upsertErr } = await supabase
        .from('products')
        .upsert(productToRow(merged), { onConflict: 'id' });
      if (upsertErr) throw upsertErr;
      invalidateProductsCache(merged.catalog);
    } else {
      invalidateProductsCache(
        updates.catalog ?? (await fetchProductById(productId))?.catalog,
      );
    }
    return;
  }

  const local = getLocalProducts().find((p) => p.id === productId);
  const catalog = (updates.catalog || local?.catalog || 'accessories') as CatalogType;
  const base = await loadBaseProducts(catalog);
  const existing = base.find((p) => p.id === productId) || local;
  if (existing) {
    saveLocalProduct({ ...existing, ...updates, catalog: existing.catalog || catalog });
  }
}

async function uploadProductImageFile(
  productId: string,
  file: File,
  suffix = '',
): Promise<string> {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = suffix
    ? `products/${productId}-${suffix}.${ext}`
    : `products/${productId}.${ext}`;

  const contentType =
    file.type ||
    (ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg');

  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, file, { upsert: true, contentType });
    if (error) throw error;

    const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
    return data.publicUrl;
  }

  return fileToDataUrl(file);
}

async function removeStorageUrl(url: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  if (!url.includes('/storage/v1/object/public/')) return;

  const marker = '/product-images/';
  const idx = url.indexOf(marker);
  if (idx === -1) return;

  const path = url.slice(idx + marker.length);
  await supabase.storage.from(STORAGE_BUCKET).remove([path]);
}

function computeHasImage(product: Pick<Product, 'customImageUrl' | 'imageUrl' | 'extraImageUrls'>): boolean {
  return !!(
    product.customImageUrl ||
    product.imageUrl ||
    (product.extraImageUrls && product.extraImageUrls.length > 0)
  );
}

async function getExistingProduct(productId: string): Promise<Product | null> {
  return fetchProductById(productId);
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function updateProductImage(
  productId: string,
  file: File,
): Promise<string> {
  const url = await uploadProductImageFile(productId, file);
  const existing = await getExistingProduct(productId);
  await updateProduct(productId, {
    customImageUrl: url,
    hasImage: true,
    extraImageUrls: existing?.extraImageUrls,
  });
  return url;
}

export async function uploadProductImageRevertBackup(
  productId: string,
  file: File,
): Promise<string> {
  return uploadProductImageFile(productId, file, 'revert');
}

export async function addProductExtraImage(
  productId: string,
  file: File,
): Promise<string> {
  const url = await uploadProductImageFile(productId, file, `extra-${Date.now()}`);
  const existing = await getExistingProduct(productId);
  const extras = [...(existing?.extraImageUrls || []), url];
  const shouldUseAsPrimary = !existing?.customImageUrl && !existing?.imageUrl;
  await updateProduct(productId, {
    imageUrl: shouldUseAsPrimary ? url : existing?.imageUrl,
    extraImageUrls: extras,
    hasImage: true,
  });
  return url;
}

export async function deleteProductImage(productId: string): Promise<void> {
  const existing = await getExistingProduct(productId);
  if (!existing) return;

  if (existing.customImageUrl) {
    await removeStorageUrl(existing.customImageUrl);
    const next = {
      ...existing,
      customImageUrl: undefined,
      hasImage: computeHasImage({
        customImageUrl: undefined,
        imageUrl: existing.imageUrl,
        extraImageUrls: existing.extraImageUrls,
      }),
    };
    await updateProduct(productId, {
      customImageUrl: '',
      hasImage: next.hasImage,
    });
    return;
  }

  if (existing.imageUrl) {
    const next = {
      ...existing,
      imageUrl: '',
      hasImage: computeHasImage({
        customImageUrl: undefined,
        imageUrl: '',
        extraImageUrls: existing.extraImageUrls,
      }),
    };
    await updateProduct(productId, {
      imageUrl: '',
      hasImage: next.hasImage,
    });
    return;
  }

  if (!isSupabaseConfigured || !supabase) {
    saveLocalProduct({
      ...existing,
      customImageUrl: undefined,
      imageUrl: '',
      hasImage: computeHasImage({
        customImageUrl: undefined,
        imageUrl: '',
        extraImageUrls: existing.extraImageUrls,
      }),
    });
  }
}

export async function deleteProductExtraImage(
  productId: string,
  imageUrl: string,
): Promise<void> {
  const existing = await getExistingProduct(productId);
  if (!existing) return;

  await removeStorageUrl(imageUrl);
  const extras = (existing.extraImageUrls || []).filter((u) => u !== imageUrl);
  await updateProduct(productId, {
    extraImageUrls: extras,
    hasImage: computeHasImage({
      customImageUrl: existing.customImageUrl,
      imageUrl: existing.imageUrl,
      extraImageUrls: extras,
    }),
  });
}

export async function updateProductDisplayName(
  productId: string,
  displayName: string,
): Promise<void> {
  await updateProduct(productId, { displayName });
}

export async function fetchKits(): Promise<Kit[]> {
  if (!isSupabaseConfigured || !supabase) return [];

  const { data, error } = await supabase
    .from('kits')
    .select('*')
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return (data as KitRow[]).map(rowToKit);
}

export async function saveKit(kit: Omit<Kit, 'id'> & { id?: string }): Promise<string> {
  const id = kit.id || `kit-${Date.now()}`;
  const full: Kit = { ...kit, id } as Kit;

  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase nie skonfigurowany — zestawy wymagają bazy danych.');
  }

  const { error } = await supabase.from('kits').upsert(kitToRow(full));
  if (error) throw error;
  return id;
}

export async function deleteKit(kitId: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('kits').delete().eq('id', kitId);
  if (error) throw error;
}

export async function uploadKitImage(kitId: string, file: File): Promise<string> {
  if (!supabase) throw new Error('Supabase nie skonfigurowany');

  const ext = file.name.split('.').pop() || 'jpg';
  const path = `kits/${kitId}.${ext}`;

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;

  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  await supabase.from('kits').update({ image_url: data.publicUrl }).eq('id', kitId);
  return data.publicUrl;
}

export function getProductImage(product: Product): string | null {
  return product.customImageUrl || product.imageUrl || null;
}

export function getProductImages(product: Product): string[] {
  const primary = getProductImage(product);
  // Produkty (shop/chemia): tylko zdjęcie główne — dodatkowe niepotrzebne
  if (product.catalog === 'shop') {
    return primary ? [primary] : [];
  }
  const extras = product.extraImageUrls || [];
  if (!primary) return extras;
  return [primary, ...extras.filter((url) => url !== primary)];
}

export async function isProductSkuTaken(
  catalog: CatalogType,
  sku: string,
  excludeProductId?: string,
): Promise<boolean> {
  const normalized = sku.trim().toUpperCase();
  if (!normalized) return false;

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('products')
      .select('id')
      .eq('catalog', catalog)
      .eq('sku', normalized);
    if (error) throw error;
    return (data || []).some((row) => row.id !== excludeProductId);
  }

  const [acc, shop] = await Promise.all([
    loadBaseProducts('accessories'),
    loadBaseProducts('shop'),
  ]);
  const accessorySkus = await getAccessorySkuSet();
  const all = visibleShopProducts(
    mergeProducts([...acc, ...shop], getLocalProducts()),
    accessorySkus,
  );
  return all.some(
    (p) =>
      p.id !== excludeProductId &&
      (p.catalog || 'accessories') === catalog &&
      String(p.sku).toUpperCase() === normalized,
  );
}

export async function deleteProduct(productId: string): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.from('products').delete().eq('id', productId);
    if (error) throw error;
  }
  removeLocalProduct(productId);
  hideProductId(productId);
  invalidateProductsCache();
  try {
    const { clearPrimaryImageRevert } = await import('./productImageRevert');
    clearPrimaryImageRevert(productId);
  } catch {
    /* ignore */
  }
}
