import fs from 'fs';

const path = 'd:/Users/Biuro/Downloads/Base__Produkty__domylny_CSV_2026-07-27_13_44.csv';
const raw = fs.readFileSync(path, 'utf8');
const lines = raw.split(/\r?\n/);

function parseCsvLine(line) {
  const parts = [];
  let cur = '';
  let inQ = false;
  for (let j = 0; j < line.length; j++) {
    const c = line[j];
    if (c === '"') {
      inQ = !inQ;
      continue;
    }
    if (c === ';' && !inQ) {
      parts.push(cur);
      cur = '';
      continue;
    }
    cur += c;
  }
  parts.push(cur);
  return parts;
}

const cats = new Map();
const keywords = [
  'lanc', 'lan[cć]', 'dysz', 'w[eę]ż', 'waz', 'pian', 'myjk', 'szybkoz',
  'pistolet', 'ko[nń]c', 'odkurzacz', 'myjni', 'hyd', 'filtr', 'mosiądz',
  'gwint', '1/4', 'm22', 'm18', 'quick', 'lance', 'foam', 'sprysk',
];

const matched = [];
for (let i = 1; i < lines.length; i++) {
  const line = lines[i];
  if (!line.trim()) continue;
  const parts = parseCsvLine(line);
  if (parts.length < 6) continue;

  const [id, name, , ean, sku, category] = parts;
  const shortDesc = parts[10] || '';
  const manufacturer = parts[31] || '';
  const image = parts[14] || '';

  cats.set(category, (cats.get(category) || 0) + 1);

  const text = `${name} ${sku} ${shortDesc} ${manufacturer}`.toLowerCase();
  const isAccessory =
    category.toLowerCase().includes('akcesor') ||
    manufacturer.toUpperCase().includes('MYJNI') ||
    manufacturer.toUpperCase().includes('HYD');

  const hit = keywords.some((k) => new RegExp(k, 'i').test(text));
  const exclude = /szampon|wosk|ściereczk|rękawic|folia mask|odświeżacz|opryskiwacz eco|czernidło|gumowa ściągaczk|szczotka miękka spiralna/i.test(name);

  if (isAccessory && hit && !exclude) {
    matched.push({ id, name, sku, category, image, shortDesc, manufacturer, hasImage: !!image });
  }
}

console.log('Total lines approx:', lines.length);
console.log(
  'Top categories:',
  [...cats.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20)
);
console.log('Matched accessories:', matched.length);
console.log('With images:', matched.filter((p) => p.hasImage).length);
console.log('Without images:', matched.filter((p) => !p.hasImage).length);
console.log('Sample:', matched.slice(0, 10));
