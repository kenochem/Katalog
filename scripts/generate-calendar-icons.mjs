/**
 * PNG ikony PWA / favicon dla Kenochem Kalendarz z calendar-app-icon.svg
 */
import sharp from 'sharp';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const src = join(root, 'public/icons/calendar-app-icon.svg');
const out = join(root, 'public/icons');

const sizes = [
  ['calendar-favicon-32.png', 32],
  ['calendar-icon-180.png', 180],
  ['calendar-icon-192.png', 192],
  ['calendar-icon-512.png', 512],
  ['calendar-icon-maskable-512.png', 512],
];

for (const [name, size] of sizes) {
  await sharp(src).resize(size, size).png().toFile(join(out, name));
  console.log('wrote', name);
}
