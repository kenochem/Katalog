import { describe, expect, it } from 'vitest';
import { APP_CHANGELOG } from '../data/appChangelog';
import { APP_VERSION, LEGACY_UNTIL, RELEASES, changeSize, entryVersion } from '../lib/appVersion';

const parse = (v: string) => v.split('.').map(Number) as [number, number, number];

describe('numeracja wersji z dziennika zmian', () => {
  it('wersja ma postać MAJOR.MINOR.PATCH', () => {
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('każdy wpis ma wersję, a wersje wpisów są unikalne', () => {
    const versions = APP_CHANGELOG.map((e) => entryVersion(e));
    expect(versions.every((v) => /^\d+\.\d+\.\d+$/.test(v))).toBe(true);
    expect(new Set(versions).size).toBe(versions.length);
  });

  it('stara zasada dzienna (do LEGACY_UNTIL): najstarszy wpis dnia ma patch 1, najnowszy tyle, ile wpisów', () => {
    for (const r of RELEASES.filter((x) => x.date <= LEGACY_UNTIL)) {
      const patches = r.entries.map((e) => parse(entryVersion(e))[2]).sort((a, b) => a - b);
      expect(patches[0]).toBe(1);
      expect(patches[patches.length - 1]).toBe(r.entries.length);
    }
  });

  it('wersje nigdy nie maleją w czasie', () => {
    const chronological = [...RELEASES]
      .reverse()
      .flatMap((r) => [...r.entries].reverse().map((e) => parse(entryVersion(e))));
    for (let i = 1; i < chronological.length; i++) {
      const [a, b] = [chronological[i - 1], chronological[i]];
      const cmp = a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
      expect(cmp).toBeLessThan(0);
    }
  });

  it('po LEGACY_UNTIL numer rośnie wg wielkości zmiany: poprawka → patch, nowość → minor, size major → major', () => {
    const after = [...RELEASES]
      .reverse()
      .filter((r) => r.date > LEGACY_UNTIL)
      .flatMap((r) => [...r.entries].reverse());
    let prev = parse(RELEASES.find((r) => r.date <= LEGACY_UNTIL)!.version);
    for (const e of after) {
      const cur = parse(entryVersion(e));
      const size = changeSize(e);
      if (size === 'major') expect(cur).toEqual([prev[0] + 1, 0, 0]);
      else if (size === 'minor') expect(cur).toEqual([prev[0], prev[1] + 1, 0]);
      else expect(cur).toEqual([prev[0], prev[1], prev[2] + 1]);
      prev = cur;
    }
  });

  it('rozmiar wynika z tagu i można go nadpisać', () => {
    expect(changeSize({ tag: 'poprawka' })).toBe('patch');
    expect(changeSize({ tag: 'wydajność' })).toBe('patch');
    expect(changeSize({ tag: 'nowość' })).toBe('minor');
    expect(changeSize({ tag: 'poprawka', size: 'minor' })).toBe('minor');
    expect(changeSize({ tag: 'nowość', size: 'major' })).toBe('major');
  });

  it('wersja aplikacji to wersja najnowszego wpisu najnowszego dnia', () => {
    expect(APP_VERSION).toBe(entryVersion(RELEASES[0].entries[0]));
  });

  it('wersje sprzed zmiany zasady zostają bez zmian (ostatni wpis 15.10 to 1.13.x)', () => {
    const legacyLatest = RELEASES.find((r) => r.date === LEGACY_UNTIL);
    expect(legacyLatest?.version.startsWith('1.13.')).toBe(true);
  });
});
