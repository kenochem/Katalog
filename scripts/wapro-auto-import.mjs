#!/usr/bin/env node
/**
 * Wstawia nowe pozycje Mag do Supabase (szkielet WAPRO).
 *
 *   node --env-file=.env scripts/wapro-auto-import.mjs
 *   node --env-file=.env scripts/wapro-auto-import.mjs --dry-run
 */
import { createClient } from '@supabase/supabase-js';
import { resolve } from 'path';
import { importNewWaproFromCatalog } from './lib/waproMagImport.mjs';

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const dryRun = process.argv.includes('--dry-run');
const catalogPath = resolve(
  process.argv.find((a) => !a.startsWith('-') && a.endsWith('.json')) ||
    'data/wapro-mag-catalog.json',
);

if (!url || !key) {
  console.error('Potrzebne SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY w .env');
  process.exit(1);
}

const supabase = createClient(url, key);
const result = await importNewWaproFromCatalog(supabase, catalogPath, { dryRun });
console.log(JSON.stringify(result, null, 2));
