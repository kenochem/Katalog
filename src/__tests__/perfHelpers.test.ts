import { describe, expect, it } from 'vitest';
import { touchesSearchIndex } from '../lib/products';
import { loadSnapshot } from '../lib/productsSnapshot';

describe('optymalizacje ładowania i zdjęć', () => {
  it('zmiana zdjęć, stanu i ceny nie przebudowuje indeksu wyszukiwania', () => {
    expect(touchesSearchIndex({ customImageUrl: 'x', hasImage: true })).toBe(false);
    expect(touchesSearchIndex({ extraImageUrls: ['a'], stock: 3, priceSaleNet: 10 })).toBe(false);
  });
  it('zmiana nazwy, SKU, EAN, producenta lub kategorii przebudowuje indeks', () => {
    for (const k of ['name', 'displayName', 'sku', 'ean', 'manufacturer', 'category'] as const) expect(touchesSearchIndex({ [k]: 'x' })).toBe(true);
  });
  it('bez IndexedDB migawka jest po prostu pusta', async () => {
    expect(await loadSnapshot('shop')).toBeNull();
  });
});
