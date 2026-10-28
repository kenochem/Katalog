import { describe, expect, it } from 'vitest';
import type { Product } from '../types';
import { NAME_MAX, buildNameContext, checkName, findCapacities, suggestName } from '../lib/nameStandard';

const p = (displayName: string, manufacturer: string, category = 'Chemia', sku = displayName): Product =>
  ({ id: sku, sku, name: displayName, displayName, manufacturer, category }) as unknown as Product;

const brandSet = (brand: string, written = brand) => [1, 2, 3].map((i) => p(`${written} Produkt ${i} 1L`, brand, 'Chemia', `${brand}${i}`));

const all = [
  ...brandSet('Nerta'),
  ...brandSet('DAFI'),
  ...brandSet('TENZI'),
  ...brandSet('ATAS'),
  ...brandSet('SONAX'),
  ...brandSet('Concept'),
  ...[1, 2, 3].map((i) => p(`Zawór typ ${i}`, 'HYDROFLEX', 'Zawory', `H${i}`)),
];
const ctx = buildNameContext(all);

describe('standard nazw produktów', () => {
  it('rozpoznaje pojemność i normalizuje zapis', () => {
    expect(findCapacities('Płyn 20 kg')[0].normalized).toBe('20kg');
    expect(findCapacities('Mydło 100gr')[0].normalized).toBe('100g');
    expect(findCapacities('Odmrażacz 0,6L')[0].normalized).toBe('0,6L');
    expect(findCapacities('Zestaw 2x5L')).toHaveLength(0);
    expect(findCapacities('Zawór 1/4 8 Bar')).toHaveLength(0);
  });

  it('porządkuje separator, pojemność i zapis producenta', () => {
    const s = suggestName(p('NERTA Sky WE 64 20l. Aktywna piana', 'Nerta'), ctx);
    expect(s.name).toBe('Nerta Sky WE 64 20L - Aktywna piana');
    expect(s.changed).toBe(true);
  });

  it('przenosi pojemność z opisu i skraca za długi opis', () => {
    const s = suggestName(p('CAR PRO Spotless 2.0 - 1L - preparat do usuwania śladów po twardej wodzie', 'DETAILING'), ctx);
    expect(s.name).toBe('CAR PRO Spotless 2.0 1L - preparat do usuwania śladów');
    expect(s.name.length).toBeLessThanOrEqual(NAME_MAX);
    expect(s.needsReview).toBe(true);
  });

  it('wersaliki zamienia na zapis zdaniowy i dopisuje producenta', () => {
    const s = suggestName(p('MYDŁO LUKSJA 100gr', 'DAFI'), ctx);
    expect(s.name).toBe('DAFI Mydło luksja 100g');
    expect(s.needsReview).toBe(true);
  });

  it('marki, których nie ma w nazwach (dostawcy/części), nie są wymagane', () => {
    const issues = checkName(p('Zawór kulowy', 'HYDROFLEX', 'Zawory'), ctx).map((i) => i.kind);
    expect(issues).not.toContain('noBrand');
    expect(suggestName(p('Zawór kulowy', 'HYDROFLEX', 'Zawory'), ctx).name).toBe('Zawór kulowy');
    expect(checkName(p('Złącze elastyczne do odkurzacza DN32/36', 'AKCESORIA DO MYJNI', 'Adaptery'), ctx)).toEqual([]);
  });

  it('wykrywa inną markę w nazwie zamiast dopisywać producenta', () => {
    const prod = p('Tenzi Odmrażacz 0,6L', 'ATAS');
    expect(checkName(prod, ctx).map((i) => i.kind)).toContain('brandOther');
    expect(suggestName(prod, ctx).name).toBe('Tenzi Odmrażacz 0,6L');
  });

  it('usuwa powtórzoną markę', () => {
    const prod = p('Sonax Sonax Xtreme 500ml', 'SONAX');
    expect(checkName(prod, ctx).map((i) => i.kind)).toContain('brandDup');
    expect(suggestName(prod, ctx).name).toBe('SONAX Xtreme 500ml');
  });

  it('flaguje brak pojemności tylko dla chemii', () => {
    expect(checkName(p('Płyn do szyb Eco Super', 'Eco'), ctx).map((i) => i.kind)).toContain('noCapacity');
    expect(checkName(p('Dysza wody 1/4 40-120', 'HYDROFLEX', 'Dysze'), ctx).map((i) => i.kind)).not.toContain('noCapacity');
  });

  it('poprawna nazwa nie zmienia się', () => {
    const prod = p('TENZI RUBBER OFF 1L - usuwanie śladów po oponach', 'TENZI');
    expect(suggestName(prod, ctx).changed).toBe(false);
    expect(checkName(prod, ctx)).toEqual([]);
  });
});
