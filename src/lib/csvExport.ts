import type { Product } from '../types';
import { CATALOG_LABELS } from '../types';
import { marginPercent } from './format';
import { effectiveManufacturer } from './waproManufacturers';
import { getProductDisplayCategory, getProductSourceCategory } from './catalogCategory';
import { inferProductTypeLabel } from './catalogKind';
import { getProductImage, getProductImages } from './products';
import { assessProductKnowledge } from './productKnowledge';
import { baselinkerLinkLabel, hasBaselinkerLink } from './baselinkerLink';
import { formatLocationCode } from './warehouseLocation';
import { resolveProductLocation } from './locationStore';
import { plainText } from './productDescriptions';
import { EXCEPTION_KIND_LABEL, exceptionsOf } from './dataExceptions';

/**
 * Konfigurowalny eksport CSV produktów: wybór i kolejność kolumn, ceny (sprzedaż brutto/netto, zakup),
 * format liczb, separator, kodowanie. Profile zapisywane lokalnie w przeglądarce.
 */
export type ColumnGroup = 'ident' | 'price' | 'stock' | 'content' | 'media' | 'bl' | 'status' | 'sales' | 'attrs';

export const GROUP_LABEL: Record<ColumnGroup, string> = {
  ident: 'Identyfikacja',
  price: 'Ceny i marża',
  stock: 'Magazyn i logistyka',
  content: 'Opisy i kompletność',
  media: 'Zdjęcia',
  bl: 'BaseLinker i sklep',
  status: 'Status i uwagi',
  sales: 'Sprzedaż (WAPRO)',
  attrs: 'Atrybuty (parametry)',
};

export const GROUP_ORDER: ColumnGroup[] = ['ident', 'price', 'stock', 'content', 'media', 'bl', 'status', 'sales', 'attrs'];

export type CellValue = string | number | null | undefined;

export interface ExportContext {
  /** Pełne opisy (id → HTML/tekst) doładowane z bazy, gdy wybrano kolumny opisów. */
  descriptions?: Map<string, string>;
  options: ExportOptions;
}

export interface ExportColumn {
  id: string;
  label: string;
  group: ColumnGroup;
  /** Rodzaj wartości — decyduje o formatowaniu (liczby wg ustawień separatora dziesiętnego). */
  kind: 'text' | 'money' | 'int' | 'decimal' | 'percent' | 'bool';
  /** Kolumna wymaga pełnego opisu produktu (doładowanie z bazy). */
  needsDescription?: boolean;
  get: (p: Product, ctx: ExportContext) => CellValue | boolean;
}

const vatOf = (p: Product) => (typeof p.meta?.vatRate === 'number' ? p.meta.vatRate : 23);
const salesPeriod = (p: Product, months: 1 | 3 | 6 | 12) => p.waproSalesStats?.periods?.find((x) => x.months === months);

