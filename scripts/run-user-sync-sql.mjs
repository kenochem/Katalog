/**
 * Wykonuje migracje user sync + cloud platform przez połączenie Postgres.
 * Ustaw DATABASE_URL w .env (Supabase → Settings → Database → URI).
 */
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbUrl =
  process.env.DATABASE_URL ||
  process.env.SUPABASE_DB_URL ||
  process.env.POSTGRES_URL;

if (!dbUrl) {
  console.error('Brak DATABASE_URL w .env');
  process.exit(1);
}

const files = [
  'supabase/migration-user-sync-all.sql',
  'supabase/migration-user-cloud-platform.sql',
];

const client = new pg.Client({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
for (const rel of files) {
  const path = resolve(__dirname, '..', rel);
  console.log('Uruchamiam', rel, '…');
  await client.query(readFileSync(path, 'utf8'));
}
await client.end();
console.log('Gotowe.');
