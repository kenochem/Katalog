import { describe, expect, it } from 'vitest';
import type { Product } from '../types';
import { foldText, getProductSearchIndex, invalidateProductSearchIndex, searchIndexedProducts } from '../lib/productSearchIndex';

let seq = 0;
function product(name: string, extra: Partial<Product> = {}): Product {
  seq++;
  return {
    id: `p${seq}`,
    sku: `SKU${String(seq).padStart(5, '0')}`,
    name,
    displayName: name,
    category: 'Test',
    manufacturer: '',
    ean: '',
    imageUrl: '',
    description: '',
    hasImage: false,
    stock: 0,
    catalog: 'shop',
    ...extra,
  } as Product;
}

function search(products: Product[], q: string, opts?: { limit?: number }) {
  invalidateProductSearchIndex();
  return searchIndexedProducts(getProductSearchIndex(products), q, opts);
}

describe('wyszukiwarka katalogu', () => {
  it('zwraca WSZYSTKIE trafienia tekstowe (nie ucina do 100)', () => {
    const list = Array.from({ length: 180 }, (_, i) => product(`Olejek zapachowy nr ${i}`));
    list.push(product('Kala Chanti Denim 100ml - olejek zapachowy'));
    expect(search(list, 'olejek zapach').length).toBe(181);
  });

  it('wiele słów w dowolnej kolejności', () => {
    const list = [product('Zapachowy olejek Denim do dyfuzora'), product('Olejek do włosów')];
    const r = search(list, 'denim olejek');
    expect(r.map((p) => p.name)).toEqual(['Zapachowy olejek Denim do dyfuzora']);
  });

  it('słowa zawierające literę „s” nie są dzielone (regresja: split po literze s)', () => {
    const list = [product('Szampon samochodowy z woskiem'), product('Żel pod prysznic')];
    const r = search(list, 'woskiem szampon');
    expect(r.map((p) => p.name)).toEqual(['Szampon samochodowy z woskiem']);
  });

  it('nie wymaga polskich znaków', () => {
    const list = [product('Żel do rąk antybakteryjny')];
    expect(search(list, 'zel do rak')).toHaveLength(1);
    expect(foldText('Żółć')).toBe('zolc');
  });

  it('przeszukuje nazwy wariantów grupy', () => {
    const group = product('Olejek zapachowy', {
      isGroup: true,
      variants: [{ sku: 'V1', name: 'Zapach Denim 100ml', stock: 0 } as never],
    });
    expect(search([group, product('Inny produkt')], 'denim')).toHaveLength(1);
  });

  it('znajduje odmienione formy przez rdzeń słowa', () => {
    const list = [product('Olejek zapachowy Denim')];
    expect(search(list, 'olejku zapachowego').length).toBeGreaterThan(0);
  });

  it('dokładny SKU ma pierwszeństwo', () => {
    const a = product('Coś innego');
    const r = search([a, product('Produkt')], a.sku.toLowerCase());
    expect(r).toEqual([a]);
  });

  it('jawnie podany limit nadal działa (paleta poleceń)', () => {
    const list = Array.from({ length: 50 }, (_, i) => product(`Szampon ${i}`));
    expect(search(list, 'szampon', { limit: 8 })).toHaveLength(8);
  });

  it('zapytanie krótsze niż 2 znaki zwraca całą listę', () => {
    const list = [product('A'), product('B')];
    expect(search(list, 'a')).toHaveLength(2);
  });
});