export const EXPORT_COLUMNS: ExportColumn[] = [
  // identyfikacja
  { id: 'sku', label: 'SKU', group: 'ident', kind: 'text', get: (p) => p.sku },
  { id: 'ean', label: 'EAN', group: 'ident', kind: 'text', get: (p) => p.ean || '' },
  { id: 'name', label: 'Nazwa (tytuł oferty)', group: 'ident', kind: 'text', get: (p) => p.displayName },
  { id: 'nameWapro', label: 'Nazwa WAPRO', group: 'ident', kind: 'text', get: (p) => p.name },
  { id: 'manufacturer', label: 'Producent', group: 'ident', kind: 'text', get: (p) => effectiveManufacturer(p) },
  { id: 'category', label: 'Kategoria', group: 'ident', kind: 'text', get: (p) => getProductDisplayCategory(p) },
  { id: 'categorySource', label: 'Kategoria źródłowa', group: 'ident', kind: 'text', get: (p) => getProductSourceCategory(p) },
  { id: 'shopPath', label: 'Ścieżka kategorii (sklep)', group: 'ident', kind: 'text', get: (p) => p.meta?.shopCategoryPath || '' },
  { id: 'type', label: 'Typ produktu', group: 'ident', kind: 'text', get: (p) => inferProductTypeLabel(p) },
  { id: 'catalog', label: 'Katalog', group: 'ident', kind: 'text', get: (p) => CATALOG_LABELS[p.catalog || 'accessories'] },
  { id: 'id', label: 'ID rekordu', group: 'ident', kind: 'text', get: (p) => p.id },
  { id: 'tags', label: 'Tagi', group: 'ident', kind: 'text', get: (p) => (p.tags ?? []).join(', ') },
  // ceny
  { id: 'priceGross', label: 'Cena sprzedaży brutto', group: 'price', kind: 'money', get: (p) => p.priceSaleGross ?? null },
  { id: 'priceNet', label: 'Cena sprzedaży netto', group: 'price', kind: 'money', get: (p) => p.priceSaleNet ?? null },
  { id: 'purchaseNet', label: 'Cena zakupu netto', group: 'price', kind: 'money', get: (p) => p.pricePurchaseNet ?? null },
  {
    id: 'purchaseGross',
    label: 'Cena zakupu brutto',
    group: 'price',
    kind: 'money',
    get: (p) => (p.pricePurchaseNet != null ? Math.round(p.pricePurchaseNet * (1 + vatOf(p) / 100) * 100) / 100 : null),
  },
  { id: 'vat', label: 'Stawka VAT (%)', group: 'price', kind: 'int', get: (p) => vatOf(p) },
  {
    id: 'margin',
    label: 'Marża (%)',
    group: 'price',
    kind: 'percent',
    get: (p) => marginPercent(p.pricePurchaseNet, p.priceSaleNet),
  },
  {
    id: 'profit',
    label: 'Zysk netto (zł/szt.)',
    group: 'price',
    kind: 'money',
    get: (p) => (p.priceSaleNet != null && p.pricePurchaseNet != null ? Math.round((p.priceSaleNet - p.pricePurchaseNet) * 100) / 100 : null),
  },
  {
    id: 'stockValue',
    label: 'Wartość zapasu (zakup netto)',
    group: 'price',
    kind: 'money',
    get: (p) => (p.pricePurchaseNet != null ? Math.round(p.pricePurchaseNet * Math.max(0, p.stock ?? 0) * 100) / 100 : null),
  },
  // magazyn
  { id: 'stock', label: 'Stan magazynowy', group: 'stock', kind: 'decimal', get: (p) => p.stock ?? 0 },
  { id: 'stockManual', label: 'Stan ręczny', group: 'stock', kind: 'bool', get: (p) => Boolean(p.stockManual) },
  {
    id: 'location',
    label: 'Lokalizacja',
    group: 'stock',
    kind: 'text',
    get: (p) => formatLocationCode(resolveProductLocation(p.id, p.warehouseLocation)),
  },
  { id: 'unit', label: 'Jednostka', group: 'stock', kind: 'text', get: (p) => p.meta?.unit || '' },
  { id: 'weight', label: 'Waga (kg)', group: 'stock', kind: 'decimal', get: (p) => p.meta?.weightKg ?? null },
  { id: 'width', label: 'Szerokość (cm)', group: 'stock', kind: 'decimal', get: (p) => p.meta?.widthCm ?? null },
  { id: 'height', label: 'Wysokość (cm)', group: 'stock', kind: 'decimal', get: (p) => p.meta?.heightCm ?? null },
  { id: 'depth', label: 'Głębokość (cm)', group: 'stock', kind: 'decimal', get: (p) => p.meta?.depthCm ?? null },
  // opisy
  {
    id: 'description',
    label: 'Opis pełny',
    group: 'content',
    kind: 'text',
    needsDescription: true,
    get: (p, ctx) => {
      const raw = ctx.descriptions?.get(p.id) ?? p.description ?? '';
      return ctx.options.descriptionFormat === 'html' ? raw : plainText(raw);
    },
  },
  { id: 'shortDescription', label: 'Opis krótki', group: 'content', kind: 'text', get: (p) => p.meta?.shortDescription || '' },
  { id: 'usage', label: 'Sposób użycia', group: 'content', kind: 'text', get: (p, ctx) => descField(p.meta?.descUsage, ctx) },
  { id: 'composition', label: 'Skład / dane techniczne', group: 'content', kind: 'text', get: (p, ctx) => descField(p.meta?.descComposition, ctx) },
  { id: 'safety', label: 'Bezpieczeństwo', group: 'content', kind: 'text', get: (p, ctx) => descField(p.meta?.descSafety, ctx) },
  { id: 'completeness', label: 'Kompletność (%)', group: 'content', kind: 'int', get: (p) => assessProductKnowledge(p).score },
  { id: 'missing', label: 'Czego brakuje', group: 'content', kind: 'text', get: (p) => assessProductKnowledge(p).missing.join('; ') },
  // zdjęcia
  { id: 'hasImage', label: 'Ma zdjęcie', group: 'media', kind: 'bool', get: (p) => Boolean(p.hasImage || getProductImage(p)) },
  { id: 'imageUrl', label: 'Zdjęcie główne (URL)', group: 'media', kind: 'text', get: (p) => getProductImage(p) || '' },
  { id: 'imageCount', label: 'Liczba zdjęć', group: 'media', kind: 'int', get: (p) => getProductImages(p).length },
  { id: 'imageUrls', label: 'Wszystkie zdjęcia (URL)', group: 'media', kind: 'text', get: (p) => getProductImages(p).join(' | ') },
  // BaseLinker
  { id: 'blLinked', label: 'Powiązany z BaseLinkerem', group: 'bl', kind: 'bool', get: (p) => hasBaselinkerLink(p) },
  { id: 'blId', label: 'ID BaseLinker', group: 'bl', kind: 'text', get: (p) => (hasBaselinkerLink(p) ? (baselinkerLinkLabel(p) ?? '') : '') },
  // status
  { id: 'hidden', label: 'Ukryty', group: 'status', kind: 'bool', get: (p) => Boolean(p.meta?.catalogHidden) },
  { id: 'hiddenReason', label: 'Powód ukrycia', group: 'status', kind: 'text', get: (p) => p.meta?.catalogHiddenReason || '' },
  {
    id: 'exceptions',
    label: 'Wyjątki (uzupełnianie danych)',
    group: 'status',
    kind: 'text',
    get: (p) =>
      exceptionsOf(p)
        .map((k) => EXCEPTION_KIND_LABEL[k as keyof typeof EXCEPTION_KIND_LABEL] ?? k)
        .join(', '),
  },
  { id: 'note', label: 'Notatka wewnętrzna', group: 'status', kind: 'text', get: (p) => p.meta?.internalNote || '' },
  // sprzedaż
  { id: 'sales1', label: 'Sprzedaż 1 m (szt.)', group: 'sales', kind: 'decimal', get: (p) => salesPeriod(p, 1)?.qty ?? null },
  { id: 'sales3', label: 'Sprzedaż 3 m (szt.)', group: 'sales', kind: 'decimal', get: (p) => salesPeriod(p, 3)?.qty ?? null },
  { id: 'sales12', label: 'Sprzedaż 12 m (szt.)', group: 'sales', kind: 'decimal', get: (p) => salesPeriod(p, 12)?.qty ?? null },
  { id: 'sales12Net', label: 'Sprzedaż 12 m (netto zł)', group: 'sales', kind: 'money', get: (p) => salesPeriod(p, 12)?.netValue ?? null },
  { id: 'lastSale', label: 'Ostatnia sprzedaż', group: 'sales', kind: 'text', get: (p) => p.waproSalesStats?.lastSaleDate || '' },
];

