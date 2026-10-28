import { afterEach, describe, expect, it, vi } from 'vitest';
import { isMobileDevice } from '../lib/device';

function withNavigator(ua: string, touch = 0) {
  vi.stubGlobal('navigator', { userAgent: ua, maxTouchPoints: touch });
}

describe('wykrywanie urządzenia mobilnego (aparat tylko na telefonie/tablecie)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('telefony i tablety to urządzenia mobilne', () => {
    withNavigator('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36', 5);
    expect(isMobileDevice()).toBe(true);
    withNavigator('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148', 5);
    expect(isMobileDevice()).toBe(true);
    withNavigator('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15', 5); // iPadOS
    expect(isMobileDevice()).toBe(true);
  });

  it('komputery (także z ekranem dotykowym) to nie urządzenia mobilne', () => {
    withNavigator('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36', 10);
    expect(isMobileDevice()).toBe(false);
    withNavigator('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15', 0);
    expect(isMobileDevice()).toBe(false);
  });
});
