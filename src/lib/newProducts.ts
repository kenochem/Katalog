import { supabase } from './supabase';
import { rowToProduct, type ProductRow } from './db';
import type { Product } from '../types';

const SELECT_COLUMNS =
  'id,sku,name,display_name,category,manufacturer,ean,image_url,custom_image_url,extra_images,description,has_image,stock,stock_manual,price_purchase_net,price_sale_net,price_sale_gross,tags,catalog,variants,is_group,warehouse_location,product_meta';

/** Domyślne okno „Nowości” — starsze auto-importy trafiają do zwykłego katalogu/„Bez zdjęć”. */
const DEFAULT_WINDOW_DAYS = 30;

export function windowCutoffIso(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

export interface NewProductsDateRange {
  /** ISO od (włącznie). Domyślnie ostatnie 30 dni. */
  from?: string;
  /** ISO do (włącznie). Domyślnie teraz. */
  to?: string;
}

/**
 * Produkty dopisane automatycznie przez sync WAPRO (Invoke-WaproMagAutoImport)
 * w podanym zakresie dat, czyli te oznaczone w product_meta jako
 * waproImport=true z waproImportedAt w zakresie. Posortowane od najnowszych —
 * do zakładki „Nowości”. Starsze/niedokończone pozycje nadal widać w filtrze
 * „Bez zdjęć” w katalogu, więc zawężenie zakresu nie gubi niczego trwale.
 */
export async function getRecentlyImportedProducts(
  opts?: NewProductsDateRange & { limit?: number },
): Promise<Product[]> {
  if (!supabase) return [];
  const from = opts?.from ?? windowCutoffIso(DEFAULT_WINDOW_DAYS);
  let query = supabase
    .from('products')
    .select(SELECT_COLUMNS)
    .contains('product_meta', { waproImport: true })
    .gte('product_meta->>waproImportedAt', from);
  if (opts?.to) {
    query = query.lte('product_meta->>waproImportedAt', opts.to);
  }
  const { data, error } = await query
    .order('product_meta->>waproImportedAt', { ascending: false })
    .limit(opts?.limit ?? 500);

  if (error) {
    console.warn('getRecentlyImportedProducts', error.message);
    return [];
  }

  return ((data as ProductRow[]) ?? []).map(rowToProduct);
}

/** Lekkie liczenie (bez pobierania wierszy) — do plakietki w menu bocznym. */
export async function getRecentlyImportedProductsCount(
  opts?: NewProductsDateRange,
): Promise<number> {
  if (!supabase) return 0;
  const from = opts?.from ?? windowCutoffIso(DEFAULT_WINDOW_DAYS);
  let query = supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .contains('product_meta', { waproImport: true })
    .gte('product_meta->>waproImportedAt', from);
  if (opts?.to) {
    query = query.lte('product_meta->>waproImportedAt', opts.to);
  }
  const { count, error } = await query;
  if (error) {
    console.warn('getRecentlyImportedProductsCount', error.message);
    return 0;
  }
  return count ?? 0;
}
