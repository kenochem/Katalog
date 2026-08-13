/**
 * Stosuje migracje user_favorites / product_collections / warehouse_location.
 * Wymaga DATABASE_URL (Supabase → Settings → Database → Connection string URI).
 *
 *   node --env-file=.env scripts/apply-user-sync-migrations.mjs
 */
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const dbUrl =
  process.env.DATABASE_URL ||
  process.env.SUPABASE_DB_URL ||
  process.env.POSTGRES_URL;

if (!dbUrl) {
  console.error(
    'Brak DATABASE_URL w .env — Supabase Dashboard → Settings → Database → URI (tryb Transaction lub Session).',
  );
  console.error('Przykład: DATABASE_URL=postgresql://postgres.[ref]:[HASLO]@...supabase.com:5432/postgres');
  process.exit(1);
}

const files = [
  'supabase/migration-user-sync-all.sql',
  'supabase/migration-user-cloud-platform.sql',
];

let pg;
try {
  pg = await import('pg');
} catch {
  console.error('Instaluj pg: npm install pg');
  process.exit(1);
}

const client = new pg.default.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
await client.connect();

for (const rel of files) {
  const path = resolve(root, rel);
  try {
    const sql = readFileSync(path, 'utf8');
    console.log('→', rel);
    await client.query(sql);
    console.log('  OK');
  } catch (e) {
    if (e.code === 'ENOENT') {
      console.warn('  pominięto (brak pliku)');
      continue;
    }
    console.error('  BŁĄD:', e.message);
    await client.end();
    process.exit(1);
  }
}

await client.end();
console.log('Migracje zakończone.');
