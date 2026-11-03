/**
 * Buduje public/data/material-facts.json: fakty o produktach wyciągnięte z kart charakterystyki, kart technicznych i ulotek.
 *
 * Użycie (z folderu Katalog):
 *   npx vite-node scripts/build-material-facts.ts -- "<folder z materiałami>" ["<drugi folder>" …]
 *
 * Wymaga programu pdftotext (poppler) w PATH oraz VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY w .env (lista produktów).
 * Pliki są dopasowywane do produktów tak samo jak przy imporcie masowym w aplikacji (SKU w nazwie albo nazwa handlowa).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, basename } from 'node:path';
import { isImportableDoc, matchDocs } from '../src/lib/productDocsMatch';
import { extractFact, mergeFacts } from '../src/lib/materialFacts';

const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split(/\r?\n/)
    .map((l) => l.match(/^([A-Z_]+)=(.*)$/))
    .filter((m): m is RegExpMatchArray => !!m)
    .map((m) => [m[1], m[2].trim()]),
);

async function liveProducts() {
  const out: { id: string; sku: string; name: string; maker: string }[] = [];
  const seen = new Set<string>();
  for (let offset = 0; offset < 20000; offset += 1000) {
    const res = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/products?select=id,sku,name,display_name,manufacturer,is_group&order=id&limit=1000&offset=${offset}`, {
      headers: { apikey: env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${env.VITE_SUPABASE_ANON_KEY}` },
    });
    const rows = (await res.json()) as { id: string; sku: string; name: string; display_name: string | null; manufacturer: string | null; is_group: boolean }[];
    for (const r of rows) if (!r.is_group && r.sku && !seen.has(r.id) && seen.add(r.id)) out.push({ id: r.id, sku: r.sku, name: r.display_name || r.name, maker: r.manufacturer ?? '' });
    if (rows.length < 1000) break;
  }
  return out;
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : [join(dir, f)]));
}

async function main() {
  const roots = process.argv.slice(2).filter((a) => a !== '--' && existsSync(a) && statSync(a).isDirectory());
  if (!roots.length) throw new Error('Podaj folder z materiałami');
  const products = await liveProducts();
  const bySku = new Map(products.map((p) => [p.sku.toUpperCase(), p]));
  const parts = new Map<string, { kind: 'sds' | 'tds'; fact: ReturnType<typeof extractFact> extends infer R ? (R extends { fact: infer F } ? F : never) : never; file: string }[]>();
  let files = 0;
  let read = 0;
  for (const root of roots) {
    const abs = walk(root).map((p) => ({ abs: p, rel: relative(root, p).split('\\').join('/') }));
    const rootName = basename(root);
    const docs = abs.map((a) => ({ ...a, path: `${rootName}/${a.rel}` })).filter((a) => isImportableDoc(a.path) && /\.pdf$/i.test(a.path));
    const { matches } = matchDocs(docs.map((d) => ({ path: d.path })), products);
    const absOf = new Map(docs.map((d) => [d.path, d.abs]));
    for (const m of matches) {
      files++;
      let text = '';
      try {
        text = execFileSync('pdftotext', ['-enc', 'UTF-8', absOf.get(m.path)!, '-'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
      } catch {
        continue;
      }
      const got = extractFact(text, m.path);
      if (!got) continue;
      read++;
      for (const p of m.products) {
        const list = parts.get(p.sku.toUpperCase()) ?? [];
        list.push({ ...got, file: basename(m.path) });
        parts.set(p.sku.toUpperCase(), list);
      }
    }
  }
  const facts: Record<string, unknown> = {};
  for (const [sku, list] of parts) {
    const merged = mergeFacts(list);
    if (merged && bySku.has(sku) && (merged.use.length > 20 || merged.usage)) facts[sku] = merged;
  }
  writeFileSync('public/data/material-facts.json', JSON.stringify({ generatedAt: new Date().toISOString(), facts }));
  console.log(`pliki dopasowane: ${files}, z faktami: ${read}, produkty z faktami: ${Object.keys(facts).length}`);
}

void main();
