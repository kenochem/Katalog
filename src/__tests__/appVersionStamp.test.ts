import { describe, expect, it } from 'vitest';
import { APP_VERSION } from '../lib/appVersion';
import { APP_VERSION_STAMP } from '../lib/appVersion.generated';

describe('numer wersji w menu', () => {
  it('zgadza się z dziennikiem zmian (po dopisaniu wpisu uruchom: npm run gen:version)', () => {
    expect(APP_VERSION_STAMP).toBe(APP_VERSION);
  });
});

describe('najnowszy wpis na ekranie startowym', () => {
  it('zgadza się z dziennikiem zmian', async () => {
    const { LATEST_CHANGE } = await import('../lib/appVersion.generated');
    const { APP_CHANGELOG } = await import('../data/appChangelog');
    expect(LATEST_CHANGE.title).toBe(APP_CHANGELOG[0].title);
  });
});
