import { APP_CHANGELOG, type AppChangelogEntry } from '../data/appChangelog';

/**
 * Numer wersji aplikacji wyliczany z dziennika zmian (nie wpisujemy go ręcznie): MAJOR.MINOR.PATCH.
 *
 * Od wpisu po `LEGACY_UNTIL` numer rośnie wg WIELKOŚCI zmiany (każdy wpis ma własną wersję):
 *   - mała poprawka / drobna zmiana  → PATCH + 1            (tag „poprawka”, „wydajność”),
 *   - nowa funkcja / większa zmiana  → MINOR + 1, PATCH = 0 (tag „nowość”),
 *   - duża przebudowa                → MAJOR + 1, reszta = 0 (wpis z `size: 'major'`).
 * Rozmiar można nadpisać w wpisie polem `size: 'patch' | 'minor' | 'major'`.
 *
 * Do `LEGACY_UNTIL` (włącznie) obowiązywała wcześniejsza zasada dzienna (każdy dzień = kolejne MINOR,
 * PATCH = numer wpisu w dniu) — te wersje zostają bez zmian, a nowa numeracja startuje od ostatniej z nich.
 *
 * Kolejność wpisów w obrębie dnia wynika z kolejności w tablicy (nowe wpisy dopisujemy na górze).
 */
export const LEGACY_UNTIL = '2026-10-15';

/** Dni z dużą przebudową w starej zasadzie dziennej (do `LEGACY_UNTIL`). */
export const MAJOR_BUMP_DATES: string[] = [];

export interface AppRelease {
  /** Wersja dnia = wersja ostatniego (najnowszego) wpisu tego dnia. */
  version: string;
  date: string;
  entries: AppChangelogEntry[];
  nowosci: number;
  poprawki: number;
  wydajnosc: number;
}

export type ChangeSize = 'patch' | 'minor' | 'major';

/** Wielkość zmiany: jawny `size` albo wynikająca z tagu. */
export function changeSize(entry: Pick<AppChangelogEntry, 'tag' | 'size'>): ChangeSize {
  if (entry.size) return entry.size;
  return entry.tag === 'nowość' ? 'minor' : 'patch';
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
  let patch = 0;
  const out: AppRelease[] = [];
  dates.forEach((date, i) => {
    const entries = byDate.get(date) ?? [];
    const nowosci = entries.filter((e) => e.tag === 'nowość').length;
    const wydajnosc = entries.filter((e) => e.tag === 'wydajność').length;
    const poprawki = entries.length - nowosci - wydajnosc;

    if (date <= LEGACY_UNTIL) {
      // stara zasada dzienna: każdy dzień = kolejne MINOR, PATCH = numer wpisu w dniu
      if (i > 0) {
        if (MAJOR_BUMP_DATES.includes(date)) {
          major++;
          minor = 0;
        } else {
          minor++;
        }
      }
      entries.forEach((e, idx) => entryVersions.set(entryKey(e), `${major}.${minor}.${entries.length - idx}`));
      patch = entries.length;
    } else {
      // nowa zasada: wersja zależy od wielkości każdej zmiany (od najstarszego wpisu dnia do najnowszego)
      const chronological = [...entries].reverse();
      for (const e of chronological) {
        const size = changeSize(e);
        if (size === 'major') {
          major++;
          minor = 0;
          patch = 0;
        } else if (size === 'minor') {
          minor++;
          patch = 0;
        } else {
          patch++;
        }
        entryVersions.set(entryKey(e), `${major}.${minor}.${patch}`);
      }
    }
    out.push({ version: `${major}.${minor}.${patch}`, date, entries, nowosci, poprawki, wydajnosc });
  });
  return out.reverse(); // najnowsza pierwsza
}

export const RELEASES: AppRelease[] = build();

/** Aktualna wersja = najnowszy wpis najnowszego dnia. */
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
