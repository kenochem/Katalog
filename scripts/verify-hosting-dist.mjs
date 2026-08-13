#!/usr/bin/env node
/**
 * Blokuje deploy Firebase, gdy brakuje index.html w katalogu buildu.
 *   node scripts/verify-hosting-dist.mjs dist-catalog
 */
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2];
if (!dir) {
  console.error('Użycie: node scripts/verify-hosting-dist.mjs <katalog-dist>');
  process.exit(1);
}

const indexPath = join(dir, 'index.html');
if (!existsSync(indexPath)) {
  console.error(`Brak ${indexPath} — przerwano deploy (uniknij pustego hostingu).`);
  process.exit(1);
}

const size = statSync(indexPath).size;
if (size < 500) {
  console.error(`Podejrzanie mały index.html (${size} B) w ${dir}.`);
  process.exit(1);
}

console.log(`OK: ${indexPath} (${size} B)`);
