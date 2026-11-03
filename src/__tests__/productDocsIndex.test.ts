import { describe, expect, it } from 'vitest';
import { hasProductDocs, markProductDocs } from '../lib/productDocsIndex';

describe('indeks materiałów produktów', () => {
  it('zaznacza i odznacza produkt po dodaniu lub usunięciu materiału', () => {
    expect(hasProductDocs('shop-X1')).toBe(false);
    markProductDocs('shop-X1', true);
    expect(hasProductDocs('shop-X1')).toBe(true);
    markProductDocs('shop-X1', false);
    expect(hasProductDocs('shop-X1')).toBe(false);
  });
});
