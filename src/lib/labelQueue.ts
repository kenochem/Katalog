import type { Product } from '../types';
import { formatLocationCode } from './warehouseLocation';
import { resolveProductLocation } from './locationStore';
import { customerGrossPrice } from './format';
import { getProductDisplayCategory } from './catalogCategory';
import { effectiveManufacturer } from './waproManufacturers';
import { parsePackFromText, type PackSize } from './labelPack';

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
  /** Cena netto (do wyświetlenia pod brutto). */
  priceNet?: number | null;
  vatRate?: number;
  /** Pojemność / waga opakowania — do ceny jednostkowej (1 l / 1 kg / 1 szt.). Rozpoznana z nazwy, do poprawy ręcznie. */
  pack?: PackSize | null;
  /** Własna (skrócona) nazwa na etykiecie; puste = nazwa produktu. */
  labelName?: string;
  /** Cena promocyjna brutto — gdy ustawiona, etykieta ma wariant wyprzedażowy (stara cena przekreślona, nowa na czerwono). */
  salePrice?: number | null;
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
  'priceGross' | 'priceNet' | 'vatRate' | 'pack' | 'manufacturer' | 'category' | 'stock'
> {
  const vat = Number(product.meta?.vatRate);
  const vatRate = Number.isFinite(vat) && vat >= 0 ? vat : 23;
  const gross = customerGrossPrice(product.priceSaleGross, product.priceSaleNet, product.meta?.vatRate);
  const net =
    product.priceSaleNet != null && Number.isFinite(Number(product.priceSaleNet))
      ? Number(product.priceSaleNet)
      : gross != null
        ? Math.round((gross / (1 + vatRate / 100)) * 100) / 100
        : null;
  return {
    priceGross: gross,
    priceNet: net,
    vatRate,
    pack: parsePackFromText(product.displayName) ?? parsePackFromText(product.name),
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

/** Zmiana pól etykiety jednego produktu (nazwa, pojemność, cena promocyjna…). */
export function updateLabelItem(id: string, patch: Partial<LabelQueueItem>): LabelQueueItem[] {
  const next = readQueue().map((q) => (q.id === id ? { ...q, ...patch } : q));
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
