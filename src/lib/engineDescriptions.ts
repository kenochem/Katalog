import type { Product } from '../types';
import type { MaterialFact } from './categoryEngine';
import { fold } from './partsText';

/**
 * Opisy produktów powstają poza katalogiem; silnik ich nie pisze. Tu są narzędzia do ich przyjęcia:
 * czytanie pliku CSV z gotowymi opisami, teczka danych dla autora opisów i pomocnicze funkcje tekstowe.
 * Sprawdzanie spójności i poprawności opisów jest w descriptionChecks.ts.
 */

export const MIN_DESCRIPTION = 150;

export const plainText = (html: string): string =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const VOLUME = /\b(\d+(?:[.,]\d+)?)\s?(ml|l|kg|g)\b/i;

export function volumeOf(name: string): string | null {
  const m = name.match(VOLUME);
  return m ? `${m[1].replace(',', '.')} ${m[2].toLowerCase() === 'l' ? 'L' : m[2].toLowerCase()}` : null;
}

/** Klucz rodziny: nazwa bez pojemności, opisu po myślniku i znaków pomocniczych. */
export function descFamilyKey(p: Pick<Product, 'name' | 'displayName' | 'manufacturer'>): string {
  // opis po myślniku („… 1L- uniwersalny”) i po pojemności nie należą do nazwy produktu
  const name = (p.displayName || p.name).split(/\s[-–]\s/)[0].replace(/(\d\s?(?:ml|l|kg|g))\s*[-–,.:].*$/i, '$1');
  const core = fold(name)
    .replace(VOLUME, ' ')
    .replace(/\b\d+\s?(szt|sztuk)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  return core ? `${fold(p.manufacturer ?? '')}|${core}` : '';
}

/** Produkty bez pełnego opisu (krótszego niż `min` znaków). `descriptions` — pełne opisy z bazy (lista produktów ich nie zawiera). */
export function findMissingDescriptions(products: Product[], descriptions: Map<string, string>, min = MIN_DESCRIPTION): { product: Product; length: number }[] {
  return products
    .filter((p) => !p.isGroup && (p.sku ?? '').trim())
    .map((product) => ({ product, length: plainText(descriptions.get(product.id) ?? product.description ?? '').length }))
    .filter((x) => x.length < min)
    .sort((a, b) => a.length - b.length);
}

// ------------------------------------------------------------------ CSV: teczka dla autora opisów i import gotowych opisów

const q = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
const BOM = String.fromCharCode(0xfeff);

/**
 * Plik z tym, co katalog wie o produktach bez opisu — dla autora opisów (człowieka albo zewnętrznego asystenta AI).
 * Zawiera dane produktu, krótki opis/użycie/skład oraz przeznaczenie i pH z kart produktów, jeśli są.
 */
export function dossierCsv(rows: { product: Product; length: number }[], hasDocs: (id: string) => boolean, facts: Record<string, MaterialFact> = {}): string {
  const head = ['SKU', 'Nazwa', 'Producent', 'Kategoria', 'Pojemność', 'Obecny opis (znaków)', 'Krótki opis', 'Sposób użycia', 'Skład', 'Materiały w katalogu', 'Z karty: przeznaczenie', 'Z karty: sposób użycia', 'Z karty: pH', 'Pliki kart'];
  const lines = rows.map(({ product: p, length }) => {
    const f = facts[(p.sku ?? '').toUpperCase()];
    return [
      p.sku,
      p.displayName || p.name,
      p.manufacturer,
      p.category,
      volumeOf(p.displayName || p.name) ?? '',
      length,
      p.meta?.shortDescription ?? '',
      p.meta?.descUsage ?? '',
      p.meta?.descComposition ?? '',
      hasDocs(p.id) ? 'tak' : 'nie',
      f?.use ?? '',
      f?.usage ?? '',
      f?.ph ?? '',
      f?.files.join(' | ') ?? '',
    ]
      .map(q)
      .join(';');
  });
  return BOM + [head.map(q).join(';'), ...lines].join('\r\n');
}

export function parseCsv(text: string): string[][] {
  const t = text.replace(/^﻿/, '');
  const sep = (t.split('\n')[0].match(/;/g)?.length ?? 0) >= (t.split('\n')[0].match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let f = '';
  let quoted = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (quoted) {
      if (c === '"') {
        if (t[i + 1] === '"') {
          f += '"';
          i++;
        } else quoted = false;
      } else f += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) {
      row.push(f);
      f = '';
    } else if (c === '\n') {
      row.push(f.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      f = '';
    } else f += c;
  }
  if (f || row.length) {
    row.push(f);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim()));
}

export interface ImportedDescription {
  sku: string;
  description: string;
  short: string;
}

/** Wczytuje gotowe opisy z CSV (kolumny: SKU, Opis, opcjonalnie Krótki opis); zwykły tekst zamienia na akapity HTML. */
export function parseDescriptionsCsv(text: string): ImportedDescription[] {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const head = rows[0].map((h) => fold(h).trim());
  const col = (...names: string[]) => head.findIndex((h) => names.some((n) => h === n || h.startsWith(n)));
  const iSku = col('sku');
  const iDesc = col('opis', 'opis pelny', 'description');
  const iShort = col('krotki opis', 'krotki', 'short');
  if (iSku < 0 || iDesc < 0) return [];
  const out: ImportedDescription[] = [];
  for (const r of rows.slice(1)) {
    const sku = (r[iSku] ?? '').trim().toUpperCase();
    const raw = (r[iDesc] ?? '').trim();
    if (!sku || !raw) continue;
    const html = /<\w+[^>]*>/.test(raw)
      ? raw
      : raw
          .split(/\n{2,}|\r\n\r\n/)
          .map((para) => `<p>${escapeHtml(para.trim()).replace(/\n/g, '<br>')}</p>`)
          .join('');
    out.push({ sku, description: html, short: iShort >= 0 ? (r[iShort] ?? '').trim() : '' });
  }
  return out;
}
