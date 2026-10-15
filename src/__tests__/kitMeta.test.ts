import { describe, expect, it } from 'vitest';
import type { Kit, Product } from '../types';
import { buildProductLookup } from '../lib/kitResolve';
import { formatKitCode, kitMatches, kitValue, nextKitCode, planKitCodes } from '../lib/kitMeta';

function kit(id: string, name: string, extra: Partial<Kit> = {}): Kit {
  return { id, name, description: '', category: 'zestawy', items: [], createdAt: 1, ...extra };
}

function prod(sku: string, name: string, gross?: number): Product {
  return { id: `shop-${sku}`, sku, name, displayName: name, category: 'x', manufacturer: '', ean: '', imageUrl: '', description: '', hasImage: false, stock: 5, catalog: 'shop', priceSaleGross: gross } as Product;
}

describe('kody katalogowe zestawów', () => {
  it('formatuje kod z zerami', () => {
    expect(formatKitCode(1)).toBe('ZST-0001');
    expect(formatKitCode(123)).toBe('ZST-0123');
  });

  it('kolejny kod to największy istniejący + 1', () => {
    expect(nextKitCode([])).toBe('ZST-0001');
    expect(nextKitCode([kit('a', 'A', { code: 'ZST-0007' }), kit('b', 'B', { code: 'ZST-0003' }), kit('c', 'C')])).toBe('ZST-0008');
  });

  it('plan nadania kodów: tylko zestawom bez kodu, od najstarszego, bez dziur i duplikatów', () => {
    const kits = [
      kit('new', 'Nowy', { createdAt: 300 }),
      kit('has', 'Ma kod', { createdAt: 200, code: 'ZST-0004' }),
      kit('old', 'Stary', { createdAt: 100 }),
    ];
    const plan = planKitCodes(kits);
    expect(plan.map((p) => `${p.kit.id}:${p.code}`)).toEqual(['old:ZST-0005', 'new:ZST-0006']);
  });
});

describe('wyszukiwanie zestawów', () => {
  const p1 = prod('FRE000001', 'Freshtek Joy', 20);
  const lookup = buildProductLookup([p1]);
  const k = kit('k1', 'Zestaw Freshtek 6x600ml', {
    code: 'ZST-0042',
    items: [{ productId: p1.id, sku: p1.sku, name: p1.name, quantity: 2 }],
  });

  it('po nazwie, kodzie, SKU i nazwie składnika', () => {
    expect(kitMatches(k, 'freshtek 6x600', lookup)).toBe(true);
    expect(kitMatches(k, 'zst-0042', lookup)).toBe(true);
    expect(kitMatches(k, 'FRE000001', lookup)).toBe(true);
    expect(kitMatches(k, 'joy', lookup)).toBe(true);
  });

  it('wszystkie słowa muszą pasować; puste zapytanie pokazuje wszystko', () => {
    expect(kitMatches(k, 'freshtek paczula', lookup)).toBe(false);
    expect(kitMatches(k, '   ', lookup)).toBe(true);
  });

  it('nie wymaga polskich znaków', () => {
    const z = kit('k2', 'Zestaw żeli do rąk');
    expect(kitMatches(z, 'zel rak', lookup)).toBe(true);
  });
});

describe('wartość zestawu', () => {
  it('sumuje ceny brutto składników razy ilość i liczy, ile ma cenę', () => {
    const a = prod('A', 'A', 10);
    const b = prod('B', 'B');
    const lookup = buildProductLookup([a, b]);
    const k = kit('k', 'K', {
      items: [
        { productId: a.id, sku: 'A', name: 'A', quantity: 3 },
        { productId: b.id, sku: 'B', name: 'B', quantity: 1 },
      ],
    });
    expect(kitValue(k, lookup)).toEqual({ gross: 30, priced: 1, total: 2 });
  });
});
