import { afterEach, describe, expect, it } from 'vitest';
import {
  getExtraManufacturers,
  manufacturerOptions,
  normalizeManufacturer,
  setExtraManufacturers,
} from '../lib/waproManufacturers';

describe('producenci spoza listy WAPRO', () => {
  afterEach(() => setExtraManufacturers([]));

  it('dodani producenci trafiają do listy wyboru i są sortowani', () => {
    setExtraManufacturers(['Zebra Pro', 'Alfa Clean']);
    const opts = manufacturerOptions();
    expect(opts).toContain('Zebra Pro');
    expect(opts).toContain('Alfa Clean');
    expect(opts.indexOf('Alfa Clean')).toBeLessThan(opts.indexOf('Zebra Pro'));
    expect(getExtraManufacturers()).toHaveLength(2);
  });

  it('normalizacja ujednolica wielkość liter także dla dodanych producentów', () => {
    setExtraManufacturers(['Alfa Clean']);
    expect(normalizeManufacturer('  alfa   clean ')).toBe('Alfa Clean');
    expect(normalizeManufacturer('sonax')).toBe('SONAX');
  });

  it('po wyczyszczeniu rejestru dodani producenci znikają, WAPRO zostaje', () => {
    setExtraManufacturers(['Alfa Clean']);
    setExtraManufacturers([]);
    expect(manufacturerOptions()).not.toContain('Alfa Clean');
    expect(normalizeManufacturer('karcher')).toBe('KARCHER');
  });
});
