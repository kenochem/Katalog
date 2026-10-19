import { describe, expect, it } from 'vitest';
import { coerceAttrValue, formatAttrValue, hasAttrValue, slugKey, validateAttrValue, type AttributeDef } from '../lib/attributes';
import { computeChanges, type BulkSource } from '../lib/bulkEdit';

const def = (over: Partial<AttributeDef> = {}): AttributeDef => ({
  key: 'pojemnosc',
  label: 'Pojemność',
  type: 'number',
  unit: 'l',
  options: [],
  categories: [],
  required: false,
  sort: 0,
  ...over,
});

describe('atrybuty strukturalne', () => {
  it('klucz z nazwy: bez polskich znaków i spacji', () => {
    expect(slugKey('Pojemność opakowania')).toBe('pojemnosc_opakowania');
    expect(slugKey('Łatwość użycia (1-5)')).toBe('latwosc_uzycia_1_5');
  });

  it('wartości: liczba z przecinkiem, tak/nie, tekst', () => {
    expect(coerceAttrValue(def(), '2,5')).toBe(2.5);
    expect(coerceAttrValue(def(), 'abc')).toBeUndefined();
    expect(coerceAttrValue(def({ type: 'bool' }), 'Tak')).toBe(true);
    expect(coerceAttrValue(def({ type: 'text' }), '  czerwony ')).toBe('czerwony');
    expect(coerceAttrValue(def(), '')).toBeUndefined();
  });

  it('walidacja wg typu, listy wartości i wymagalności', () => {
    expect(validateAttrValue(def({ required: true }), undefined)).toBe('wymagane');
    expect(validateAttrValue(def(), undefined)).toBeNull();
    expect(validateAttrValue(def({ type: 'select', options: ['a', 'b'] }), 'c')).toBe('wartość spoza listy');
    expect(validateAttrValue(def({ type: 'select', options: ['a', 'b'] }), 'a')).toBeNull();
    expect(validateAttrValue(def(), 5)).toBeNull();
  });

  it('formatowanie z jednostką i wartości puste', () => {
    expect(formatAttrValue(def(), 5)).toBe('5 l');
    expect(formatAttrValue(def({ type: 'bool', unit: '' }), true)).toBe('Tak');
    expect(formatAttrValue(def(), undefined)).toBe('—');
    expect(hasAttrValue('')).toBe(false);
    expect(hasAttrValue(0)).toBe(true);
    expect(hasAttrValue(false)).toBe(true);
  });
});

describe('edycja masowa atrybutu', () => {
  const src: BulkSource = {
    manufacturer: '',
    category: '',
    tags: [],
    priceSaleGross: null,
    priceSaleNet: null,
    pricePurchaseNet: null,
    meta: { attrs: { kolor: 'czerwony' } },
  };

  it('dopisuje wartość, zachowując pozostałe atrybuty, w formie odwracalnej zmiany meta', () => {
    const ch = computeChanges(src, { attr: { key: 'pojemnosc', value: 5 } });
    expect(ch).toHaveLength(1);
    expect(ch[0]).toMatchObject({ label: 'meta: attrs', metaKey: 'attrs', from: { kolor: 'czerwony' }, to: { kolor: 'czerwony', pojemnosc: 5 } });
  });

  it('brak zmiany, gdy wartość już jest taka sama', () => {
    expect(computeChanges(src, { attr: { key: 'kolor', value: 'czerwony' } })).toHaveLength(0);
  });
});