function descField(raw: string | undefined, ctx: ExportContext): string {
  const v = raw ?? '';
  return ctx.options.descriptionFormat === 'html' ? v : plainText(v);
}

export const COLUMN_BY_ID = new Map(EXPORT_COLUMNS.map((c) => [c.id, c]));

/** Dopisuje kolumny atrybutów strukturalnych (id „attr:klucz”) do dostępnych kolumn eksportu. */
export function syncAttributeColumns(defs: { key: string; label: string; type: string; unit?: string }[]): void {
  for (let i = EXPORT_COLUMNS.length - 1; i >= 0; i--) {
    if (EXPORT_COLUMNS[i].id.startsWith('attr:')) {
      COLUMN_BY_ID.delete(EXPORT_COLUMNS[i].id);
      EXPORT_COLUMNS.splice(i, 1);
    }
  }
  for (const d of defs) {
    const col: ExportColumn = {
      id: `attr:${d.key}`,
      label: d.unit ? `${d.label} (${d.unit})` : d.label,
      group: 'attrs',
      kind: d.type === 'number' ? 'decimal' : d.type === 'bool' ? 'bool' : 'text',
      get: (p) => {
        const v = (p.meta as { attrs?: Record<string, string | number | boolean> } | undefined)?.attrs?.[d.key];
        return v === undefined ? null : v;
      },
    };
    EXPORT_COLUMNS.push(col);
    COLUMN_BY_ID.set(col.id, col);
  }
}

// ---------------------------------------------------------------------------------------------
// Konfiguracja
// ---------------------------------------------------------------------------------------------

