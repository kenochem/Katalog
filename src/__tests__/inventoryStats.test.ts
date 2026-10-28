import { describe, expect, it } from 'vitest';
import type { Product } from '../types';
import { computeInventoryStats, formatMoney } from '../lib/inventoryStats';

const p = (sku: string, extra: Partial<Product> = {}): Product =>
  ({ id: sku, sku, name: sku, displayName: sku, manufacturer: 'ACME', category: 'Chemia', stock: 0, ean: '', description: '', hasImage: false, imageUrl: '', catalog: 'shop', ...extra }) as unknown as Product;

describe('statystyki magazynu i marż', () => {
  it('liczy wartość zapasu, marże i rozkłady', () => {
    const s = computeInventoryStats([
      p('A', { stock: 10, pricePurchaseNet: 10, priceSaleNet: 20, priceSaleGross: 24.6 }),
      p('B', { stock: 3, pricePurchaseNet: 30, priceSaleNet: 20, priceSaleGross: 24.6 }),
      p('C', { stock: 0 }),
      p('G', { isGroup: true, variants: [{ sku: 'A', name: 'a', stock: 10 }, { sku: 'B', name: 'b', stock: 3 }] }),
    ]);
    expect(s.singles).toBe(3);
    expect(s.groups).toBe(1);
    expect(s.groupVariants).toBe(2);
    expect(s.units).toBe(13);
    expect(s.valuePurchase).toBe(10 * 10 + 3 * 30);
    expect(s.valueSale).toBe(10 * 20 + 3 * 20);
    expect(s.withMargin).toBe(2);
    expect(s.negativeMargin).toBe(1);
    expect(s.avgMarginPct).toBeCloseTo((50 + -50) / 2);
    expect(s.lowStock).toBe(1);
    expect(s.noPurchasePrice).toBe(1);
    expect(s.stockBuckets.map((b) => b.count)).toEqual([1, 1, 1, 0, 0, 0]);
    expect(s.topByValue[0].product.sku).toBe('A');
    expect(s.worstMargins[0].product.sku).toBe('B');
  });

  it('formatuje kwoty', () => {
    expect(formatMoney(1_500_000, true)).toContain('mln');
    expect(formatMoney(12345)).toContain('zł');
  });
});
