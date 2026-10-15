import { describe, expect, it } from 'vitest';
import { APP_CHANGELOG } from '../data/appChangelog';
import { APP_VERSION, RELEASES, entryVersion } from '../lib/appVersion';

describe('numeracja wersji z dziennika zmian', () => {
  it('wersja ma postać MAJOR.MINOR.PATCH', () => {
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('każdy wpis ma wersję, a wersje wpisów są unikalne', () => {
    const versions = APP_CHANGELOG.map((e) => entryVersion(e));
    expect(versions.every((v) => /^\d+\.\d+\.\d+$/.test(v))).toBe(true);
    expect(new Set(versions).size).toBe(versions.length);
  });

  it('w obrębie dnia najstarszy wpis ma patch 1, a najnowszy tyle, ile wpisów', () => {
    for (const r of RELEASES) {
      const patches = r.entries.map((e) => Number(entryVersion(e).split('.')[2])).sort((a, b) => a - b);
      expect(patches[0]).toBe(1);
      expect(patches[patches.length - 1]).toBe(r.entries.length);
      expect(r.version).toBe(`${r.base}.${r.entries.length}`);
    }
  });

  it('nowe wpisy (na górze tablicy) mają wyższy patch niż starsze z tego samego dnia', () => {
    const latest = RELEASES[0];
    const first = Number(entryVersion(latest.entries[0]).split('.')[2]);
    const last = Number(entryVersion(latest.entries[latest.entries.length - 1]).split('.')[2]);
    expect(first).toBeGreaterThanOrEqual(last);
  });

  it('każdy kolejny dzień podnosi MINOR o 1', () => {
    const chronological = [...RELEASES].reverse();
    chronological.forEach((r, i) => expect(r.base).toBe(`1.${i}`));
  });

  it('wersja aplikacji to wersja najnowszego wpisu najnowszego dnia', () => {
    expect(APP_VERSION).toBe(entryVersion(RELEASES[0].entries[0]));
  });
});
