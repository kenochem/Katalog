import type { Product } from '../types';
import { formatLocationCode } from './warehouseLocation';
import { resolveProductLocation } from './locationStore';
import { customerGrossPrice } from './format';
import { getProductDisplayCategory } from './catalogCategory';
import { effectiveManufacturer } from './waproManufacturers';

const QUEUE_KEY = 'katalog-label-queue';

export interface LabelQueueItem {
  id: string;
  sku: string;
  displayName: string;
  ean: string;
  catalog: string;
  /** Adres magazynowy na etykiecie */
  locationCode?: string;
  /** Liczba kopii etykiety (domyślnie 1). */
  qty?: number;
  /** Cena brutto na etykiecie (jeśli włączona w konfiguracji). */
  priceGross?: number | null;
  manufacturer?: string;
  category?: string;
  stock?: number;
}

function readQueue(): LabelQueueItem[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as LabelQueueItem[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(items: LabelQueueItem[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
}

export function getLabelQueue(): LabelQueueItem[] {
  return readQueue();
}

function locationForProduct(product: Product): string {
  return formatLocationCode(
    resolveProductLocation(product.id, product.warehouseLocation),
  );
}

function extraFields(product: Product): Pick<
  LabelQueueItem,
  'priceGross' | 'manufacturer' | 'category' | 'stock'
> {
  return {
    priceGross: customerGrossPrice(product.priceSaleGross, product.priceSaleNet, product.meta?.vatRate),
    manufacturer: effectiveManufacturer(product) || product.manufacturer || undefined,
    category: getProductDisplayCategory(product) || undefined,
    stock: product.stock ?? undefined,
  };
}

function pushProduct(queue: LabelQueueItem[], product: Product): void {
  const code = (product.ean || product.sku || '').trim();
  const loc = locationForProduct(product);
  const prev = queue.find((q) => q.id === product.id);
  const idx = queue.findIndex((q) => q.id === product.id);
  if (idx >= 0) queue.splice(idx, 1);
  queue.push({
    id: product.id,
    sku: product.sku,
    displayName: product.displayName,
    ean: code,
    catalog: product.catalog || 'accessories',
    locationCode: loc || undefined,
    qty: prev?.qty ?? 1,
    ...extraFields(product),
  });
  // dla grup — dodaj też warianty z EAN/SKU
  if (product.isGroup && product.variants?.length) {
    for (const v of product.variants) {
      const vid = `${product.id}::${v.sku}`;
      if (queue.some((q) => q.id === vid)) continue;
      queue.push({
        id: vid,
        sku: v.sku,
        displayName: v.name || product.displayName,
        ean: (v.ean || v.sku).trim(),
        catalog: product.catalog || 'accessories',
        locationCode: loc || undefined,
        qty: 1,
        ...extraFields(product),
      });
    }
  }
}

export function addToLabelQueue(product: Product): LabelQueueItem[] {
  const queue = readQueue();
  pushProduct(queue, product);
  writeQueue(queue);
  return queue;
}

/** Dodaje wiele produktów naraz (zaznaczenie z listy w Studiu etykiet). */
export function addProductsToLabelQueue(products: Product[]): LabelQueueItem[] {
  const queue = readQueue();
  for (const p of products) pushProduct(queue, p);
  writeQueue(queue);
  return queue;
}

export function setLabelQty(id: string, qty: number): LabelQueueItem[] {
  const next = readQueue().map((q) =>
    q.id === id ? { ...q, qty: Math.max(1, Math.min(999, Math.round(qty) || 1)) } : q,
  );
  writeQueue(next);
  return next;
}

export function removeFromLabelQueue(id: string): LabelQueueItem[] {
  const next = readQueue().filter((q) => q.id !== id);
  writeQueue(next);
  return next;
}

export function clearLabelQueue(): void {
  writeQueue([]);
}
