import { describe, expect, it } from 'vitest';
import type { Product } from '../types';
import { supplierBrands, supplierOverview } from '../lib/suppliers';

const p = (id: string, manufacturer: string, supplier?: string, isGroup = false) => ({ id, sku: id, manufacturer, isGroup, meta: supplier ? { supplier } : {} }) as unknown as Product;
const mf = (x: Product) => x.manufacturer;

describe('dostawcy a producenci', () => {
  const products = [p('1', 'SONAX', 'SONAX'), p('2', 'SONAX', 'SONAX'), p('3', 'KARCHER', 'MERSA'), p('4', 'TORNADOR', 'MERSA'), p('5', 'ROYAL', ''), p('6', 'X', 'MERSA', true)];

  it('rozkłada produkty dostawcy na marki', () => {
    expect(supplierBrands(products, 'mersa', mf)).toEqual([
      { brand: 'KARCHER', count: 1 },
      { brand: 'TORNADOR', count: 1 },
    ]);
  });

  it('liczy pokrycie dostawcą i zgodność z producentem, pomijając grupy', () => {
    const o = supplierOverview(products, mf);
    expect(o).toMatchObject({ products: 5, withSupplier: 4, withoutSupplier: 1, sameAsManufacturer: 2 });
  });
});
