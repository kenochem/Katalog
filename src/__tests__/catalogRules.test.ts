import { describe, expect, it } from 'vitest';
import { actionWouldChange, describeAction, describeCondition, matchesCondition, matchesRule, ruleIsValid } from '../lib/catalogRules';
import type { Product } from '../types';

const p = (over: Partial<Product> = {}): Product =>
  ({
    id: 'a',
    sku: 'KARC0012',
    name: 'Obudowa pompy Karcher',
    displayName: 'Obudowa pompy do myjki',
    category: 'Chemia',
    catalog: 'accessories',
    manufacturer: '',
    hasImage: false,
    imageUrl: '',
    stock: 0,
    ...over,
  }) as Product;

describe('reguły jakości — warunki', () => {
  it('tekst: zawiera / nie zawiera / zaczyna się od / równe (bez względu na wielkość liter i polskie znaki)', () => {
    expect(matchesCondition(p(), { field: 'name', op: 'contains', value: 'OBUDOWA' })).toBe(true);
    expect(matchesCondition(p(), { field: 'name', op: 'notContains', value: 'szampon' })).toBe(true);
    expect(matchesCondition(p(), { field: 'sku', op: 'startsWith', value: 'karc' })).toBe(true);
    expect(matchesCondition(p({ displayName: 'Płyn do mycia' }), { field: 'name', op: 'contains', value: 'plyn' })).toBe(true);
  });

  it('puste / uzupełnione oraz liczby', () => {
    expect(matchesCondition(p(), { field: 'image', op: 'empty', value: '' })).toBe(true);
    expect(matchesCondition(p({ hasImage: true }), { field: 'image', op: 'notEmpty', value: '' })).toBe(true);
    expect(matchesCondition(p(), { field: 'stock', op: 'equals', value: '0' })).toBe(true);
    expect(matchesCondition(p({ stock: 5 }), { field: 'stock', op: 'gt', value: '3' })).toBe(true);
    expect(matchesCondition(p({ priceSaleGross: 12 }), { field: 'priceSaleGross', op: 'lt', value: '10' })).toBe(false);
    expect(matchesCondition(p(), { field: 'priceSaleGross', op: 'empty', value: '' })).toBe(true);
  });

  it('reguła wymaga spełnienia wszystkich warunków, a pusta nie pasuje do niczego', () => {
    const conds = [
      { field: 'name' as const, op: 'contains' as const, value: 'obudowa' },
      { field: 'stock' as const, op: 'equals' as const, value: '0' },
    ];
    expect(matchesRule(p(), conds)).toBe(true);
    expect(matchesRule(p({ stock: 3 }), conds)).toBe(false);
    expect(matchesRule(p(), [])).toBe(false);
  });
});

describe('reguły jakości — akcje i walidacja', () => {
  it('akcja pomija produkty już w stanie docelowym', () => {
    expect(actionWouldChange(p(), { type: 'hide', reason: 'x' })).toBe(true);
    expect(actionWouldChange(p({ meta: { catalogHidden: true } }), { type: 'hide', reason: 'x' })).toBe(false);
    expect(actionWouldChange(p({ tags: ['a'] }), { type: 'addTag', value: 'a' })).toBe(false);
    expect(actionWouldChange(p({ manufacturer: 'KARCHER' }), { type: 'setManufacturer', value: 'KARCHER' })).toBe(false);
    expect(actionWouldChange(p({ meta: { dataExceptions: ['bl'] } }), { type: 'exception', kinds: ['bl'], note: '' })).toBe(false);
  });

  it('opisy warunków i akcji oraz walidacja formularza', () => {
    expect(describeCondition({ field: 'name', op: 'contains', value: 'x' })).toBe('Nazwa zawiera „x”');
    expect(describeAction({ type: 'hide', reason: 'Śmietnik Piotra' })).toContain('Śmietnik Piotra');
    expect(ruleIsValid({ name: '', conditions: [], action: { type: 'hide', reason: 'x' } })).toBeTruthy();
    expect(ruleIsValid({ name: 'ok', conditions: [{ field: 'name', op: 'contains', value: '' }], action: { type: 'hide', reason: 'x' } })).toBeTruthy();
    expect(ruleIsValid({ name: 'ok', conditions: [{ field: 'image', op: 'empty', value: '' }], action: { type: 'hide', reason: 'x' } })).toBeNull();
  });
});
