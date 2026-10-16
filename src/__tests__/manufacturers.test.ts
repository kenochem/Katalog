import { afterEach, describe, expect, it } from 'vitest';
import {
  getExtraManufacturers,
  isStaticManufacturer,
  setRemovedManufacturers,

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

  it('wycofany producent znika z listy wyboru, a statyczny jest rozpoznawany', () => {
    setRemovedManufacturers(['KALA', 'Stara Marka']);
    setExtraManufacturers(['Stara Marka', 'Nowa Marka']);
    const opts = manufacturerOptions(['Stara Marka']);
    expect(opts).not.toContain('KALA');
    expect(opts).not.toContain('Stara Marka');
    expect(opts).toContain('Nowa Marka');
    expect(isStaticManufacturer('kala')).toBe(true);
    expect(isStaticManufacturer('Nowa Marka')).toBe(false);
    setRemovedManufacturers([]);
  });

  it('po wyczyszczeniu rejestru dodani producenci znikają, WAPRO zostaje', () => {
    setExtraManufacturers(['Alfa Clean']);
    setExtraManufacturers([]);
    expect(manufacturerOptions()).not.toContain('Alfa Clean');
    expect(normalizeManufacturer('karcher')).toBe('KARCHER');
  });
});
