import { readFileSync } from 'node:fs';

const csvPath = process.argv[2];
const rows = parseCsv(readFileSync(csvPath, 'utf8'));
const r = rows.find((x) => x.produkt_sku === 'ATAS0083');
console.log('ATAS0083', { id: r?.produkt_id, zdjecie: r?.zdjecie?.slice(0, 80) });

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
