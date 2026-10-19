import { describe, expect, it } from 'vitest';
import { applyPrice, computeChanges, roundPrice, type BulkSource } from '../lib/bulkEdit';
import { batchOf, canRevert, groupBatches, isBatchKey, visibleChanges } from '../lib/productHistory';
import type { AuditEntry } from '../lib/auditLog';

const src = (over: Partial<BulkSource> = {}): BulkSource => ({
  manufacturer: 'SONAX',
  category: 'Chemia',
  tags: ['a', 'b'],
  priceSaleGross: 123,
  priceSaleNet: 100,
  pricePurchaseNet: 60,
  meta: { vatRate: 23, unit: 'szt.' },
  ...over,
});

describe('zaokrąglanie i ceny', () => {
  it('zaokrągla do groszy, dziesiątek groszy, złotych i końcówek', () => {
    expect(roundPrice(12.345, '0.01')).toBe(12.35);
    expect(roundPrice(12.34, '0.10')).toBe(12.3);
    expect(roundPrice(12.5, '1')).toBe(13);
    expect(roundPrice(12.34, '.99')).toBe(12.99);
    expect(roundPrice(12.34, '.90')).toBe(12.9);
  });

  it('zmiana o procent, kwotę i ustawienie wartości', () => {
    expect(applyPrice(100, 'percent', 10, '0.01')).toBe(110);
    expect(applyPrice(100, 'percent', -25, '0.01')).toBe(75);
    expect(applyPrice(10, 'amount', 2.5, '0.01')).toBe(12.5);
    expect(applyPrice(null, 'set', 9.99, '0.01')).toBe(9.99);
  });

  it('brak ceny bez ustawienia wartości nie jest zmieniany, a ujemny wynik pomijany', () => {
    expect(applyPrice(null, 'percent', 10, '0.01')).toBeNull();
    expect(applyPrice(5, 'amount', -10, '0.01')).toBeNull();
  });
});

describe('wyliczanie zmian edycji masowej', () => {
  it('zmienia tylko to, co się różni', () => {
    expect(computeChanges(src(), { manufacturer: 'SONAX', category: 'Mycie' }).map((c) => c.label)).toEqual(['Kategoria']);
  });

  it('cena sprzedaży brutto +10% przelicza netto wg VAT', () => {
    const ch = computeChanges(src(), { price: { field: 'priceSaleGross', mode: 'percent', value: 10, round: '0.01', recompute: true } });
    const gross = ch.find((c) => c.label === 'Cena sprzedaży brutto');
    const net = ch.find((c) => c.label === 'Cena sprzedaży netto');
    expect(gross?.to).toBe(135.3);
    expect(net?.to).toBe(110);
  });

  it('VAT i jednostka trafiają do meta z etykietami zgodnymi z dziennikiem', () => {
    const ch = computeChanges(src(), { vatRate: 8, unit: 'l' });
    expect(ch.map((c) => c.label)).toEqual(['meta: vatRate', 'meta: unit']);
    expect(ch[0]).toMatchObject({ metaKey: 'vatRate', from: 23, to: 8 });
  });

  it('tagi: dodawanie bez duplikatów i usuwanie bez względu na wielkość liter', () => {
    const ch = computeChanges(src(), { tagsAdd: ['C', 'a'], tagsRemove: ['B'] });
    expect(ch[0].to).toEqual(['a', 'C']);
  });
});

const entry = (id: string, changes: AuditEntry['changes'], at = '2026-10-19T10:00:00Z'): AuditEntry => ({
  id,
  createdAt: at,
  userId: 'u',
  userLabel: 'Ola',
  userRole: 'operator',
  app: 'catalog',
  action: 'product.update',
  entityType: 'product',
  entityId: 'SKU' + id,
  entityLabel: 'x',
  summary: '',
  changes,
});

describe('historia i cofanie', () => {
  it('rozpoznaje znaczniki partii i ukrywa je w podglądzie zmian', () => {
    const e = entry('1', { Producent: { from: 'A', to: 'B' }, _batch: { from: null, to: 'b1' }, _batchLabel: { from: null, to: 'Edycja masowa' } });
    expect(isBatchKey('_batch')).toBe(true);
    expect(visibleChanges(e.changes).map(([k]) => k)).toEqual(['Producent']);
    expect(batchOf(e)).toEqual({ id: 'b1', label: 'Edycja masowa', undoes: undefined });
  });

  it('grupuje wpisy w partie, najnowsza pierwsza', () => {
    const mk = (id: string, batch: string, at: string) =>
      entry(id, { Producent: { from: 'A', to: 'B' }, _batch: { from: null, to: batch }, _batchLabel: { from: null, to: 'L' + batch } }, at);
    const groups = groupBatches([mk('1', 'b1', '2026-10-19T10:00:00Z'), mk('2', 'b1', '2026-10-19T10:01:00Z'), mk('3', 'b2', '2026-10-19T11:00:00Z')]);
    expect(groups.map((g) => g.id)).toEqual(['b2', 'b1']);
    expect(groups[1].entries).toHaveLength(2);
  });

  it('cofnięcie dostępne dla znanych pól, niedostępne dla skróconych wartości i nieznanych pól', () => {
    expect(canRevert('Producent', { from: 'A', to: 'B' }).ok).toBe(true);
    expect(canRevert('meta: unit', { from: null, to: 'l' }).ok).toBe(true);
    expect(canRevert('Dodatkowe zdjęcia', { from: 'skrócone…', to: [] }).ok).toBe(false);
    expect(canRevert('Nieznane pole', { from: 1, to: 2 }).ok).toBe(false);
    expect(canRevert('_batch', { from: null, to: 'x' }).ok).toBe(false);
  });
});
