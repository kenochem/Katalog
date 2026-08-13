/**
 * Odswieza komplet ikon aplikacji uzywanych w Suite.
 */
import { execSync } from 'node:child_process';

const scripts = [
  'node scripts/generate-catalog-icons.mjs',
  'node scripts/generate-suite-icons.mjs',
  'node scripts/generate-sell-icons.mjs',
  'node scripts/generate-stock-icons.mjs',
  'node scripts/generate-ops-icons.mjs',
  'node scripts/generate-talk-icons.mjs',
  'node scripts/generate-calendar-icons.mjs',
];

for (const command of scripts) {
  execSync(command, { stdio: 'inherit' });
}
