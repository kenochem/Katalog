import type { KitItem, Product } from '../types';

export type ProductLookup = {
  byId: Map<string, Product>;
  bySku: Map<string, Product>;
};

export function buildProductLookup(products: Product[]): ProductLookup {
  const byId = new Map<string, Product>();
  const bySku = new Map<string, Product>();
  for (const p of products) {
    byId.set(p.id, p);
    const sku = String(p.sku || '').trim().toUpperCase();
    if (sku) bySku.set(sku, p);
    for (const v of p.variants ?? []) {
      const vs = String(v.sku || '').trim().toUpperCase();
      if (vs) bySku.set(vs, p);
    }
  }
  return { byId, bySku };
}

/** Dopasowanie pozycji zestawu (BaseLinker często ma BL product_id zamiast id katalogu). */
export function resolveKitItemProduct(
  item: KitItem,
  lookup: ProductLookup,
): Product | undefined {
  const { byId, bySku } = lookup;

  if (item.productId) {
    const direct = byId.get(item.productId);
    if (direct) return direct;
    if (item.productId.startsWith('shop-')) {
      const fromId = bySku.get(item.productId.slice(5).toUpperCase());
      if (fromId) return fromId;
    }
  }

  const sku = String(item.sku || '').trim().toUpperCase();
  if (sku) {
    const byExact = bySku.get(sku);
    if (byExact) return byExact;
  }

  if (item.productId && /^\d+$/.test(item.productId)) {
    const legacy = bySku.get(item.productId);
    if (legacy) return legacy;
  }

  return undefined;
}

export function kitLinkedCount(items: KitItem[], lookup: ProductLookup): number {
  let n = 0;
  for (const item of items) {
    if (resolveKitItemProduct(item, lookup)) n += 1;
  }
  return n;
}
