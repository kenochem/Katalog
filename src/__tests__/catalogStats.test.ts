import { describe, expect, it } from 'vitest';
import { computeCatalogStats, suggestNext } from '../lib/catalogStats';
import type { Product } from '../types';

function product(over: Partial<Product> & { sku: string }): Product {
  return {
    id: over.sku,
    name: 'Produkt testowy ' + over.sku,
    displayName: 'Produkt testowy ' + over.sku,
    category: 'Chemia',
    catalog: 'shop',
    hasImage: false,
    stock: 0,
    ...over,
  } as Product;
}

describe('statystyki katalogu', () => {
  const list = [
    product({ sku: 'A1', hasImage: true, ean: '5900000000001', manufacturer: 'SONAX', stock: 4, priceSaleGross: 10 }),
    product({ sku: 'A2', hasImage: true, manufacturer: 'SONAX', stock: 0, priceSaleGross: 12 }),
    product({ sku: 'B1', manufacturer: 'KARCHER', stock: 0 }),
    product({ sku: 'B2', manufacturer: 'KARCHER', stock: 0 }),
  ];
  const stats = computeCatalogStats(list);

  it('liczy zdjęcia, EAN, producentów i ceny', () => {
    expect(stats.total).toBe(4);
    expect(stats.withPhoto).toBe(2);
    expect(stats.withEan).toBe(1);
    expect(stats.withManufacturer).toBe(4);
    expect(stats.withPrice).toBe(2);
    expect(stats.inStock).toBe(1);
    expect(stats.zeroStock).toBe(3);
  });

  it('histogram i poziomy obejmują wszystkie produkty', () => {
    expect(stats.histogram.reduce((a, b) => a + b, 0)).toBe(4);
    expect(Object.values(stats.levels).reduce((a, b) => a + b, 0)).toBe(4);
  });

  it('grupuje po producentach z procentem zdjęć', () => {
    const sonax = stats.manufacturers.find((m) => m.name === 'SONAX');
    const karcher = stats.manufacturers.find((m) => m.name === 'KARCHER');
    expect(sonax?.count).toBe(2);
    expect(sonax?.photoPct).toBe(100);
    expect(karcher?.photoPct).toBe(0);
  });

  it('podpowiedzi są posortowane wg zysku i wskazują rodzaj braku', () => {
    const s = suggestNext(stats, 10);
    expect(s.length).toBeGreaterThan(0);
    for (let i = 1; i < s.length; i++) expect(s[i - 1].gain).toBeGreaterThanOrEqual(s[i].gain);
    expect(s.some((x) => x.kinds.includes('photo'))).toBe(true);
    expect(s.some((x) => x.kinds.includes('ean'))).toBe(true);
  });

  it('pusty katalog nie daje podpowiedzi ani błędów', () => {
    const empty = computeCatalogStats([]);
    expect(empty.total).toBe(0);
    expect(empty.avgScore).toBe(0);
    expect(suggestNext(empty)).toEqual([]);
  });
});