export interface ExportOptions {
  delimiter: ';' | ',' | '\t';
  /** Separator dziesiętny liczb. */
  decimal: ',' | '.';
  /** Liczba miejsc po przecinku dla cen i procentów. */
  decimals: 0 | 1 | 2 | 3 | 4;
  /** Dodaje BOM UTF-8 (Excel poprawnie czyta polskie znaki). */
  bom: boolean;
  /** Ujmuje w cudzysłów wszystkie pola (nie tylko te ze znakami specjalnymi). */
  quoteAll: boolean;
  includeHeader: boolean;
  /** Format wartości logicznych. */
  boolFormat: 'tak-nie' | '1-0' | 'true-false';
  descriptionFormat: 'text' | 'html';
  /** Nagłówki: czytelne (polskie) albo techniczne (id kolumn). */
  headerStyle: 'labels' | 'ids';
}

export interface ExportColumnChoice {
  id: string;
  /** Własny nagłówek (pusty = domyślny). */
  header?: string;
}

export interface ExportConfig {
  columns: ExportColumnChoice[];
  options: ExportOptions;
  /** Prefiks nazwy pliku. */
  filePrefix: string;
}

export const DEFAULT_OPTIONS: ExportOptions = {
  delimiter: ';',
  decimal: ',',
  decimals: 2,
  bom: true,
  quoteAll: false,
  includeHeader: true,
  boolFormat: 'tak-nie',
  descriptionFormat: 'text',
  headerStyle: 'labels',
};

export interface ExportPreset {
  id: string;
  name: string;
  hint: string;
  columns: string[];
}

export const BUILTIN_PRESETS: ExportPreset[] = [
  { id: 'basic', name: 'Podstawowy', hint: 'SKU, nazwa, producent, kategoria, EAN, stan', columns: ['sku', 'name', 'manufacturer', 'category', 'ean', 'stock'] },
  {
    id: 'prices',
    name: 'Cennik',
    hint: 'Ceny sprzedaży brutto/netto, zakup, marża',
    columns: ['sku', 'ean', 'name', 'manufacturer', 'priceGross', 'priceNet', 'purchaseNet', 'margin', 'vat'],
  },
  {
    id: 'stock',
    name: 'Magazyn',
    hint: 'Stany, lokalizacje, wartość zapasu',
    columns: ['sku', 'name', 'manufacturer', 'stock', 'location', 'unit', 'purchaseNet', 'stockValue'],
  },
  {
    id: 'gaps',
    name: 'Braki danych',
    hint: 'Do pracy nad uzupełnianiem: zdjęcie, EAN, kompletność, czego brakuje',
    columns: ['sku', 'name', 'manufacturer', 'category', 'ean', 'hasImage', 'blLinked', 'completeness', 'missing', 'exceptions'],
  },
  {
    id: 'content',
    name: 'Opisy i zdjęcia',
    hint: 'Opisy (pełny, krótki, użycie, skład) i adresy zdjęć',
    columns: ['sku', 'name', 'shortDescription', 'description', 'usage', 'composition', 'safety', 'imageUrl', 'imageUrls'],
  },
  { id: 'full', name: 'Pełny', hint: 'Wszystkie kolumny', columns: EXPORT_COLUMNS.map((c) => c.id) },
];

export function configFromPreset(preset: ExportPreset, options: ExportOptions = DEFAULT_OPTIONS): ExportConfig {
  return { columns: preset.columns.map((id) => ({ id })), options: { ...options }, filePrefix: 'produkty' };
}

export function defaultConfig(): ExportConfig {
  return configFromPreset(BUILTIN_PRESETS[0]);
}

// ---------------------------------------------------------------------------------------------
// Formatowanie i budowanie pliku
// ---------------------------------------------------------------------------------------------

export function formatNumber(value: number, decimals: number, decimalSep: ',' | '.'): string {
  const fixed = value.toFixed(decimals);
  return decimalSep === ',' ? fixed.replace('.', ',') : fixed;
}

export function formatCell(col: ExportColumn, raw: CellValue | boolean, options: ExportOptions): string {
  if (raw == null || raw === '') return '';
  if (col.kind === 'bool') {
    const b = Boolean(raw);
    if (options.boolFormat === '1-0') return b ? '1' : '0';
    if (options.boolFormat === 'true-false') return b ? 'true' : 'false';
    return b ? 'Tak' : 'Nie';
  }
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) return '';
    if (col.kind === 'money' || col.kind === 'percent') return formatNumber(raw, options.decimals, options.decimal);
    if (col.kind === 'int') return String(Math.round(raw));
    if (col.kind === 'decimal') {
      const s = Number.isInteger(raw) ? String(raw) : formatNumber(raw, Math.max(options.decimals, 1), '.').replace(/0+$/, '').replace(/\.$/, '');
      return options.decimal === ',' ? s.replace('.', ',') : s;
    }
    return String(raw);
  }
  return String(raw);
}

