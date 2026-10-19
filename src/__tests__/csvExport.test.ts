import { describe, expect, it } from 'vitest';
import {
  BUILTIN_PRESETS,
  COLUMN_BY_ID,
  DEFAULT_OPTIONS,
  EXPORT_COLUMNS,
  buildCsv,
  escapeCell,
  formatCell,
  formatNumber,
  headerOf,
  type ExportConfig,
} from '../lib/csvExport';
import type { Product } from '../types';

const p = (over: Partial<Product> = {}): Product =>
  ({
    id: 'a1',
    sku: 'SKU1',
    name: 'Nazwa WAPRO',
    displayName: 'Produkt "Testowy"; z średnikiem',
    category: 'Chemia',
    catalog: 'shop',
    manufacturer: 'SONAX',
    ean: '5900000000001',
    hasImage: true,
    imageUrl: 'https://x/a.jpg',
    stock: 12,
    pricePurchaseNet: 50,
    priceSaleNet: 80,
    priceSaleGross: 98.4,
    meta: { vatRate: 23 },
    ...over,
  }) as Product;

const cfg = (ids: string[], opt: Partial<typeof DEFAULT_OPTIONS> = {}): ExportConfig => ({
  columns: ids.map((id) => ({ id })),
  options: { ...DEFAULT_OPTIONS, ...opt },
  filePrefix: 'test',
});

describe('eksport CSV', () => {
  it('kolumny mają unikalne id i polskie etykiety', () => {
    const ids = EXPORT_COLUMNS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of EXPORT_COLUMNS) expect(c.label.length).toBeGreaterThan(2);
  });

  it('gotowe zestawy odwołują się do istniejących kolumn', () => {
    for (const preset of BUILTIN_PRESETS) for (const id of preset.columns) expect(COLUMN_BY_ID.has(id)).toBe(true);
  });

  it('buduje nagłówek i wiersze w wybranej kolejności z separatorem średnikiem', () => {
    const csv = buildCsv([p()], cfg(['sku', 'priceGross', 'priceNet', 'purchaseNet']));
    const [head, row] = csv.split('\r\n');
    expect(head).toBe('SKU;Cena sprzedaży brutto;Cena sprzedaży netto;Cena zakupu netto');
    expect(row).toBe('SKU1;98,40;80,00;50,00');
  });

  it('separator dziesiętny kropka i liczba miejsc po przecinku', () => {
    const csv = buildCsv([p()], cfg(['priceGross'], { decimal: '.', decimals: 1 }));
    expect(csv.split('\r\n')[1]).toBe('98.4');
    expect(formatNumber(1234.5, 0, ',')).toBe('1235');
  });

  it('cena zakupu brutto i marża liczone z VAT i cen netto', () => {
    const csv = buildCsv([p()], cfg(['purchaseGross', 'margin', 'profit', 'stockValue']));
    expect(csv.split('\r\n')[1]).toBe('61,50;37,50;30,00;600,00');
  });

  it('pola ze znakami specjalnymi są ujęte w cudzysłów, a cudzysłowy podwojone', () => {
    const csv = buildCsv([p()], cfg(['name']));
    expect(csv.split('\r\n')[1]).toBe('"Produkt ""Testowy""; z średnikiem"');
  });

  it('zabezpiecza przed formułami Excela, ale nie rusza liczb ujemnych', () => {
    expect(escapeCell('=SUM(A1)', ';', false)).toBe("'=SUM(A1)");
    expect(escapeCell('+48123', ';', false)).toBe("'+48123");
    expect(escapeCell('-5,5', ';', false)).toBe('-5,5');
    expect(escapeCell('-abc', ';', false)).toBe("'-abc");
  });

  it('wartości Tak/Nie w trzech formatach', () => {
    const col = COLUMN_BY_ID.get('hasImage')!;
    expect(formatCell(col, true, { ...DEFAULT_OPTIONS })).toBe('Tak');
    expect(formatCell(col, false, { ...DEFAULT_OPTIONS, boolFormat: '1-0' })).toBe('0');
    expect(formatCell(col, true, { ...DEFAULT_OPTIONS, boolFormat: 'true-false' })).toBe('true');
  });

  it('własne i techniczne nagłówki, bez wiersza nagłówka', () => {
    expect(headerOf({ id: 'sku', header: 'Indeks' }, DEFAULT_OPTIONS)).toBe('Indeks');
    expect(headerOf({ id: 'priceGross' }, { ...DEFAULT_OPTIONS, headerStyle: 'ids' })).toBe('priceGross');
    const csv = buildCsv([p()], cfg(['sku'], { includeHeader: false }));
    expect(csv).toBe('SKU1');
  });

  it('opis pełny z doładowanej mapy: tekst bez HTML albo HTML', () => {
    const map = new Map([['a1', '<p>Mocny <b>środek</b></p>']]);
    expect(buildCsv([p()], cfg(['description']), map).split('\r\n')[1]).toBe('Mocny środek');
    expect(buildCsv([p()], cfg(['description'], { descriptionFormat: 'html' }), map).split('\r\n')[1]).toBe('<p>Mocny <b>środek</b></p>');
  });

  it('separator tabulator i cudzysłowy dla wszystkich pól', () => {
    const csv = buildCsv([p()], cfg(['sku', 'ean'], { delimiter: '\t', quoteAll: true }));
    expect(csv.split('\r\n')[1]).toBe('"SKU1"\t"5900000000001"');
  });
});
