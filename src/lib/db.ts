import type { Product, Kit, KitItem, ProductVariant, CatalogType, WaproSalesResult } from '../types';
import type { WarehouseLocation } from './warehouseLocation';
import { normalizeProductMeta } from './productMeta';

export interface ProductRow {
  id: string;
  sku: string;
  name: string;
  display_name: string;
  category: string;
  manufacturer: string;
  ean: string;
  image_url: string;
  custom_image_url: string;
  extra_images?: string[];
  description: string;
  has_image: boolean;
  stock?: number;
  stock_manual?: boolean;
  price_purchase_net?: number | null;
  price_sale_net?: number | null;
  price_sale_gross?: number | null;
  tags?: string[] | null;
  catalog?: string;
  variants?: ProductVariant[];
  is_group?: boolean;
  warehouse_location?: WarehouseLocation | null;
  product_meta?: unknown;
  wapro_sales_stats?: unknown;
  wapro_sales_synced_at?: string | null;
}

export interface KitRow {
  id: string;
  name: string;
  description: string;
  category: string;
  items: KitItem[];
  image_url: string;
  created_at: number;
}

function normalizeWaproSalesStats(raw: unknown): WaproSalesResult | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.periods) || o.periods.length === 0) return undefined;
  return raw as WaproSalesResult;
}

export function rowToProduct(row: ProductRow): Product {
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    displayName: row.display_name,
    category: row.category,
    manufacturer: row.manufacturer,
    ean: row.ean,
    imageUrl: row.image_url,
    customImageUrl: row.custom_image_url || undefined,
    extraImageUrls: row.extra_images?.length ? row.extra_images : undefined,
    description: row.description || '',
    hasImage: row.has_image,
    stock: Number(row.stock ?? 0),
    stockManual: row.stock_manual || false,
    pricePurchaseNet:
      row.price_purchase_net != null && Number.isFinite(Number(row.price_purchase_net))
        ? Number(row.price_purchase_net)
        : undefined,
    priceSaleNet:
      row.price_sale_net != null && Number.isFinite(Number(row.price_sale_net))
        ? Number(row.price_sale_net)
        : undefined,
    priceSaleGross:
      row.price_sale_gross != null && Number.isFinite(Number(row.price_sale_gross))
        ? Number(row.price_sale_gross)
        : undefined,
    tags: row.tags?.length ? row.tags : undefined,
    catalog: (row.catalog === 'shop' ? 'shop' : 'accessories') as CatalogType,
    variants: row.variants?.length ? row.variants : undefined,
    isGroup: row.is_group || !!(row.variants?.length),
    warehouseLocation: normalizeWarehouseLocation(row.warehouse_location),
    meta: normalizeProductMeta(row.product_meta),
    waproSalesStats: normalizeWaproSalesStats(row.wapro_sales_stats),
    waproSalesSyncedAt: row.wapro_sales_synced_at ?? undefined,
  };
}

function normalizeWarehouseLocation(raw: unknown): WarehouseLocation | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  const loc: WarehouseLocation = {
    zone: o.zone ? String(o.zone) : undefined,
    aisle: o.aisle ? String(o.aisle) : undefined,
    rack: o.rack ? String(o.rack) : undefined,
    shelf: o.shelf ? String(o.shelf) : undefined,
    bin: o.bin ? String(o.bin) : undefined,
  };
  return Object.values(loc).some(Boolean) ? loc : undefined;
}

export function productToRow(p: Product): ProductRow {
  return {
    id: p.id,
    sku: p.sku,
    name: p.name,
    display_name: p.displayName,
    category: p.category,
    manufacturer: p.manufacturer,
    ean: p.ean,
    image_url: p.imageUrl,
    custom_image_url: p.customImageUrl || '',
    extra_images: p.extraImageUrls || [],
    description: p.description,
    has_image: p.hasImage,
    stock: p.stock ?? 0,
    stock_manual: p.stockManual || false,
    price_purchase_net:
      p.pricePurchaseNet != null && Number.isFinite(p.pricePurchaseNet)
        ? p.pricePurchaseNet
        : null,
    price_sale_net:
      p.priceSaleNet != null && Number.isFinite(p.priceSaleNet) ? p.priceSaleNet : null,
    price_sale_gross:
      p.priceSaleGross != null && Number.isFinite(p.priceSaleGross)
        ? p.priceSaleGross
        : null,
    tags: p.tags?.length ? p.tags : [],
    catalog: p.catalog || 'accessories',
    variants: p.variants || [],
    is_group: p.isGroup || false,
    warehouse_location: p.warehouseLocation ?? null,
    product_meta: p.meta ?? {},
  };
}

export function rowToKit(row: KitRow): Kit {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category,
    items: row.items,
    imageUrl: row.image_url || undefined,
    createdAt: row.created_at,
  };
}

export function kitToRow(k: Kit): KitRow {
  return {
    id: k.id,
    name: k.name,
    description: k.description,
    category: k.category,
    items: k.items,
    image_url: k.imageUrl || '',
    created_at: k.createdAt,
  };
}
