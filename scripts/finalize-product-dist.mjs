/**
 * Dodatkowe pliki produktu po buildzie Vite.
 */
import { copyFileSync } from 'node:fs';
import { join } from 'node:path';

const product = process.argv[2] || 'suite';
const root = join(import.meta.dirname, '..');

const manifests = {
  catalog: 'manifest.catalog.webmanifest',
  suite: 'manifest.suite.webmanifest',
  sell: 'manifest.sell.webmanifest',
  stock: 'manifest.stock.webmanifest',
  ops: 'manifest.ops.webmanifest',
  talk: 'manifest.talk.webmanifest',
  logistics: 'manifest.logistics.webmanifest',
  calendar: 'manifest.calendar.webmanifest',
};

const outDirs = {
  catalog: 'dist-catalog',
  suite: 'dist-suite',
  sell: 'dist-sell',
  stock: 'dist-stock',
  ops: 'dist-ops',
  talk: 'dist-talk',
  logistics: 'dist-logistics',
  calendar: 'dist-calendar',
};

const manifest = manifests[product] || manifests.suite;
const outDir = outDirs[product] || 'dist-suite';

copyFileSync(
  join(root, 'public', manifest),
  join(root, outDir, 'manifest.webmanifest'),
);

console.log(`finalize-product-dist: ${product} manifest -> ${outDir}`);
