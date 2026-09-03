import { readFileSync } from 'node:fs';

const csvPath = process.argv[2];
const rows = parseCsv(readFileSync(csvPath, 'utf8'));

const pairs = [];
for (const r of rows) {
  const id = r.produkt_id;
  const img = r.zdjecie || '';
  if (id && img.includes('baselinker.com/products/')) {
    pairs.push({ sku: r.produkt_sku, id, img: img.slice(0, 100) });
  }
}
console.log('baselinker url samples', pairs.length);
for (const p of pairs.slice(0, 8)) console.log(p);

function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  const clean = String(text || '').replace(/^\uFEFF/, '');
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i], next = clean[i + 1];
    if (quoted) {
      if (ch === '"' && next === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ';') { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell.replace(/\r$/, '')); rows.push(row); }
  const nonEmpty = rows.filter((r) => r.some((c) => String(c || '').trim()));
  const header = nonEmpty.shift()?.map((h) => String(h || '').trim()) ?? [];
  return nonEmpty.map((cols) => {
    const out = {};
    for (let i = 0; i < header.length; i++) out[header[i]] = String(cols[i] || '').trim();
    return out;
  });
}
