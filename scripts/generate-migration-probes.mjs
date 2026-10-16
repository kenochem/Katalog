// Generuje src/lib/migrationProbes.generated.ts z plików supabase/migration-*.sql:
// które tabele i kolumny tworzy każda migracja (do automatycznej kontroli „czy migracja wgrana” w Logach).
// Użycie: node scripts/generate-migration-probes.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'supabase');
const out = path.join(root, 'src', 'lib', 'migrationProbes.generated.ts');

const files = fs
  .readdirSync(dir)
  .filter((f) => f.startsWith('migration-') && f.endsWith('.sql'))
  .sort();

const result = files.map((file) => {
  const raw = fs.readFileSync(path.join(dir, file), 'utf8');
  const noComments = raw.replace(/--.*$/gm, '');
  const tables = [...new Set([...noComments.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"?(\w+)"?/gi)].map((m) => m[1]))];
  const columns = [
    ...new Set(
      [...noComments.matchAll(/alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?(?:public\.)?"?(\w+)"?\s+add\s+column\s+(?:if\s+not\s+exists\s+)?"?(\w+)"?/gi)].map(
        (m) => `${m[1]}.${m[2]}`,
      ),
    ),
  ];
  const functions = [...new Set([...noComments.matchAll(/create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?(\w+)/gi)].map((m) => m[1]))];
  const firstComment = (raw.split(/\r?\n/).find((l) => /^--\s*\S/.test(l)) || '').replace(/^--\s*/, '').trim();
  return { file, title: firstComment.slice(0, 160), tables, columns, functions };
});

const body = `// WYGENEROWANE przez scripts/generate-migration-probes.mjs — nie edytuj ręcznie.
export interface MigrationProbe {
  file: string;
  title: string;
  tables: string[];
  /** Kolumny w postaci tabela.kolumna */
  columns: string[];
  functions: string[];
}

export const MIGRATION_PROBES: MigrationProbe[] = ${JSON.stringify(result, null, 2)};
`;
fs.writeFileSync(out, body);
console.log(`Zapisano ${result.length} migracji → ${path.relative(root, out)}`);
