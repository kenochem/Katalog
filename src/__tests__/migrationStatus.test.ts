import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { MIGRATION_PROBES } from '../lib/migrationProbes.generated';
import { classifyProbeError, summarize } from '../lib/migrationStatus';

describe('kontrola migracji', () => {
  it('lista migracji jest zgodna z plikami w supabase/ (uruchom npm run gen:migrations po dodaniu migracji)', () => {
    const dir = path.resolve(__dirname, '../../supabase');
    const files = fs.readdirSync(dir).filter((f) => f.startsWith('migration-') && f.endsWith('.sql')).sort();
    expect(MIGRATION_PROBES.map((p) => p.file)).toEqual(files);
  });

  it('rozpoznaje brak tabeli, brak kolumny i brak uprawnień', () => {
    expect(classifyProbeError(null).state).toBe('ok');
    expect(classifyProbeError({ code: 'PGRST205', message: "Could not find the table 'public.x'" }).state).toBe('missing');
    expect(classifyProbeError({ code: '42P01', message: 'relation "x" does not exist' }).state).toBe('missing');
    expect(classifyProbeError({ code: '42703', message: 'column x.y does not exist' }).state).toBe('missing');
    expect(classifyProbeError({ code: '42501', message: 'permission denied for table x' }).state).toBe('no-access');
    expect(classifyProbeError({ code: '500', message: 'boom' }).state).toBe('error');
  });

  it('podsumowanie migracji: wgrana / do wgrania / częściowa / nie do sprawdzenia', () => {
    const o = (state: 'ok' | 'missing' | 'no-access' | 'error') => ({ kind: 'table' as const, name: 'x', state });
    expect(summarize([o('ok'), o('ok')], true)).toBe('ok');
    expect(summarize([o('missing'), o('missing')], true)).toBe('missing');
    expect(summarize([o('ok'), o('missing')], true)).toBe('partial');
    expect(summarize([o('ok'), o('no-access')], true)).toBe('no-access');
    expect(summarize([], false)).toBe('manual');
  });
});
