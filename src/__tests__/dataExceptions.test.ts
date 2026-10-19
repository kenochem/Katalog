import { describe, expect, it } from 'vitest';
import { buildCatalogDecisionRows } from '../components/CatalogDecisionView';
import { EXCEPTION_PRESETS, exceptionsOf } from '../lib/dataExceptions';
import type { Product } from '../types';

const base = {
  name: 'Produkt testowy do wyjątków',
  displayName: 'Produkt testowy do wyjątków',
  category: 'Chemia',
  catalog: 'shop',
  hasImage: false,
  stock: 0,
} as unknown as Product;

const p = (sku: string, meta?: Product['meta']): Product => ({ ...base, id: sku, sku, meta });

describe('wyjątki w uzupełnianiu danych', () => {
  it('produkt bez wyjątku ma braki na liście', () => {
    const rows = buildCatalogDecisionRows([p('A1')]);
    expect(rows).toHaveLength(1);
    expect(rows[0].issues.some((i) => i.kind === 'photo')).toBe(true);
    expect(rows[0].issues.some((i) => i.kind === 'bl')).toBe(true);
  });

  it('wyjątek wyłącza tylko wskazany rodzaj braku', () => {
    const rows = buildCatalogDecisionRows([p('A2', { dataExceptions: ['bl', 'photo'] })]);
    expect(rows).toHaveLength(1);
    const kinds = rows[0].issues.map((i) => i.kind);
    expect(kinds).not.toContain('bl');
    expect(kinds).not.toContain('photo');
    expect(kinds).toContain('ean');
  });

  it('wyjątek „all” usuwa produkt z listy braków i pokazuje go w widoku wyjątków', () => {
    const items = [p('A3', { dataExceptions: ['all'] }), p('A4')];
    expect(buildCatalogDecisionRows(items, 'todo').map((r) => r.product.sku)).toEqual(['A4']);
    expect(buildCatalogDecisionRows(items, 'exceptions').map((r) => r.product.sku)).toEqual(['A3']);
  });

  it('widok wyjątków zachowuje pełną listę braków do wglądu', () => {
    const rows = buildCatalogDecisionRows([p('A5', { dataExceptions: ['bl'] })], 'exceptions');
    expect(rows[0].issues.some((i) => i.kind === 'bl')).toBe(true);
    expect(exceptionsOf(rows[0].product)).toEqual(['bl']);
  });

  it('gotowe wyjątki mają rodzaje i opis', () => {
    expect(EXCEPTION_PRESETS.length).toBeGreaterThan(3);
    for (const pr of EXCEPTION_PRESETS) {
      expect(pr.kinds.length).toBeGreaterThan(0);
      expect(pr.note).not.toBe('');
    }
    expect(EXCEPTION_PRESETS.find((x) => x.id === 'no-bl')?.kinds).toEqual(['bl']);
  });
});
