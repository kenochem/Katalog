import type { Product } from '../types';
import { CATALOG_LABELS } from '../types';
import { formatStock, formatPricePln, stripHtml } from './format';
import { formatLocationCode } from './warehouseLocation';
import { resolveProductLocation } from './locationStore';
import { formatDimensions, type ProductMeta } from './productMeta';

function lines(parts: (string | false | undefined | null)[]): string {
  return parts.filter(Boolean).join('\n');
}

/** Tekst do wklejenia w czat AI (oferty, opisy marketplace). */
export function buildProductAiContext(product: Product, meta?: ProductMeta): string {
  const loc = formatLocationCode(
    resolveProductLocation(product.id, product.warehouseLocation),
  );
  const desc = stripHtml(product.description || '');
  const short = meta?.shortDescription?.trim() || '';
  const params = meta?.parameters
    ? Object.entries(meta.parameters)
        .map(([k, v]) => `- ${k}: ${v}`)
        .join('\n')
    : '';

  const variants =
    product.variants?.length &&
    product.variants
      .slice(0, 30)
      .map(
        (v) =>
          `  - ${v.sku}${v.ean ? ` · EAN ${v.ean}` : ''}${v.stock != null ? ` · stan ${formatStock(v.stock)}` : ''} · ${v.name}`,
      )
      .join('\n');

  return lines([
    '# Produkt — kontekst ofertowy Kenochem',
    '',
    `SKU: ${product.sku}`,
    product.ean ? `EAN: ${product.ean}` : null,
    meta?.baselinkerProductId ? `BaseLinker ID: ${meta.baselinkerProductId}` : null,
    `Katalog: ${CATALOG_LABELS[product.catalog || 'accessories']}`,
    `Kategoria: ${product.category}`,
    product.manufacturer?.trim() ? `Producent: ${product.manufacturer}` : null,
    '',
    `Nazwa handlowa: ${product.displayName}`,
    product.name !== product.displayName ? `Nazwa systemowa: ${product.name}` : null,
    '',
    `Stan magazynowy: ${formatStock(product.stock ?? 0)}${product.stockManual ? ' (ręczny)' : ''}`,
    loc ? `Lokalizacja: ${loc}` : null,
    meta?.weightKg != null ? `Waga: ${meta.weightKg} kg` : null,
    formatDimensions(meta) ? `Wymiary: ${formatDimensions(meta)}` : null,
    meta?.unit ? `Jednostka: ${meta.unit}` : null,
    meta?.vatRate != null ? `VAT: ${meta.vatRate}%` : null,
    '',
    product.priceSaleGross != null || product.priceSaleNet != null
      ? lines([
          '## Ceny (WAPRO / magazyn)',
          product.pricePurchaseNet != null
            ? `- Zakup netto: ${formatPricePln(product.pricePurchaseNet)}`
            : null,
          product.priceSaleNet != null
            ? `- Sprzedaż netto: ${formatPricePln(product.priceSaleNet)}`
            : null,
          product.priceSaleGross != null
            ? `- Sprzedaż brutto: ${formatPricePln(product.priceSaleGross)}`
            : null,
        ])
      : null,
    '',
    product.tags?.length ? `Tagi: ${product.tags.join(', ')}` : null,
    product.isGroup && product.variants?.length
      ? `Grupa wariantów (${product.variants.length} SKU):\n${variants}`
      : null,
    '',
    short ? `## Krótki opis\n${short}` : null,
    desc ? `## Opis\n${desc}` : null,
    params ? `## Parametry\n${params}` : null,
    meta?.internalNote?.trim()
      ? `## Notatka wewnętrzna (nie publikować)\n${meta.internalNote.trim()}`
      : null,
    product.extraImageUrls?.length || product.hasImage
      ? `Zdjęcia: ${1 + (product.extraImageUrls?.length ?? 0)} (główne + dodatkowe)`
      : null,
    '',
    '---',
    'Zadanie: na podstawie powyższych danych przygotuj ofertę / opis sprzedażowy po polsku (Allegro, sklep, mail do klienta). Używaj tylko faktów z tego kontekstu.',
  ]);
}
