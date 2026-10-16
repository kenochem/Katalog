import { supabase } from './supabase';
import { MIGRATION_PROBES, type MigrationProbe } from './migrationProbes.generated';

/**
 * Kontrola, które migracje bazy (supabase/migration-*.sql) są już wgrane — przez próbne zapytania
 * do tabel i kolumn, które dana migracja tworzy. Funkcje SQL i polityki RLS nie są sprawdzane.
 */
export type ObjectState = 'ok' | 'missing' | 'no-access' | 'error';
export type MigrationState = 'ok' | 'missing' | 'partial' | 'no-access' | 'error' | 'manual';

export interface ObjectResult {
  kind: 'table' | 'column';
  name: string;
  state: ObjectState;
  message?: string;
}

export interface MigrationResult {
  probe: MigrationProbe;
  state: MigrationState;
  objects: ObjectResult[];
}

interface PgError {
  code?: string;
  message?: string;
}

/** Klasyfikacja błędu PostgREST/Postgres z próbnego zapytania. */
export function classifyProbeError(err: PgError | null | undefined): { state: ObjectState; message?: string } {
  if (!err) return { state: 'ok' };
  const code = String(err.code ?? '');
  const msg = String(err.message ?? '');
  if (code === 'PGRST205' || code === '42P01' || /could not find the table|relation .* does not exist/i.test(msg)) {
    return { state: 'missing', message: msg };
  }
  if (code === '42703' || code === 'PGRST204' || /column .* does not exist|could not find the .* column/i.test(msg)) {
    return { state: 'missing', message: msg };
  }
  if (code === '42501' || /permission denied/i.test(msg)) return { state: 'no-access', message: msg };
  return { state: 'error', message: msg };
}

async function probeTable(table: string, column?: string): Promise<ObjectResult> {
  const kind = column ? 'column' : 'table';
  const name = column ? `${table}.${column}` : table;
  if (!supabase) return { kind, name, state: 'error', message: 'Brak połączenia z bazą' };
  const { error } = await supabase.from(table).select(column ?? '*', { head: true, count: undefined }).limit(0);
  const c = classifyProbeError(error);
  return { kind, name, state: c.state, message: c.message };
}

export function summarize(objects: ObjectResult[], hasAny: boolean): MigrationState {
  if (!hasAny) return 'manual';
  const missing = objects.filter((o) => o.state === 'missing').length;
  if (missing === objects.length) return 'missing';
  if (missing > 0) return 'partial';
  if (objects.some((o) => o.state === 'no-access')) return 'no-access';
  if (objects.some((o) => o.state === 'error')) return 'error';
  return 'ok';
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

/** Sprawdza wszystkie migracje (tabele najpierw, kolumny tylko dla istniejących tabel). */
export async function checkMigrations(onProgress?: (done: number, total: number) => void): Promise<MigrationResult[]> {
  const tableNames = [...new Set(MIGRATION_PROBES.flatMap((p) => [...p.tables, ...p.columns.map((c) => c.split('.')[0])]))];
  const tableState = new Map<string, ObjectResult>();
  let done = 0;
  const total = tableNames.length + MIGRATION_PROBES.reduce((s, p) => s + p.columns.length, 0);
  await mapLimit(tableNames, 6, async (t) => {
    tableState.set(t, await probeTable(t));
    onProgress?.(++done, total);
  });

  const results: MigrationResult[] = [];
  for (const probe of MIGRATION_PROBES) {
    const objects: ObjectResult[] = [];
    for (const t of probe.tables) objects.push(tableState.get(t) ?? { kind: 'table', name: t, state: 'error' });
    const colResults = await mapLimit(probe.columns, 6, async (full) => {
      const [t, c] = full.split('.');
      const ts = tableState.get(t);
      if (ts && ts.state === 'missing') {
        onProgress?.(++done, total);
        return { kind: 'column', name: full, state: 'missing', message: 'tabela nie istnieje' } as ObjectResult;
      }
      const r = await probeTable(t, c);
      onProgress?.(++done, total);
      return r;
    });
    objects.push(...colResults);
    results.push({ probe, state: summarize(objects, objects.length > 0), objects });
  }
  return results;
}
