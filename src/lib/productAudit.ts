import { supabase } from './supabase';
import { diffFields, hasAuditActor, logAudit, type AuditChange } from './auditLog';
import type { Product } from '../types';

/** Pole `Product` → kolumna w tabeli `products` + grupa akcji w dzienniku. */
const FIELD_MAP: Record<
  string,
  { column: string; group: 'stock' | 'price' | 'image' | 'category' | 'other' }
> = {
  displayName: { column: 'display_name', group: 'other' },
  name: { column: 'name', group: 'other' },
  description: { column: 'description', group: 'other' },
  ean: { column: 'ean', group: 'other' },
  sku: { column: 'sku', group: 'other' },
  catalog: { column: 'catalog', group: 'other' },
  warehouseLocation: { column: 'warehouse_location', group: 'other' },
  category: { column: 'category', group: 'category' },
  manufacturer: { column: 'manufacturer', group: 'category' },
  stock: { column: 'stock', group: 'stock' },
  stockManual: { column: 'stock_manual', group: 'stock' },
  pricePurchaseNet: { column: 'price_purchase_net', group: 'price' },
  priceSaleNet: { column: 'price_sale_net', group: 'price' },
  priceSaleGross: { column: 'price_sale_gross', group: 'price' },
  customImageUrl: { column: 'custom_image_url', group: 'image' },
  imageUrl: { column: 'image_url', group: 'image' },
  extraImageUrls: { column: 'extra_images', group: 'image' },
  hasImage: { column: 'has_image', group: 'image' },
};

const FIELD_LABELS: Record<string, string> = {
  displayName: 'Nazwa wyświetlana',
  name: 'Nazwa',
  description: 'Opis',
  ean: 'EAN',
  sku: 'SKU',
  catalog: 'Katalog',
  warehouseLocation: 'Lokalizacja',
  category: 'Kategoria',
  manufacturer: 'Producent',
  stock: 'Stan',
  stockManual: 'Stan ręczny',
  pricePurchaseNet: 'Cena zakupu netto',
  priceSaleNet: 'Cena sprzedaży netto',
  priceSaleGross: 'Cena sprzedaży brutto',
  customImageUrl: 'Zdjęcie główne',
  imageUrl: 'Zdjęcie (URL)',
  extraImageUrls: 'Dodatkowe zdjęcia',
  hasImage: 'Ma zdjęcie',
};

export interface ProductAuditSnapshot {
  row: Record<string, unknown>;
}

/** Pobiera „stare” wartości zmienianych kolumn (jedno małe zapytanie) — tylko gdy jest zalogowany aktor. */
export async function captureProductBefore(
  productId: string,
  updates: Partial<Product>,
): Promise<ProductAuditSnapshot | null> {
  if (!supabase || !hasAuditActor()) return null;
  const columns = new Set<string>(['sku', 'display_name', 'name']);
  for (const key of Object.keys(updates)) {
    const m = FIELD_MAP[key];
    if (m) columns.add(m.column);
  }
  if (updates.meta !== undefined) columns.add('product_meta');
  try {
    const { data } = await supabase
      .from('products')
      .select([...columns].join(','))
      .eq('id', productId)
      .maybeSingle();
    return data ? { row: data as unknown as Record<string, unknown> } : null;
  } catch {
    return null;
  }
}

export function recordProductUpdate(
  productId: string,
  updates: Partial<Product>,
  before: ProductAuditSnapshot | null,
): void {
  if (!hasAuditActor()) return;
  const changes: Record<string, AuditChange> = {};
  const groups = new Set<string>();

  for (const [key, value] of Object.entries(updates)) {
    const m = FIELD_MAP[key];
    if (!m) continue;
    const from = before?.row[m.column];
    const to = key === 'sku' && typeof value === 'string' ? value.trim().toUpperCase() : value;
    if (JSON.stringify(from ?? null) === JSON.stringify(to ?? null)) continue;
    changes[FIELD_LABELS[key] ?? key] = { from, to };
    groups.add(m.group);
  }

  if (updates.meta !== undefined) {
    const beforeMeta = (before?.row.product_meta ?? {}) as Record<string, unknown>;
    const afterMeta = (updates.meta ?? {}) as Record<string, unknown>;
    const metaDiff = diffFields(beforeMeta, afterMeta);
    for (const k of Object.keys(beforeMeta)) {
      if (!(k in afterMeta) && beforeMeta[k] != null) {
        metaDiff[k] = { from: beforeMeta[k], to: null };
      }
    }
    for (const [k, v] of Object.entries(metaDiff)) changes[`meta: ${k}`] = v;
    if (Object.keys(metaDiff).length) groups.add('other');
  }

  if (!Object.keys(changes).length) return;

  const action =
    groups.size === 1
      ? groups.has('stock')
        ? 'product.stock'
        : groups.has('price')
          ? 'product.price'
          : groups.has('image')
            ? 'product.image'
            : groups.has('category')
              ? 'product.category'
              : 'product.update'
      : 'product.update';

  const sku = String(before?.row.sku ?? updates.sku ?? productId);
  const label = String(before?.row.display_name || before?.row.name || '');
  logAudit({
    action,
    entityType: 'product',
    entityId: sku,
    entityLabel: label,
    summary: Object.keys(changes).join(', '),
    changes,
  });
}
