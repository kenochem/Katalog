import { readFileSync } from 'node:fs';

const csvPath = process.argv[2];
if (!csvPath) process.exit(1);

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
      if (ch === '"' && next === '"') { cell += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ';') { row.push(cell); cell = ''; }
    else if (ch === '\n') {
      row.push(cell.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell.replace(/\r$/, '')); rows.push(row); }
  const nonEmpty = rows.filter((r) => r.some((c) => String(c || '').trim()));
  const header = nonEmpty.shift()?.map((h) => String(h || '').trim()) ?? [];
  return nonEmpty.map((cols) => {
    const out = {};
    for (let i = 0; i < header.length; i += 1) out[header[i]] = String(cols[i] || '').trim();
    return out;
  });
}

const rows = parseCsv(readFileSync(csvPath, 'utf8'));
const cal = rows.filter((r) => {
  const t = `${r.produkt_nazwa || ''} ${r.kategoria_nazwa || ''} ${r.produkt_sku || ''}`.toLowerCase();
  return t.includes('california') || t.includes('californ');
});

console.log('California rows in CSV:', cal.length);
for (const r of cal.slice(0, 25)) {
  const img = (r.zdjecie || '').slice(0, 70);
  const host = img.includes('baselinker') ? 'BL' : img.includes('kenochem') ? 'KEN' : img ? 'OTHER' : 'NONE';
  let extraBl = 0;
  for (let i = 1; i <= 20; i++) {
    const u = r[`zdjecie_dodatkowe_${i}`] || '';
    if (u.includes('baselinker')) extraBl++;
  }
  console.log(r.produkt_sku, host, 'extraBl', extraBl, '|', (r.produkt_nazwa || '').slice(0, 55));
}
