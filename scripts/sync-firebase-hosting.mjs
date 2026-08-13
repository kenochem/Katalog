/**
 * Generuje wpisy hosting w firebase.json (DRY headers/rewrites).
 * node scripts/sync-firebase-hosting.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const targets = [
  { target: 'katalog', public: 'dist-catalog' },
  { target: 'suite', public: 'dist-suite' },
  { target: 'sell', public: 'dist-sell' },
  { target: 'stock', public: 'dist-stock' },
  { target: 'ops', public: 'dist-ops' },
  { target: 'talk', public: 'dist-talk' },
  { target: 'logistics', public: 'dist-logistics' },
  { target: 'calendar', public: 'dist-calendar' },
];

const headersBlock = [
  {
    source: '/index.html',
    headers: [
      { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
    ],
  },
  {
    source: '/sw.js',
    headers: [
      { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
      { key: 'Service-Worker-Allowed', value: '/' },
    ],
  },
  {
    source: '/manifest.webmanifest',
    headers: [
      { key: 'Cache-Control', value: 'no-cache' },
      { key: 'Content-Type', value: 'application/manifest+json' },
    ],
  },
  {
    source: '/assets/**',
    headers: [
      { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
    ],
  },
];

const hosting = targets.map(({ target, public: publicDir }) => ({
  target,
  public: publicDir,
  ignore: ['firebase.json', '**/.*', '**/node_modules/**'],
  headers: headersBlock,
  rewrites: [{ source: '**', destination: '/index.html' }],
}));

const firebase = {
  hosting,
};

writeFileSync(
  join(root, 'firebase.json'),
  `${JSON.stringify(firebase, null, 2)}\n`,
  'utf8',
);
console.log('firebase.json updated:', targets.map((t) => t.target).join(', '));
