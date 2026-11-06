// Zapisuje numer wersji i najnowszy wpis dziennika do małego pliku, żeby menu i ekran startowy
// nie ładowały całego dziennika zmian (ok. 140 KB).
// Użycie: npx vite-node scripts/generate-app-version.ts (wywoływane automatycznie przez deploy:catalog).
import { writeFileSync } from 'node:fs';
import { APP_CHANGELOG } from '../src/data/appChangelog';
import { APP_VERSION } from '../src/lib/appVersion';

const latest = APP_CHANGELOG[0];
const file = new URL('../src/lib/appVersion.generated.ts', import.meta.url);
writeFileSync(
  file,
  [
    '// WYGENEROWANE przez scripts/generate-app-version.ts — nie edytuj ręcznie.',
    `export const APP_VERSION_STAMP = ${JSON.stringify(APP_VERSION)};`,
    `export const LATEST_CHANGE = ${JSON.stringify({ title: latest?.title ?? '', description: (latest?.description ?? '').slice(0, 320) })};`,
    '',
  ].join('\n'),
);
console.log(`Wersja aplikacji: ${APP_VERSION}`);
