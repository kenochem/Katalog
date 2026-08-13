/**
 * Kopiuje manifest PWA i ustawia tytul HTML przed buildem produktu.
 */
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const product = process.argv[2] || 'suite';
const root = join(import.meta.dirname, '..');
const publicDir = join(root, 'public');

const manifests = {
  catalog: 'manifest.catalog.webmanifest',
  suite: 'manifest.suite.webmanifest',
  sell: 'manifest.sell.webmanifest',
  stock: 'manifest.stock.webmanifest',
  ops: 'manifest.ops.webmanifest',
  talk: 'manifest.talk.webmanifest',
  logistics: 'manifest.logistics.webmanifest',
  calendar: 'manifest.calendar.webmanifest',
};

const titles = {
  catalog: 'Katalog - Kenochem',
  suite: 'Suite - Kenochem',
  sell: 'Handel - Kenochem',
  stock: 'Magazyn - Kenochem',
  ops: 'Operacje - Kenochem',
  talk: 'Talk - Kenochem',
  logistics: 'Logistyka - Kenochem',
  calendar: 'Kalendarz - Kenochem',
};

const appleShort = {
  catalog: 'Katalog',
  suite: 'Suite',
  sell: 'Handel',
  stock: 'Magazyn',
  ops: 'Operacje',
  talk: 'Talk',
  logistics: 'Logistyka',
  calendar: 'Kalendarz',
};

const headIcons = {
  catalog: {
    svg: '/favicon.svg',
    png32: '/icons/favicon-32.png',
    apple: '/icons/icon-180.png',
    theme: '#33b33b',
  },
  suite: {
    svg: '/favicon-suite.svg',
    png32: '/icons/suite-favicon-32.png',
    apple: '/icons/suite-icon-180.png',
    theme: '#33b33b',
  },
  sell: {
    svg: '/favicon-sell.svg',
    png32: '/icons/sell-favicon-32.png',
    apple: '/icons/sell-icon-180.png',
    theme: '#33b33b',
  },
  stock: {
    svg: '/favicon-stock.svg',
    png32: '/icons/stock-favicon-32.png',
    apple: '/icons/stock-icon-180.png',
    theme: '#33b33b',
  },
  ops: {
    svg: '/favicon-ops.svg',
    png32: '/icons/ops-favicon-32.png',
    apple: '/icons/ops-icon-180.png',
    theme: '#33b33b',
  },
  logistics: {
    svg: '/favicon.svg',
    png32: '/icons/favicon-32.png',
    apple: '/icons/icon-180.png',
    theme: '#33b33b',
  },
  talk: {
    svg: '/favicon-talk.svg',
    png32: '/icons/talk-favicon-32.png',
    apple: '/icons/talk-icon-180.png',
    theme: '#33b33b',
  },
  calendar: {
    svg: '/favicon-calendar.svg',
    png32: '/icons/calendar-favicon-32.png',
    apple: '/icons/calendar-icon-180.png',
    theme: '#33b33b',
  },
};

const manifestFile = manifests[product] || manifests.suite;
copyFileSync(
  join(publicDir, manifestFile),
  join(publicDir, 'manifest.webmanifest'),
);

const indexBasePath = join(root, 'index.base.html');
const indexPath = join(root, 'index.html');
let html = readFileSync(indexBasePath, 'utf8');
const title = titles[product] || titles.suite;
html = html.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`);
const apple = appleShort[product] || appleShort.suite;
html = html.replace(
  /name="apple-mobile-web-app-title" content="[^"]*"/,
  `name="apple-mobile-web-app-title" content="${apple}"`,
);
const icons = headIcons[product] || headIcons.suite;
html = html.replace(
  /<link rel="icon" type="image\/svg\+xml" href="[^"]*" \/>/,
  `<link rel="icon" type="image/svg+xml" href="${icons.svg}" />`,
);
html = html.replace(
  /<link rel="icon" type="image\/png" sizes="32x32" href="[^"]*" \/>/,
  `<link rel="icon" type="image/png" sizes="32x32" href="${icons.png32}" />`,
);
html = html.replace(
  /<link rel="apple-touch-icon" href="[^"]*" \/>/,
  `<link rel="apple-touch-icon" href="${icons.apple}" />`,
);
html = html.replace(
  /name="theme-color" content="[^"]*"/,
  `name="theme-color" content="${icons.theme}"`,
);
writeFileSync(indexPath, html);

console.log(`prepare-product-build: ${product} -> ${manifestFile}`);
