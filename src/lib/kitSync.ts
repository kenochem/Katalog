import type { Kit, KitItem, Product } from '../types';
import { resolveKitItemProduct, type ProductLookup } from './kitResolve';

/**
 * Zestawy z BaseLinkera: porównanie prawdziwego składu (bundle_products z API BL) z zestawami w katalogu.
 * Wcześniejszy import z pliku CSV zgadywał skład z opisów — tu źródłem prawdy jest BaseLinker.
 */

export interface BlKitComponent {
  blId: number;
  qty: number;
  sku: string;
  name: string;
  /** false = składnik nie istnieje już w katalogu BL (usunięty produkt). */
  inInventory: boolean;
}

export interface BlKit {
  blId: number;
  sku: string;
  name: string;
  /** false = produkt wygląda na zestaw (nazwa), ale w BL nie ma zdefiniowanego składu. */
  isBundle: boolean;
  image: string;
  components: BlKitComponent[];
}

export type KitSyncStatus = 'new' | 'diff' | 'same' | 'not-bundle' | 'missing-in-bl';

export interface KitDiff {
  added: KitItem[];
  removed: KitItem[];
  changed: { sku: string; name: string; from: number; to: number }[];
}

export interface KitSyncRow {
  key: string;
  status: KitSyncStatus;
  blKit?: BlKit;
  localKit?: Kit;
  /** Skład wg BL przeliczony na pozycje katalogu. */
  proposedItems: KitItem[];
  /** SKU składników BL, których nie ma w katalogu (do uzupełnienia). */
  unresolved: string[];
  diff: KitDiff;
}

const BL_KIT_ID = /^bl-zestaw-(\d+)$/;

/** Id produktu w BaseLinkerze zakodowane w id zestawu z importu (`bl-zestaw-<id>`). */
export function blIdOfKit(kit: Kit): number | null {
  const m = BL_KIT_ID.exec(kit.id);
  return m ? Number(m[1]) : null;
}

export function kitIdForBl(blId: number): string {
  return `bl-zestaw-${blId}`;
}

function keyOf(item: KitItem): string {
  return (item.sku || item.productId || '').toUpperCase();
}

/** Przelicza skład z BL na pozycje katalogu (łączy powtórzone SKU, sumując ilości). */
export function itemsFromBl(
  blKit: BlKit,
  lookup: ProductLookup,
): { items: KitItem[]; unresolved: string[] } {
  const merged = new Map<string, KitItem>();
  const unresolved: string[] = [];
  for (const c of blKit.components) {
    const sku = c.sku.trim().toUpperCase();
    const product: Product | undefined = sku ? lookup.bySku.get(sku) : undefined;
    const item: KitItem = product
      ? { productId: product.id, sku: product.sku, name: product.displayName || product.name, quantity: c.qty }
      : { productId: `bl-${c.blId}`, sku: c.sku, name: c.name || `Produkt BL ${c.blId}`, quantity: c.qty };
    if (!product) unresolved.push(c.sku || `BL ${c.blId}`);
    const k = keyOf(item);
    const prev = merged.get(k);
    if (prev) prev.quantity += item.quantity;
    else merged.set(k, item);
  }
  return { items: [...merged.values()], unresolved };
}

export function diffItems(local: KitItem[], proposed: KitItem[]): KitDiff {
  const l = new Map<string, KitItem>();
  for (const it of local) {
    const k = keyOf(it);
    const prev = l.get(k);
    if (prev) l.set(k, { ...prev, quantity: prev.quantity + it.quantity });
    else l.set(k, { ...it });
  }
  const p = new Map(proposed.map((it) => [keyOf(it), it]));
  const added: KitItem[] = [];
  const removed: KitItem[] = [];
  const changed: KitDiff['changed'] = [];
  for (const [k, it] of p) {
    const cur = l.get(k);
    if (!cur) added.push(it);
    else if (cur.quantity !== it.quantity) changed.push({ sku: it.sku, name: it.name, from: cur.quantity, to: it.quantity });
  }
  for (const [k, it] of l) if (!p.has(k)) removed.push(it);
  return { added, removed, changed };
}

const NO_DIFF: KitDiff = { added: [], removed: [], changed: [] };

/** Zestawienie: co jest w BL, co lokalnie i czym się różni. */
export function buildKitSync(blKits: BlKit[], localKits: Kit[], lookup: ProductLookup): KitSyncRow[] {
  const rows: KitSyncRow[] = [];
  const blById = new Map(blKits.map((k) => [k.blId, k]));
  const localByBlId = new Map<number, Kit>();
  for (const k of localKits) {
    const id = blIdOfKit(k);
    if (id != null) localByBlId.set(id, k);
  }

  for (const blKit of blKits) {
    const local = localByBlId.get(blKit.blId);
    if (!blKit.isBundle || blKit.components.length === 0) {
      // BL nie ma zdefiniowanego składu — pokazujemy tylko, gdy mamy taki zestaw lokalnie
      if (local) rows.push({ key: `nb-${blKit.blId}`, status: 'not-bundle', blKit, localKit: local, proposedItems: [], unresolved: [], diff: NO_DIFF });
      continue;
    }
    const { items, unresolved } = itemsFromBl(blKit, lookup);
    if (!local) {
      rows.push({ key: `new-${blKit.blId}`, status: 'new', blKit, proposedItems: items, unresolved, diff: { added: items, removed: [], changed: [] } });
      continue;
    }
    const diff = diffItems(local.items, items);
    const same = diff.added.length === 0 && diff.removed.length === 0 && diff.changed.length === 0;
    rows.push({ key: `kit-${blKit.blId}`, status: same ? 'same' : 'diff', blKit, localKit: local, proposedItems: items, unresolved, diff });
  }

  for (const [blId, local] of localByBlId) {
    if (!blById.has(blId)) {
      rows.push({ key: `miss-${blId}`, status: 'missing-in-bl', localKit: local, proposedItems: [], unresolved: [], diff: NO_DIFF });
    }
  }
  return rows;
}

/** Ile kompletnych zestawów da się złożyć z dostępnych sztuk składników (null = nie da się ocenić). */
export function kitAvailability(
  items: KitItem[],
  lookup: ProductLookup,
  available: (p: Product) => number,
): { count: number; limiting: string } | null {
  if (items.length === 0) return null;
  let min = Infinity;
  let limiting = '';
  for (const item of items) {
    const p = resolveKitItemProduct(item, lookup);
    if (!p) return null;
    const qty = Math.max(1, item.quantity || 1);
    const n = Math.floor(available(p) / qty);
    if (n < min) {
      min = n;
      limiting = p.displayName || p.name;
    }
  }
  return Number.isFinite(min) ? { count: Math.max(0, min), limiting } : null;
}
