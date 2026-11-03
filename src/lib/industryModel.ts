import type { Product } from '../types';
import { fold } from './partsText';

/**
 * Silnik uczy się atrybutu „Branża” (dla jakich obiektów jest produkt) z produktów, które już mają go ustawiony.
 * Zasada: produkty tej samej kategorii mają zwykle te same branże, więc gdy większość oznaczonych produktów
 * kategorii ma daną branżę, proponujemy ją pozostałym. Dodatkowo jednoznaczne słowa w nazwie lub opisie
 * (szpital, hotel, przedszkole…) są osobnym dowodem.
 */
export const INDUSTRY_KEY = 'branza';
/** Opcje atrybutu w kolejności, w jakiej zapisuje je katalog („Firmy sprzątające, Biura, …”). */
export const INDUSTRY_OPTIONS = ['Firmy sprzątające', 'Biura', 'Hotele i pensjonaty', 'Placówki medyczne', 'Szkoły, przedszkola i żłobki'];

const KEYWORDS: [string, RegExp][] = [
  ['Placówki medyczne', /szpital|placowk\w+ medyczn|gabinet\w* (lekarsk|zabieg|stomatolog)|przychodni|ochron\w+ zdrowia/],
  ['Hotele i pensjonaty', /\bhotel|pensjonat|pokoj\w* hotelow|goscie hotelow/],
  ['Szkoły, przedszkola i żłobki', /przedszkol|zlob|szkol|placowk\w+ oswiat/],
  ['Biura', /\bbiur[ao]\w*|biurow/],
];

/** Odczytuje wartość atrybutu: opcje mogą zawierać przecinki („Szkoły, przedszkola i żłobki”), więc szukamy znanych opcji, a nie dzielimy po przecinku. */
export function parseIndustries(value: unknown): string[] {
  const s = typeof value === 'string' ? value : '';
  return INDUSTRY_OPTIONS.filter((o) => s.includes(o));
}

export function formatIndustries(options: string[]): string {
  return INDUSTRY_OPTIONS.filter((o) => options.includes(o)).join(', ');
}

export interface IndustrySuggestion {
  product: Product;
  options: { option: string; confidence: number; why: string }[];
  /** Wartość do zapisania w atrybucie. */
  value: string;
}

export interface IndustryModel {
  /** Ile produktów ma już ustawioną branżę (dane uczące). */
  labelled: number;
  suggest(p: Product, text: string, department?: string): IndustrySuggestion | null;
}

const ELIGIBLE_DEPARTMENT = /chemia profesjonalna|sprz[eę]t i akcesoria|dom i ogr|chemia specjalistyczna/i;
const MIN_LABELLED_IN_LEAF = 4;
const MIN_RATE = 0.6;

export function buildIndustryModel(products: Product[], categoryOf: (p: Product) => string): IndustryModel {
  const perLeaf = new Map<string, { n: number; counts: Map<string, number> }>();
  let labelled = 0;
  for (const p of products) {
    if (p.isGroup) continue;
    const have = parseIndustries(p.meta?.attrs?.[INDUSTRY_KEY]);
    if (!have.length) continue;
    labelled++;
    const leaf = categoryOf(p);
    const e = perLeaf.get(leaf) ?? { n: 0, counts: new Map<string, number>() };
    e.n++;
    for (const o of have) e.counts.set(o, (e.counts.get(o) ?? 0) + 1);
    perLeaf.set(leaf, e);
  }
  return {
    labelled,
    suggest(p, text, department = '') {
      if (p.isGroup || parseIndustries(p.meta?.attrs?.[INDUSTRY_KEY]).length) return null;
      // branża dotyczy chemii obiektowej i sprzętu do sprzątania, nie chemii samochodowej ani myjni
      if (department && !ELIGIBLE_DEPARTMENT.test(department)) return null;
      const found = new Map<string, { confidence: number; why: string }>();
      const e = perLeaf.get(categoryOf(p));
      if (e && e.n >= MIN_LABELLED_IN_LEAF) {
        for (const [option, c] of e.counts) {
          const rate = c / e.n;
          if (rate >= MIN_RATE) found.set(option, { confidence: Math.round(rate * 100) / 100, why: `${c} z ${e.n} oznaczonych produktów tej kategorii ma „${option}”` });
        }
      }
      const t = fold(text);
      for (const [option, re] of KEYWORDS) {
        // pojedyncza wzmianka w wyliczance („do hoteli, biur, szkół”) niczego nie dowodzi — potrzebne są co najmniej dwie
        const hits = t.match(new RegExp(re.source, 'g')) ?? [];
        if (hits.length >= 2 && !found.has(option)) found.set(option, { confidence: 0.7, why: `w tekście produktu: ${[...new Set(hits)].slice(0, 2).join(', ')}` });
      }
      if (!found.size) return null;
      const options = [...found.entries()].map(([option, v]) => ({ option, ...v })).sort((a, b) => b.confidence - a.confidence);
      return { product: p, options, value: formatIndustries(options.map((o) => o.option)) };
    },
  };
}
