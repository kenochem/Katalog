import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ProductDetailFacts } from '../components/product/ProductDetailRichPanels';
import type { Product } from '../types';

const product = {
  id: 'shop-CIDL0038',
  sku: 'CIDL0038',
  name: 'Kenotek Aktywna piana',
  displayName: 'Kenotek Active Foam 20 kg',
  category: 'Aktywne piany',
  catalog: 'shop',
  manufacturer: 'KENOTEK',
  ean: '5414829081563',
  stock: 40,
  hasImage: true,
  imageUrl: 'https://x/a.jpg',
  extraImageUrls: ['https://x/b.jpg'],
  tags: ['wapro-import', 'chemia'],
  meta: { weightKg: 20, vatRate: 23, shopCategoryPath: 'Chemia samochodowa › Mycie samochodu › Aktywne piany' },
} as unknown as Product;

describe('karta Identyfikacja / Magazyn', () => {
  it('renderuje kody, producenta, ścieżkę kategorii i kafelki magazynu', () => {
    const html = renderToStaticMarkup(createElement(ProductDetailFacts, { detail: product, locationCode: 'A-01' }));
    expect(html).toContain('CIDL0038');
    expect(html).toContain('5414829081563');
    expect(html).toContain('KENOTEK');
    expect(html).toContain('Mycie samochodu');
    expect(html).toContain('A-01');
    expect(html).toContain('20 kg');
    expect(html).toContain('23%');
    expect(html).toContain('wapro-import');
  });

  it('brak EAN i zdjęć jest wyraźnie zaznaczony', () => {
    const html = renderToStaticMarkup(
      createElement(ProductDetailFacts, {
        detail: { ...product, ean: '', hasImage: false, imageUrl: '', extraImageUrls: [], stock: 0 } as Product,
        locationCode: '',
      }),
    );
    expect(html).toContain('brak');
    expect(html).toContain('Brak');
    expect(html).toContain('brak na magazynie');
  });
});
