/**
 * PNG ikony PWA / favicon dla Operacji z ops-app-icon.svg
 */
import sharp from 'sharp';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const src = join(root, 'public/icons/ops-app-icon.svg');
const out = join(root, 'public/icons');

const sizes = [
  ['ops-favicon-32.png', 32],
  ['ops-icon-180.png', 180],
  ['ops-icon-192.png', 192],
  ['ops-icon-512.png', 512],
  ['ops-icon-maskable-512.png', 512],
];

for (const [name, size] of sizes) {
  await sharp(src).resize(size, size).png().toFile(join(out, name));
  console.log('wrote', name);
}
