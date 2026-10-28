import type { Product } from '../types';
import { getProductDisplayCategory, productNeedsCategoryDecision } from './catalogCategory';
import { effectiveManufacturer } from './waproManufacturers';

/**
 * Analiza asortymentu: podpowiedzi kategorii i producentów oraz wykrywanie problemów w drzewie.
 * Wszystko liczone lokalnie z załadowanych produktów — bez zapisu.
 */

export const UNDECIDED = 'Do decyzji';

const STOP = new Set(['do', 'na', 'ze', 'dla', 'oraz', 'szt', 'ml', 'kg', 'the', 'and', 'nr', 'typ', 'set', 'zestaw']);

export const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l')
    .toLocaleLowerCase('pl')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** Klucz porównawczy: bez spacji, znaków i polskich liter — wykrywa „Eco Shine” = „ecoshine”. */
export const compactKey = (s: string) => norm(s).replace(/ /g, '');

export function tokens(p: Pick<Product, 'name' | 'displayName'>): string[] {
  const base = norm(`${p.displayName || ''} ${p.name || ''}`);
  const out = new Set<string>();
  for (const t of base.split(' ')) {
    if (t.length < 3 || STOP.has(t) || /^\d+$/.test(t) || /^\d+(ml|l|g|kg|mm|cm|m)$/.test(t)) continue;
    // lekki stemming: końcówki fleksyjne, żeby „felgi” i „felg” trafiały razem
    out.add(t.length > 5 ? t.replace(/(ami|ach|owi|ego|emu|ych|ymi|ow|ie|a|y|i|e|u|om|em)$/, '') : t);
  }
  return [...out];
}

export interface CategorySuggestion {
  category: string;
  /** 0–1: jak jednoznacznie słowa z nazwy wskazują tę kategorię. */
  confidence: number;
  /** Słowa, które zdecydowały. */
  because: string[];
}

export interface CategoryModel {
  suggest(p: Product): CategorySuggestion | null;
  trained: number;
}

/** Uczy się na produktach z pewną kategorią i podpowiada kategorię dla pozostałych (ważone idf). */
export function buildCategoryModel(products: Product[]): CategoryModel {
  const tokenCats = new Map<string, Map<string, number>>();
  const df = new Map<string, number>();
  let trained = 0;
  for (const p of products) {
    if (p.isGroup || productNeedsCategoryDecision(p)) continue;
    const cat = getProductDisplayCategory(p);
    if (cat === UNDECIDED) continue;
    trained++;
    for (const t of tokens(p)) {
      df.set(t, (df.get(t) ?? 0) + 1);
      const m = tokenCats.get(t) ?? new Map<string, number>();
      m.set(cat, (m.get(cat) ?? 0) + 1);
      tokenCats.set(t, m);
    }
  }
  const N = Math.max(trained, 1);
  return {
    trained,
    suggest(p) {
      const score = new Map<string, number>();
      const why = new Map<string, Map<string, number>>();
      let totalIdf = 0;
      for (const t of tokens(p)) {
        const d = df.get(t);
        if (!d) continue;
        const idf = Math.log(1 + N / d);
        totalIdf += idf;
        for (const [cat, c] of tokenCats.get(t)!) {
          const w = idf * (c / d);
          score.set(cat, (score.get(cat) ?? 0) + w);
          const wm = why.get(cat) ?? new Map<string, number>();
          wm.set(t, w);
          why.set(cat, wm);
        }
      }
      if (!totalIdf) return null;
      const ranked = [...score.entries()].sort((a, b) => b[1] - a[1]);
      const [best, bestScore] = ranked[0];
      const second = ranked[1]?.[1] ?? 0;
      // pewność: udział najlepszej kategorii w całkowitej wadze słów, z karą za bliską drugą
      const share = bestScore / totalIdf;
      const margin = bestScore ? (bestScore - second) / bestScore : 0;
      const confidence = Math.max(0, Math.min(1, share * (0.5 + 0.5 * margin)));
      const because = [...(why.get(best) ?? [])].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t]) => t);
      return { category: best, confidence, because };
    },
  };
}

export interface ManufacturerSuggestion {
  manufacturer: string;
  via: string;
}

/** Podpowiada producenta po nazwie marki zawartej w nazwie/SKU produktu (całe słowa). */
export function buildManufacturerFinder(products: Product[]) {
  const counts = new Map<string, number>();
  for (const p of products) {
    const m = effectiveManufacturer(p);
    if (m && m !== 'Inne') counts.set(m, (counts.get(m) ?? 0) + 1);
  }
  const brands = [...counts.entries()]
    .map(([name, n]) => ({ name, n, key: norm(name) }))
    .filter((b) => b.key.length >= 3 && b.n >= 2)
    .sort((a, b) => b.key.length - a.key.length);
  return (p: Product): ManufacturerSuggestion | null => {
    const hay = ` ${norm(`${p.displayName || ''} ${p.name || ''}`)} `;
    for (const b of brands) {
      if (hay.includes(` ${b.key} `)) return { manufacturer: b.name, via: b.name };
    }
    return null;
  };
}

export interface DuplicateGroup {
  key: string;
  names: { name: string; count: number }[];
}

/** Nazwy (producentów / kategorii), które różnią się tylko wielkością liter, spacjami lub znakami. */
export function findNearDuplicates(items: { name: string; count: number }[]): DuplicateGroup[] {
  const map = new Map<string, { name: string; count: number }[]>();
  for (const it of items) {
    const k = compactKey(it.name);
    if (!k) continue;
    const arr = map.get(k) ?? [];
    arr.push(it);
    map.set(k, arr);
  }
  return [...map.entries()]
    .filter(([, v]) => v.length > 1)
    .map(([key, names]) => ({ key, names: names.sort((a, b) => b.count - a.count) }))
    .sort((a, b) => b.names.reduce((s, n) => s + n.count, 0) - a.names.reduce((s, n) => s + n.count, 0));
}

export interface CategoryLoad {
  name: string;
  path: string;
  count: number;
  /** Najczęstsze słowa w nazwach produktów — podpowiedź, jak podzielić dużą kategorię. */
  topWords: { word: string; count: number }[];
}

export function topWordsOf(products: Product[], limit = 6): { word: string; count: number }[] {
  const c = new Map<string, number>();
  for (const p of products) for (const t of tokens(p)) c.set(t, (c.get(t) ?? 0) + 1);
  return [...c.entries()]
    .filter(([, n]) => n >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word, count]) => ({ word, count }));
}

export interface AssortmentHealth {
  total: number;
  undecided: number;
  /** Kategoria zapisana w produkcie różni się od wyświetlanej / jest ogólna lub producenta. */
  needsReview: number;
  withSuggestion: number;
  highConfidence: number;
  noManufacturer: number;
  manufacturerSuggestions: number;
}

export function computeHealth(
  products: Product[],
  suggestions: Map<string, CategorySuggestion>,
  mfSuggestions: Map<string, ManufacturerSuggestion>,
): AssortmentHealth {
  let undecided = 0;
  let needsReview = 0;
  let noManufacturer = 0;
  let highConfidence = 0;
  for (const p of products) {
    if (getProductDisplayCategory(p) === UNDECIDED) undecided++;
    if (productNeedsCategoryDecision(p)) needsReview++;
    if (!effectiveManufacturer(p)) noManufacturer++;
  }
  for (const s of suggestions.values()) if (s.confidence >= 0.6) highConfidence++;
  return {
    total: products.length,
    undecided,
    needsReview,
    withSuggestion: suggestions.size,
    highConfidence,
    noManufacturer,
    manufacturerSuggestions: mfSuggestions.size,
  };
}
