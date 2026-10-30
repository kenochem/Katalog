import { describe, expect, it } from 'vitest';
import type { Product } from '../types';
import { auditToCsv, runAudit } from '../lib/assortmentAudit';

const mk = (o: Partial<Product>): Product =>
  ({ id: o.sku, sku: 'X', name: '', displayName: '', category: '', manufacturer: '', ean: '', imageUrl: '', description: '', hasImage: false, stock: 0, catalog: 'accessories', ...o }) as Product;

describe('runAudit', () => {
  const products = [
    mk({ sku: 'A1', name: 'SONAX Szampon do mycia auto 500 ml', displayName: 'SONAX Szampon do mycia auto 500 ml', manufacturer: 'SONAX', priceSaleGross: 20, priceSaleNet: 16.26 }),
    mk({ sku: 'A2', name: 'SONAX Szampon z woskiem 1 l', displayName: 'SONAX Szampon z woskiem 1 l', manufacturer: 'SONAX', priceSaleGross: 30, priceSaleNet: 24.4 }),
    mk({ sku: 'A3', name: 'SONAX Wosk twardy 200 ml', displayName: 'SONAX Wosk twardy 200 ml', manufacturer: 'SONAX', priceSaleGross: 40, priceSaleNet: 32.5 }),
    mk({ sku: 'B1', name: 'ŹZ-Z RĘCZNIK 2W', displayName: 'ŹZ-Z RĘCZNIK 2W', manufacturer: 'WAPRO' }),
    mk({ sku: 'D1', name: 'Szampon do mycia auto 250 ml', displayName: 'Szampon do mycia auto 250 ml', manufacturer: 'INNI PRODUCENCI' }),
    mk({ sku: 'C1', name: 'Sonax Szampon koncentrat 500 ml', displayName: 'Sonax Szampon koncentrat 500 ml', manufacturer: '' }),
  ];

  it('wykrywa brak producenta, ogólnego producenta, prefiks ŹZ i brak ceny', () => {
    const r = runAudit(products);
    const codes = (sku: string) => r.rows.find((x) => x.sku === sku)!.issues.map((i) => i.code);
    expect(codes('B1')).toEqual(expect.arrayContaining(['M-BRAK', 'N-SMIECI', 'S-CENA']));
    expect(codes('C1')).toContain('M-BRAK');
    expect(r.rows.find((x) => x.sku === 'C1')!.issues.find((i) => i.code === 'M-BRAK')!.suggestion).toBe('SONAX');
    expect(codes('D1')).toContain('M-OGOLNY');
    expect(r.summary.total).toBe(6);
  });

  it('eksportuje CSV z nagłówkiem i wierszem na problem', () => {
    const csv = auditToCsv(runAudit(products));
    expect(csv.split('\r\n')[0]).toContain('SKU');
    expect(csv).toContain('M-BRAK');
  });
});
