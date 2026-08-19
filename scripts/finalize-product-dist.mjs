/**
 * Po buildzie Vite: manifest + poprawka ikon w dist/index.html (pewne PWA nawet przy równoległych buildach).
 */
import { copyFileSync, existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { applyProductHead, manifests, outDirs } from './product-build-config.mjs';

const product = process.argv[2] || 'suite';
const root = join(import.meta.dirname, '..');

const manifest = manifests[product] || manifests.suite;
const outDir = outDirs[product] || 'dist-suite';
const distRoot = join(root, outDir);

copyFileSync(
  join(root, 'public', manifest),
  join(distRoot, 'manifest.webmanifest'),
);

const productIndex = join(distRoot, `index.${product}.html`);
const distIndex = join(distRoot, 'index.html');
if (existsSync(productIndex)) {
  renameSync(productIndex, distIndex);
} else if (!existsSync(distIndex)) {
  console.error(`finalize-product-dist: brak ${productIndex} ani index.html w ${outDir}`);
  process.exit(1);
}

if (existsSync(distIndex)) {
  const html = readFileSync(distIndex, 'utf8');
  writeFileSync(distIndex, applyProductHead(html, product));
}

console.log(`finalize-product-dist: ${product} manifest + index.html -> ${outDir}`);
