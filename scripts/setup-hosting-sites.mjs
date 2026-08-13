/**
 * Tworzy brakujące witryny Firebase Hosting (Spark — multi-site).
 * node scripts/setup-hosting-sites.mjs
 */
import { execSync } from 'node:child_process';

const sites = [
  'kenochem-katalog',
  'kenochem-f4a5b',
  'kenochem-sell',
  'kenochem-stock',
  'kenochem-ops',
  'kenochem-talk',
  'kenochem-logistics',
];

for (const site of sites) {
  try {
    execSync(`npx firebase hosting:sites:create ${site}`, {
      stdio: 'inherit',
    });
    console.log(`OK: ${site}`);
  } catch {
    console.warn(`Skip (może istnieje): ${site}`);
  }
}

console.log(
  '\nMapowanie targetów: .firebaserc — uruchom npm run sync:firebase-hosting',
);
