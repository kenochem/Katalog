/**
 * PNG ikony PWA / favicon dla Talk z talk-app-icon.svg
 */
import sharp from 'sharp';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const src = join(root, 'public/icons/talk-app-icon.svg');
const notificationIconSrc = join(root, 'public/icons/talk-notification-icon.svg');
const notificationBadgeSrc = join(root, 'public/icons/talk-notification-badge.svg');
const out = join(root, 'public/icons');

const sizes = [
  ['talk-favicon-32.png', 32],
  ['talk-icon-180.png', 180],
  ['talk-icon-192.png', 192],
  ['talk-icon-512.png', 512],
  ['talk-icon-maskable-512.png', 512],
];

for (const [name, size] of sizes) {
  await sharp(src).resize(size, size).png().toFile(join(out, name));
  console.log('wrote', name);
}

await sharp(notificationIconSrc)
  .resize(192, 192)
  .png()
  .toFile(join(out, 'talk-notification-icon-192.png'));
console.log('wrote', 'talk-notification-icon-192.png');

await sharp(notificationBadgeSrc)
  .resize(96, 96)
  .png()
  .toFile(join(out, 'talk-notification-badge-96.png'));
console.log('wrote', 'talk-notification-badge-96.png');
