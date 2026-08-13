/**
 * PNG ikony PWA / favicon dla Kenochem Magazyn z stock-app-icon.svg
 */
import sharp from 'sharp';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const src = join(root, 'public/icons/stock-app-icon.svg');
const out = join(root, 'public/icons');

const sizes = [
  ['stock-favicon-32.png', 32],
  ['stock-icon-180.png', 180],
  ['stock-icon-192.png', 192],
  ['stock-icon-512.png', 512],
  ['stock-icon-maskable-512.png', 512],
];

for (const [name, size] of sizes) {
  await sharp(src).resize(size, size).png().toFile(join(out, name));
  console.log('wrote', name);
}
