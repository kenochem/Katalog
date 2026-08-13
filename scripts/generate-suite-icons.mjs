/**
 * PNG ikony PWA / favicon dla Kenochem Suite z suite-app-icon.svg
 */
import sharp from 'sharp';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const src = join(root, 'public/icons/suite-app-icon.svg');
const out = join(root, 'public/icons');

const sizes = [
  ['suite-favicon-32.png', 32],
  ['suite-icon-180.png', 180],
  ['suite-icon-192.png', 192],
  ['suite-icon-512.png', 512],
  ['suite-icon-maskable-512.png', 512],
];

for (const [name, size] of sizes) {
  await sharp(src).resize(size, size).png().toFile(join(out, name));
  console.log('wrote', name);
}
