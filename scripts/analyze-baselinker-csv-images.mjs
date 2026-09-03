import { readFileSync } from 'node:fs';
import { isBaselinkerCdnUrl, isKenochemShopUrl, pickBaselinkerPrimaryImage } from './lib/catalogImageUrls.mjs';

const csvPath = process.argv[2];
if (!csvPath) {
  console.error('Usage: node scripts/analyze-baselinker-csv-images.mjs <csv>');
  process.exit(1);
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  const clean = String(text || '').replace(/^\uFEFF/, '');
  for (let i = 0; i < clean.length; i += 1) {
    const ch = clean[i];
    const next = clean[i + 1];
    if (quoted) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') quoted = false;
      else cell += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ';') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n') {
      row.push(cell.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell.replace(/\r$/, ''));
    rows.push(row);
  }
  const nonEmpty = rows.filter((r) => r.some((c) => String(c || '').trim()));
  const header = nonEmpty.shift()?.map((h) => String(h || '').trim()) ?? [];
  return nonEmpty.map((cols) => {
    const out = {};
    for (let i = 0; i < header.length; i += 1) out[header[i]] = String(cols[i] || '').trim();
    return out;
  });
}

const rows = parseCsv(readFileSync(csvPath, 'utf8'));
let primaryBl = 0;
let primaryKen = 0;
let primaryOther = 0;
let hasBlSomewhere = 0;

for (const row of rows) {
  const primary = String(row.zdjecie || '').trim();
  const extras = [];
  for (let i = 1; i <= 20; i += 1) {
    const u = String(row[`zdjecie_dodatkowe_${i}`] || '').trim();
    if (u.startsWith('http')) extras.push(u);
  }
  const picked = pickBaselinkerPrimaryImage({ primary, extras });
  if (isBaselinkerCdnUrl(primary)) primaryBl += 1;
  else if (isKenochemShopUrl(primary)) primaryKen += 1;
  else if (primary.startsWith('http')) primaryOther += 1;
  if ([primary, ...extras].some(isBaselinkerCdnUrl)) hasBlSomewhere += 1;
}

console.log('rows', rows.length);
console.log('zdjecie column:', { baselinker: primaryBl, kenochem: primaryKen, other: primaryOther });
console.log('SKU with baselinker anywhere:', hasBlSomewhere);
