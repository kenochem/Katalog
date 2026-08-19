/**
 * Przed buildem produktu: manifest PWA + osobny index.<product>.html (bez wyścigu między buildami).
 */
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import './generate-light-product-data.mjs';
import { applyProductHead, manifests } from './product-build-config.mjs';

const product = process.argv[2] || 'suite';
const root = join(import.meta.dirname, '..');
const publicDir = join(root, 'public');

const manifestFile = manifests[product] || manifests.suite;
copyFileSync(
  join(publicDir, manifestFile),
  join(publicDir, 'manifest.webmanifest'),
);

const indexBasePath = join(root, 'index.base.html');
const html = readFileSync(indexBasePath, 'utf8');
const productHtml = applyProductHead(html, product);
writeFileSync(join(root, `index.${product}.html`), productHtml);

console.log(`prepare-product-build: ${product} -> ${manifestFile}, index.${product}.html`);