export function escapeCell(value: string, delimiter: string, quoteAll: boolean): string {
  // zabezpieczenie przed „formułami” w Excelu: wartość zaczynająca się od = + @ (tekst, nie liczba) dostaje apostrof
  let v = value;
  if (/^[=+@]/.test(v) || (/^-/.test(v) && !/^-?\d+([.,]\d+)?$/.test(v))) v = `'${v}`;
  if (quoteAll || v.includes(delimiter) || /["\r\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

export function headerOf(choice: ExportColumnChoice, options: ExportOptions): string {
  const col = COLUMN_BY_ID.get(choice.id);
  if (choice.header?.trim()) return choice.header.trim();
  return options.headerStyle === 'ids' ? choice.id : (col?.label ?? choice.id);
}

export function neededDescriptions(config: ExportConfig): boolean {
  return config.columns.some((c) => COLUMN_BY_ID.get(c.id)?.needsDescription);
}

/** Buduje zawartość pliku CSV (bez BOM). */
export function buildCsv(products: Product[], config: ExportConfig, descriptions?: Map<string, string>): string {
  const { options } = config;
  const cols = config.columns
    .map((c) => ({ choice: c, col: COLUMN_BY_ID.get(c.id) }))
    .filter((x): x is { choice: ExportColumnChoice; col: ExportColumn } => Boolean(x.col));
  const ctx: ExportContext = { descriptions, options };
  const sep = options.delimiter;
  const lines: string[] = [];
  if (options.includeHeader) lines.push(cols.map((x) => escapeCell(headerOf(x.choice, options), sep, options.quoteAll)).join(sep));
  for (const p of products) {
    lines.push(cols.map((x) => escapeCell(formatCell(x.col, x.col.get(p, ctx), options), sep, options.quoteAll)).join(sep));
  }
  return lines.join('\r\n');
}

export function downloadCsvFile(content: string, filename: string, bom: boolean): void {
  const blob = new Blob([(bom ? '﻿' : '') + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportFileName(prefix: string, ext = 'csv'): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  const safe = (prefix || 'produkty').replace(/[^a-z0-9ąćęłńóśźż_-]+/gi, '_');
  return `${safe}_${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}.${ext}`;
}

// ---------------------------------------------------------------------------------------------
// Zapisane profile (localStorage)
// ---------------------------------------------------------------------------------------------

const LS_LAST = 'katalog-csv-export-last';
const LS_PRESETS = 'katalog-csv-export-presets';

export interface SavedExportProfile {
  name: string;
  config: ExportConfig;
}

function sanitizeConfig(raw: unknown): ExportConfig | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<ExportConfig>;
  if (!Array.isArray(r.columns)) return null;
  const columns = r.columns.filter((c): c is ExportColumnChoice => !!c && typeof c.id === 'string' && COLUMN_BY_ID.has(c.id));
  if (!columns.length) return null;
  return {
    columns,
    options: { ...DEFAULT_OPTIONS, ...(r.options ?? {}) },
    filePrefix: typeof r.filePrefix === 'string' && r.filePrefix ? r.filePrefix : 'produkty',
  };
}

export function loadLastConfig(): ExportConfig {
  try {
    const raw = localStorage.getItem(LS_LAST);
    const cfg = raw ? sanitizeConfig(JSON.parse(raw)) : null;
    if (cfg) return cfg;
  } catch {
    /* brak dostępu do pamięci przeglądarki */
  }
  return defaultConfig();
}

export function saveLastConfig(config: ExportConfig): void {
  try {
    localStorage.setItem(LS_LAST, JSON.stringify(config));
  } catch {
    /* ignoruj */
  }
}

export function loadSavedProfiles(): SavedExportProfile[] {
  try {
    const raw = localStorage.getItem(LS_PRESETS);
    const list = raw ? (JSON.parse(raw) as unknown[]) : [];
    return list
      .map((x) => {
        const o = x as { name?: unknown; config?: unknown };
        const cfg = sanitizeConfig(o.config);
        return typeof o.name === 'string' && cfg ? { name: o.name, config: cfg } : null;
      })
      .filter((x): x is SavedExportProfile => Boolean(x));
  } catch {
    return [];
  }
}

export function saveProfiles(list: SavedExportProfile[]): void {
  try {
    localStorage.setItem(LS_PRESETS, JSON.stringify(list));
  } catch {
    /* ignoruj */
  }
}
