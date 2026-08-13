/**
 * PNG ikony PWA / favicon dla Handlu z sell-app-icon.svg
 */
import sharp from 'sharp';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const src = join(root, 'public/icons/sell-app-icon.svg');
const out = join(root, 'public/icons');

const sizes = [
  ['sell-favicon-32.png', 32],
  ['sell-icon-180.png', 180],
  ['sell-icon-192.png', 192],
  ['sell-icon-512.png', 512],
  ['sell-icon-maskable-512.png', 512],
];

for (const [name, size] of sizes) {
  await sharp(src).resize(size, size).png().toFile(join(out, name));
  console.log('wrote', name);
}
