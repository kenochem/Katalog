import type { Product } from '../types';

const QUEUE_KEY = 'katalog-label-queue';

export interface LabelQueueItem {
  id: string;
  sku: string;
  displayName: string;
  ean: string;
  catalog: string;
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

export function addToLabelQueue(product: Product): LabelQueueItem[] {
  const queue = readQueue().filter((q) => q.id !== product.id);
  const code = (product.ean || product.sku || '').trim();
  queue.push({
    id: product.id,
    sku: product.sku,
    displayName: product.displayName,
    ean: code,
    catalog: product.catalog || 'accessories',
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
      });
    }
  }
  writeQueue(queue);
  return queue;
}

export function removeFromLabelQueue(id: string): LabelQueueItem[] {
  const next = readQueue().filter((q) => q.id !== id);
  writeQueue(next);
  return next;
}

export function clearLabelQueue(): void {
  writeQueue([]);
}
