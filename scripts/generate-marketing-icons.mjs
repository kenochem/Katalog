/**
 * PNG ikony PWA / favicon dla Kenochem Marketing z marketing-app-icon.svg
 */
import sharp from 'sharp';
import { copyFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const src = join(root, 'public/icons/marketing-app-icon.svg');
const out = join(root, 'public/icons');

const sizes = [
  ['marketing-favicon-32.png', 32],
  ['marketing-icon-180.png', 180],
  ['marketing-icon-192.png', 192],
  ['marketing-icon-512.png', 512],
  ['marketing-icon-maskable-512.png', 512],
];

for (const [name, size] of sizes) {
  await sharp(src).resize(size, size).png().toFile(join(out, name));
  console.log('wrote', name);
}

copyFileSync(src, join(root, 'public/favicon-marketing.svg'));
console.log('wrote favicon-marketing.svg');
