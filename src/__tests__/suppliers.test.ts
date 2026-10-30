import { describe, expect, it } from 'vitest';
import { computeChanges, type BulkSource } from '../lib/bulkEdit';
import { effectiveSupplier, SUPPLIER_FROM_MANUFACTURER } from '../lib/suppliers';
import { effectiveManufacturer } from '../lib/waproManufacturers';

const src = (o: Partial<BulkSource> = {}): BulkSource => ({
  manufacturer: '', category: '', tags: [], priceSaleGross: null, priceSaleNet: null, pricePurchaseNet: null, meta: {}, ...o,
});

describe('dostawcy i brak producenta', () => {
  it('dostawca: własny wygrywa nad grupą z WAPRO', () => {
    expect(effectiveSupplier({ meta: { supplier: 'MERSA', waproManufacturer: 'X' } })).toBe('MERSA');
    expect(effectiveSupplier({ meta: { waproManufacturer: 'SOFT99' } })).toBe('SOFT99');
    expect(effectiveSupplier({})).toBe('');
  });

  it('przepisuje producenta na dostawcę tylko gdy dostawca jest pusty', () => {
    const spec = { supplier: SUPPLIER_FROM_MANUFACTURER };
    expect(computeChanges(src({ manufacturer: 'MERSA' }), spec).map((c) => c.to)).toEqual(['MERSA']);
    expect(computeChanges(src({ manufacturer: 'MERSA', meta: { supplier: 'INNY' } }), spec)).toEqual([]);
    expect(computeChanges(src({ manufacturer: 'WAPRO' }), spec)).toEqual([]);
  });

  it('pusty producent ustawia flagę „bez producenta”, a wpisany ją zdejmuje', () => {
    const clear = computeChanges(src({ manufacturer: 'KALA' }), { manufacturer: '' });
    expect(clear.find((c) => c.metaKey === 'noManufacturer')?.to).toBe(true);
    const set = computeChanges(src({ manufacturer: '', meta: { noManufacturer: true } }), { manufacturer: 'SONAX' });
    expect(set.find((c) => c.metaKey === 'noManufacturer')?.to).toBeNull();
  });

  it('flaga „bez producenta” blokuje podpowiedź z prefiksu SKU', () => {
    expect(effectiveManufacturer({ manufacturer: '', sku: 'KAL000001', meta: { noManufacturer: true } })).toBe('');
  });
});
