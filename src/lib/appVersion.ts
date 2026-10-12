import { APP_CHANGELOG, type AppChangelogEntry } from '../data/appChangelog';

/**
 * Numer wersji aplikacji wyliczany z dziennika zmian (nie wpisujemy go ręcznie).
 *
 * Jedna wersja = jeden dzień zmian w `APP_CHANGELOG`. Pierwszy dzień to 1.0.0, każdy kolejny:
 *   - jest w nim choć jedna „nowość” (lub „wydajność”) → MINOR + 1 (PATCH = 0),
 *   - same poprawki → PATCH + 1,
 *   - data z listy MAJOR_BUMP_DATES (duża przebudowa, dopisujemy ręcznie) → MAJOR + 1.
 */
export const MAJOR_BUMP_DATES: string[] = [];

export interface AppRelease {
  version: string;
  date: string;
  entries: AppChangelogEntry[];
  nowosci: number;
  poprawki: number;
  wydajnosc: number;
}

function build(): AppRelease[] {
  const byDate = new Map<string, AppChangelogEntry[]>();
  for (const e of APP_CHANGELOG) {
    const list = byDate.get(e.date);
    if (list) list.push(e);
    else byDate.set(e.date, [e]);
  }
  const dates = [...byDate.keys()].sort();
  let major = 1;
  let minor = 0;
  let patch = 0;
  const out: AppRelease[] = [];
  dates.forEach((date, i) => {
    const entries = byDate.get(date) ?? [];
    const nowosci = entries.filter((e) => e.tag === 'nowość').length;
    const wydajnosc = entries.filter((e) => e.tag === 'wydajność').length;
    const poprawki = entries.length - nowosci - wydajnosc;
    if (i > 0) {
      if (MAJOR_BUMP_DATES.includes(date)) {
        major++;
        minor = 0;
        patch = 0;
      } else if (nowosci + wydajnosc > 0) {
        minor++;
        patch = 0;
      } else {
        patch++;
      }
    }
    out.push({ version: `${major}.${minor}.${patch}`, date, entries, nowosci, poprawki, wydajnosc });
  });
  return out.reverse(); // najnowsza pierwsza
}

export const RELEASES: AppRelease[] = build();

/** Aktualna wersja (najnowszy dzień w dzienniku zmian). */
export const APP_VERSION: string = RELEASES[0]?.version ?? '1.0.0';

export const VERSION_BY_DATE: Map<string, string> = new Map(RELEASES.map((r) => [r.date, r.version]));

export const CHANGELOG_STATS = {
  releases: RELEASES.length,
  entries: APP_CHANGELOG.length,
  nowosci: RELEASES.reduce((s, r) => s + r.nowosci, 0),
  poprawki: RELEASES.reduce((s, r) => s + r.poprawki, 0),
  wydajnosc: RELEASES.reduce((s, r) => s + r.wydajnosc, 0),
  since: RELEASES[RELEASES.length - 1]?.date ?? '',
};
