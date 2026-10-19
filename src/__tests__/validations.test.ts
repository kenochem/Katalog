import { describe, expect, it } from 'vitest';
import { buildValidationContext, checkEan, gs1CheckDigitOk, normalizeName, validateProduct } from '../lib/validations';
import { buildCatalogDecisionRows } from '../components/CatalogDecisionView';
import type { Product } from '../types';

const p = (sku: string, over: Partial<Product> = {}): Product =>
  ({
    id: sku,
    sku,
    name: 'Produkt ' + sku,
    displayName: 'Płyn do mycia szyb ' + sku,
    category: 'Chemia',
    catalog: 'shop',
    hasImage: true,
    imageUrl: 'https://x/a.jpg',
    stock: 1,
    ...over,
  }) as Product;

describe('EAN', () => {
  it('poprawne kody GS1', () => {
    expect(gs1CheckDigitOk('5901234123457')).toBe(true); // EAN-13
    expect(gs1CheckDigitOk('96385074')).toBe(true); // EAN-8
    expect(gs1CheckDigitOk('036000291452')).toBe(true); // UPC-A
  });

  it('wykrywa złą sumę kontrolną, długość i znaki', () => {
    expect(checkEan('5901234123458')).toBe('checksum');
    expect(checkEan('12345')).toBe('length');
    expect(checkEan('59012341234AB')).toBe('digits');
    expect(checkEan('')).toBe('empty');
    expect(checkEan('5901234123457')).toBe('ok');
  });
});

describe('walidacje produktu', () => {
  it('błędny EAN i duplikat EAN', () => {
    const a = p('A1', { ean: '5901234123458' });
    const b = p('B1', { ean: '5901234123457' });
    const c = p('C1', { ean: '5901234123457' });
    const ctx = buildValidationContext([a, b, c]);
    expect(validateProduct(a, ctx).some((f) => f.kind === 'eanBad')).toBe(true);
    const fb = validateProduct(b, ctx).find((f) => f.kind === 'dupEan');
    expect(fb?.label).toContain('C1');
    expect(validateProduct(b, ctx).some((f) => f.kind === 'eanBad')).toBe(false);
  });

  it('ten sam produkt w dwóch katalogach (to samo SKU) nie jest duplikatem', () => {
    const a = p('A1', { ean: '5901234123457' });
    const b = p('A1', { ean: '5901234123457', catalog: 'accessories' });
    expect(validateProduct(a, buildValidationContext([a, b])).some((f) => f.kind === 'dupEan')).toBe(false);
  });

  it('duplikat nazwy ignoruje wielkość liter i interpunkcję', () => {
    const a = p('A1', { displayName: 'Szampon Super-Piana 5 l' });
    const b = p('B1', { displayName: 'szampon super piana 5 L' });
    expect(normalizeName(a.displayName)).toBe(normalizeName(b.displayName));
    expect(validateProduct(a, buildValidationContext([a, b])).some((f) => f.kind === 'dupName')).toBe(true);
  });

  it('ceny: sprzedaż poniżej zakupu i niespójne netto/brutto', () => {
    const ctx = buildValidationContext([]);
    expect(validateProduct(p('A', { priceSaleNet: 8, pricePurchaseNet: 10 }), ctx).some((f) => f.kind === 'priceBelow')).toBe(true);
    expect(validateProduct(p('A', { priceSaleNet: 100, priceSaleGross: 130 }), ctx).some((f) => f.kind === 'priceMismatch')).toBe(true);
    expect(validateProduct(p('A', { priceSaleNet: 100, priceSaleGross: 123 }), ctx).some((f) => f.kind === 'priceMismatch')).toBe(false);
  });

  it('długi tytuł i formatowanie nazwy', () => {
    const ctx = buildValidationContext([]);
    expect(validateProduct(p('A', { displayName: 'x'.repeat(90) }), ctx).some((f) => f.kind === 'titleLong')).toBe(true);
    expect(validateProduct(p('A', { displayName: 'Płyn  do mycia ' }), ctx).some((f) => f.kind === 'nameFormat')).toBe(true);
    expect(validateProduct(p('A', { displayName: 'PŁYN DO MYCIA SZYB' }), ctx).some((f) => f.kind === 'nameFormat')).toBe(true);
  });
});

describe('walidacje w Uzupełnianiu danych', () => {
  it('pojawiają się jako braki i znikają po wyjątku „walidacje”', () => {
    const bad = p('A1', { ean: '5901234123458', priceSaleGross: 10, priceSaleNet: 8.13, manufacturer: 'SONAX' });
    const rows = buildCatalogDecisionRows([bad]);
    expect(rows[0].issues.some((i) => i.label.startsWith('błędny EAN'))).toBe(true);
    const ex = buildCatalogDecisionRows([{ ...bad, meta: { dataExceptions: ['validation'] } } as Product]);
    expect(ex.every((r) => r.issues.every((i) => !i.label.startsWith('błędny EAN')))).toBe(true);
  });
});
