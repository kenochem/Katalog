import { supabase, isSupabaseConfigured, STORAGE_BUCKET } from './supabase';
import { getLocalProducts, saveLocalProduct, mergeProducts } from './localStore';
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

let localCache: Product[] | null = null;
let shopCache: Product[] | null = null;

async function loadBaseProducts(catalog: CatalogType = 'accessories'): Promise<Product[]> {
  if (catalog === 'shop') {
    if (shopCache) return shopCache;
    try {
      const res = await fetch('/data/shop-products.json');
      if (!res.ok) return [];
      shopCache = ((await res.json()) as Product[]).map((p) => ({
        ...p,
        catalog: 'shop' as const,
      }));
      return shopCache;
    } catch {
      return [];
    }
  }

  if (localCache) return localCache;
  const res = await fetch('/data/products.json');
  localCache = ((await res.json()) as Product[]).map((p) => ({
    ...p,
    catalog: p.catalog || 'accessories',
  }));
  return localCache;
}

export async function fetchProducts(catalog?: CatalogType): Promise<Product[]> {
  const local = getLocalProducts();

  if (!isSupabaseConfigured || !supabase) {
    if (catalog) {
      const base = await loadBaseProducts(catalog);
      return mergeProducts(base, local.filter((p) => (p.catalog || 'accessories') === catalog));
    }
    const [acc, shop] = await Promise.all([
      loadBaseProducts('accessories'),
      loadBaseProducts('shop'),
    ]);
    return mergeProducts([...acc, ...shop], local);
  }

  const all: ProductRow[] = [];
  const pageSize = 1000;
  let from = 0;

  while (true) {
    let pageQuery = supabase.from('products').select('*').order('sku');
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
      return mergeProducts(base, local.filter((p) => (p.catalog || 'accessories') === catalog));
    }
    const base = await loadBaseProducts('accessories');
    return mergeProducts(base, local);
  }

  const mapped = all.map(rowToProduct);
  const hasShop = mapped.some((p) => p.catalog === 'shop');
  let combined = mapped;
  if (!hasShop) {
    const shop = await loadBaseProducts('shop');
    combined = [...mapped, ...shop];
  }

  const localFiltered = catalog
    ? local.filter((p) => (p.catalog || 'accessories') === catalog)
    : local;
  const merged = mergeProducts(combined, localFiltered);
  if (catalog) {
    return merged.filter((p) => (p.catalog || 'accessories') === catalog);
  }
  return merged;
}

export async function fetchProductById(productId: string): Promise<Product | null> {
  if (!isSupabaseConfigured || !supabase) {
    const [acc, shop] = await Promise.all([
      loadBaseProducts('accessories'),
      loadBaseProducts('shop'),
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

    const { error } = await supabase
      .from('products')
      .update(row)
      .eq('id', productId);
    if (error) throw error;
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
  const ext = file.name.split('.').pop() || 'jpg';
  const path = suffix
    ? `products/${productId}-${suffix}.${ext}`
    : `products/${productId}.${ext}`;

  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, file, { upsert: true, contentType: file.type });
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

export async function addProductExtraImage(
  productId: string,
  file: File,
): Promise<string> {
  const url = await uploadProductImageFile(productId, file, `extra-${Date.now()}`);
  const existing = await getExistingProduct(productId);
  const extras = [...(existing?.extraImageUrls || []), url];
  await updateProduct(productId, {
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
