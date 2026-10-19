import { describe, expect, it } from 'vitest';
import { PRICE_ROUND_OPTIONS, roundToEnding } from '../lib/priceRounding';

describe('wyrównywanie cen do końcówek', () => {
  it('przykłady z podpowiedzi przycisków', () => {
    for (const o of PRICE_ROUND_OPTIONS) {
      const expected = o.hint.split('→')[1].trim().replace(',', '.');
      expect(roundToEnding(31.81, o.mode)).toBe(Number(expected));
    }
  });

  it(',99 w dół i w górę dla cen już kończących się na ,99', () => {
    expect(roundToEnding(31.99, '99-down')).toBe(31.99);
    expect(roundToEnding(31.99, '99-up')).toBe(31.99);
    expect(roundToEnding(31.0, '99-down')).toBe(30.99);
  });

  it(',00 w dół/w górę/najbliższa', () => {
    expect(roundToEnding(31.2, '00-down')).toBe(31);
    expect(roundToEnding(31.2, '00-up')).toBe(32);
    expect(roundToEnding(31.2, '00-near')).toBe(31);
    expect(roundToEnding(31.5, '00-near')).toBe(32);
    expect(roundToEnding(31, '00-up')).toBe(31);
  });

  it(',90 i ,50 najbliższa', () => {
    expect(roundToEnding(12.34, '90-near')).toBe(11.9);
    expect(roundToEnding(12.7, '90-near')).toBe(12.9);
    expect(roundToEnding(12.74, '50-near')).toBe(12.5);
    expect(roundToEnding(12.76, '50-near')).toBe(12.5);
    expect(roundToEnding(13.3, '50-near')).toBe(13.5);
  });

  it('małe i nieprawidłowe wartości nie dają zera ani ujemnej ceny', () => {
    expect(roundToEnding(0.3, '99-down')).toBeGreaterThan(0);
    expect(roundToEnding(0, '00-up')).toBe(0);
    expect(Number.isNaN(roundToEnding(NaN, '00-up'))).toBe(true);
  });
});
