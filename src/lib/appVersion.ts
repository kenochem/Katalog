import { APP_CHANGELOG, type AppChangelogEntry } from '../data/appChangelog';

/**
 * Numer wersji aplikacji wyliczany z dziennika zmian (nie wpisujemy go ręcznie): MAJOR.MINOR.PATCH.
 *
 *   - MINOR rośnie z każdym nowym dniem zmian w `APP_CHANGELOG` (pierwszy dzień to 1.0),
 *   - PATCH to kolejny numer wpisu w obrębie dnia: najstarszy wpis dnia to .1, następny .2 itd.
 *     — dziś przy 19 wpisach ostatni to np. 1.13.19, a wersja całego dnia = wersja jego ostatniego wpisu,
 *   - MAJOR rośnie w dniach z listy MAJOR_BUMP_DATES (duża przebudowa, dopisujemy ręcznie).
 *
 * Kolejność wpisów w obrębie dnia wynika z kolejności w tablicy (nowe wpisy dopisujemy na górze).
 */
export const MAJOR_BUMP_DATES: string[] = [];

export interface AppRelease {
  /** Wersja dnia = wersja ostatniego (najnowszego) wpisu, np. 1.13.19. */
  version: string;
  /** Wersja bazowa dnia bez numeru wpisu, np. 1.13. */
  base: string;
  date: string;
  entries: AppChangelogEntry[];
  nowosci: number;
  poprawki: number;
  wydajnosc: number;
}

/** Klucz wpisu do mapy wersji (data + tytuł). */
export function entryKey(entry: Pick<AppChangelogEntry, 'date' | 'title'>): string {
  return `${entry.date}|${entry.title}`;
}

const entryVersions = new Map<string, string>();

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
      } else {
        minor++;
      }
    }
    const base = `${major}.${minor}`;
    // tablica ma najnowszy wpis pierwszy → najstarszy wpis dnia dostaje patch 1
    entries.forEach((e, idx) => entryVersions.set(entryKey(e), `${base}.${entries.length - idx}`));
    out.push({ version: `${base}.${entries.length}`, base, date, entries, nowosci, poprawki, wydajnosc });
  });
  return out.reverse(); // najnowsza pierwsza
}

export const RELEASES: AppRelease[] = build();

/** Aktualna wersja = najnowszy wpis najnowszego dnia (np. 1.13.19). */
export const APP_VERSION: string = RELEASES[0]?.version ?? '1.0.1';

/** Wersja dnia (= jego ostatniego wpisu). */
export const VERSION_BY_DATE: Map<string, string> = new Map(RELEASES.map((r) => [r.date, r.version]));

/** Wersja pojedynczego wpisu, np. 1.13.7. */
export function entryVersion(entry: Pick<AppChangelogEntry, 'date' | 'title'>): string {
  return entryVersions.get(entryKey(entry)) ?? '';
}

export const CHANGELOG_STATS = {
  releases: RELEASES.length,
  entries: APP_CHANGELOG.length,
  nowosci: RELEASES.reduce((s, r) => s + r.nowosci, 0),
  poprawki: RELEASES.reduce((s, r) => s + r.poprawki, 0),
  wydajnosc: RELEASES.reduce((s, r) => s + r.wydajnosc, 0),
  since: RELEASES[RELEASES.length - 1]?.date ?? '',
};
