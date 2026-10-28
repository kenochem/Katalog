import { describe, expect, it } from 'vitest';
import type { Product } from '../types';
import type { ProductSyncChange } from '../lib/productSyncChanges';
import { buildMarginSeries, buildPriceMoves, marginPct } from '../lib/priceMonitor';

const ch = (sku: string, field: ProductSyncChange['field'], o: number, n: number, at: string): ProductSyncChange => ({
  id: `${sku}${field}${at}`,
  request_id: null,
  product_id: sku,
  sku,
  display_name: sku,
  field,
  old_value: o,
  new_value: n,
  changed_at: at,
});

const prod = (sku: string, buy: number, net: number): Product =>
  ({ id: sku, sku, name: sku, displayName: sku, manufacturer: 'X', pricePurchaseNet: buy, priceSaleNet: net }) as unknown as Product;

describe('monitor cen i marży', () => {
  it('marża liczona od sprzedaży netto', () => {
    expect(marginPct(100, 80)).toBeCloseTo(20);
    expect(marginPct(0, 80)).toBeUndefined();
  });

  it('agreguje zmiany i zgłasza zakup w górę przy stałej sprzedaży', () => {
    const rows = buildPriceMoves(
      [ch('A', 'price_purchase_net', 50, 60, '2026-10-01T10:00:00Z'), ch('A', 'price_purchase_net', 60, 70, '2026-10-02T10:00:00Z')],
      [prod('A', 70, 100)],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].buy).toMatchObject({ from: 50, to: 70 });
    expect(rows[0].buy?.pct).toBeCloseTo(40);
    expect(rows[0].alerts).toContain('buyUpSaleFlat');
    expect(rows[0].alerts).toContain('jump');
    expect(rows[0].marginBefore).toBeCloseTo(50);
    expect(rows[0].marginNow).toBeCloseTo(30);
  });

  it('sprzedaż poniżej zakupu i niska marża', () => {
    const below = buildPriceMoves([ch('B', 'price_sale_net', 100, 90, '2026-10-01T10:00:00Z')], [prod('B', 95, 90)]);
    expect(below[0].alerts).toContain('belowCost');
    const low = buildPriceMoves([ch('C', 'price_sale_net', 100, 105, '2026-10-01T10:00:00Z')], [prod('C', 95, 105)]);
    expect(low[0].alerts).toContain('lowMargin');
  });

  it('seria marży korzysta z wartości sprzed pierwszej zmiany', () => {
    const s = buildMarginSeries(
      [ch('A', 'price_purchase_net', 80, 90, '2026-10-01T10:00:00Z'), ch('A', 'price_sale_net', 100, 120, '2026-10-02T10:00:00Z')],
      (i) => i.slice(5, 10),
    );
    expect(s).toHaveLength(2);
    expect(s[0].marginPct).toBe(10);
    expect(s[1].marginPct).toBe(25);
    expect(s[1].marginPln).toBe(30);
  });
});
