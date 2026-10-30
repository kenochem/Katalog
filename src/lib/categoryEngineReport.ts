import type { Product } from '../types';
import { getProductDisplayCategory } from './catalogCategory';
import { buildEngine, type Decision, type EngineProduct } from './categoryEngine';
import { categoryKey, flattenCategories } from './categoryRegistry';
import { bestShopCategory, type ShopSkuFile } from './shopMirror';
import { supabase } from './supabase';
import { effectiveManufacturer } from './waproManufacturers';

const UNDECIDED = 'Do decyzji';

export interface EngineRow {
  id: string;
  sku: string;
  name: string;
  maker: string;
  ean: string;
  stock: number;
  decision: Decision;
  /** Ścieżka docelowej kategorii w drzewie (do zapisania razem z kategorią). */
  toPath: string;
}

/** Pełne opisy produktów (nie są w liście produktów) — pobierane partiami. */
export async function fetchDescriptions(ids: string[], onProgress?: (done: number, total: number) => void): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!supabase) return map;
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await supabase.from('products').select('id,description').in('id', ids.slice(i, i + 200));
    if (error) throw new Error(error.message);
    for (const r of data ?? []) map.set(String(r.id), String(r.description ?? ''));
    onProgress?.(Math.min(ids.length, i + 200), ids.length);
  }
  return map;
}

const plain = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Uruchamia silnik kategorii na wszystkich produktach (bez grup) i zwraca decyzję dla każdego. */
export function runCategoryEngine(products: Product[], descriptions: Map<string, string>, shop?: ShopSkuFile | null): EngineRow[] {
  const flat = flattenCategories();
  const leaves = flat.filter((c) => c.isLeaf);
  const leafSet = new Set(leaves.map((c) => c.name));
  const byKey = new Map(leaves.map((c) => [categoryKey(c.name), c]));
  const singles = products.filter((p) => !p.isGroup && (p.sku ?? '').trim());

  const shopLeafOf = (p: Product): string | undefined => {
    const ids = shop?.skus[(p.sku ?? '').trim().toUpperCase()];
    const best = ids ? bestShopCategory(ids) : null;
    // tylko liść, który istnieje w naszym drzewie (kategorie wycofane i przebudowane nie liczą się)
    return best && best.isLeaf && byKey.has(categoryKey(best.name)) ? byKey.get(categoryKey(best.name))!.name : undefined;
  };

  const prepare = (p: Product): EngineProduct => {
    const cur = getProductDisplayCategory(p);
    return {
      sku: p.sku!.trim().toUpperCase(),
      name: p.displayName || p.name,
      maker: effectiveManufacturer(p),
      desc: plain(descriptions.get(p.id) ?? p.description ?? ''),
      short: plain(String(p.meta?.shortDescription ?? '')),
      usage: plain(String(p.meta?.descUsage ?? '')),
      comp: plain(String(p.meta?.descComposition ?? '')),
      category: cur !== UNDECIDED && byKey.has(categoryKey(cur)) ? byKey.get(categoryKey(cur))!.name : '',
      shopLeaf: shopLeafOf(p),
    };
  };

  const prepared = singles.map(prepare);
  const engine = buildEngine(prepared, { leaves: leafSet });
  return singles.map((p, i) => {
    const decision = engine.decide(prepared[i]);
    return {
      id: p.id,
      sku: p.sku!.trim(),
      name: p.displayName || p.name,
      maker: effectiveManufacturer(p),
      ean: p.ean ?? '',
      stock: p.stock ?? 0,
      decision,
      toPath: decision.to ? (byKey.get(categoryKey(decision.to))?.path ?? '') : '',
    };
  });
}

export interface EngineSummary {
  total: number;
  confirmed: number;
  changes: EngineRow[];
  review: EngineRow[];
  research: EngineRow[];
  /** Pozycje niesprzedażowe (usługi, wysyłka, sprzęt biurowy) — do ukrycia w katalogu. */
  hide: EngineRow[];
  /** Zmiany kategorii z flagami walidacji (sprzeczność, rodzina niespójna). */
  flagged: EngineRow[];
}

/**
 * Zakres wyniku: „uzupełnij” — tylko produkty bez kategorii (co przypisać), „audyt” — tylko produkty z kategorią
 * (co jest przypisane źle lub podejrzanie).
 */
export type EngineScope = 'uzupelnij' | 'audyt';

export function summarizeEngine(all: EngineRow[], scope: EngineScope = 'uzupelnij'): EngineSummary {
  const rows = all.filter((r) => (scope === 'uzupelnij' ? r.decision.from === UNDECIDED : r.decision.from !== UNDECIDED));
  const changes = rows.filter((r) => r.decision.status === 'pewne' && r.decision.to && r.decision.to !== r.decision.from);
  const review = rows.filter((r) => r.decision.status === 'do sprawdzenia');
  const research = rows.filter((r) => r.decision.status === 'do wyszukania');
  const hide = rows.filter((r) => r.decision.status === 'do ukrycia');
  const flagged = rows.filter((r) => r.decision.flags.some((f) => f === 'sprzeczność nazwa/opis' || f === 'rodzina niespójna'));
  return { total: rows.length, confirmed: rows.length - changes.length - review.length - research.length - hide.length, changes, review, research, hide, flagged };
}

export interface TreeHealth {
  /** Kategorie, w których po zastosowaniu wszystkich pewnych decyzji nie zostałby żaden produkt — do usunięcia. */
  empty: string[];
  /** Kategorie z 1–2 produktami — kandydaci do scalenia. */
  tiny: { path: string; count: number }[];
  /** Pary kategorii, między którymi silnik często się waha (produkty pasują do obu) — możliwy dubel albo zbyt płynna granica. */
  confusable: { a: string; b: string; count: number }[];
}

/** Sprawdza sens samego drzewa: puste kategorie, drobnica i kategorie często mylone ze sobą. */
export function treeHealth(rows: EngineRow[]): TreeHealth {
  const leaves = flattenCategories().filter((c) => c.isLeaf);
  const projected = new Map<string, number>();
  const pairs = new Map<string, number>();
  for (const r of rows) {
    const d = r.decision;
    const cat = d.status === 'pewne' && d.to ? d.to : d.from;
    projected.set(categoryKey(cat), (projected.get(categoryKey(cat)) ?? 0) + 1);
    const [first, second] = d.alternatives;
    if (first && second && second.score >= 0.5 && first.score - second.score < 0.6) {
      const k = [first.leaf, second.leaf].sort().join(' <> ');
      pairs.set(k, (pairs.get(k) ?? 0) + 1);
    }
  }
  const count = (name: string) => projected.get(categoryKey(name)) ?? 0;
  return {
    empty: leaves.filter((c) => count(c.name) === 0).map((c) => c.path),
    tiny: leaves.filter((c) => count(c.name) > 0 && count(c.name) <= 2).map((c) => ({ path: c.path, count: count(c.name) })),
    confusable: [...pairs.entries()]
      .filter(([, n]) => n >= 3)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([k, n]) => ({ a: k.split(' <> ')[0], b: k.split(' <> ')[1], count: n })),
  };
}

const q = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
const BOM = String.fromCharCode(0xfeff);

/** Pozycje, które wyglądają na niesprzedażowe (usługa, wysyłka, sprzęt biurowy) — nie ma sensu szukać dla nich kategorii. */
export const NON_SALES = /usluga|usługa|wysylka|wysyłka|paleta|notebook|rozliczenie|przyczepa|segregator|koszulka reklamowa/i;

export function proposalsCsv(rows: EngineRow[]): string {
  const head = ['Status', 'SKU', 'Nazwa', 'Producent', 'Obecna kategoria', 'Proponowana kategoria', 'Wynik', 'Alternatywy', 'Flagi', 'Uzasadnienie'];
  const order = { 'do sprawdzenia': 0, 'do wyszukania': 1, 'do ukrycia': 2, pewne: 3 } as const;
  const list = rows
    .filter((r) => r.decision.status !== 'pewne' || (r.decision.to && r.decision.to !== r.decision.from))
    .sort((a, b) => order[a.decision.status] - order[b.decision.status] || a.decision.from.localeCompare(b.decision.from, 'pl'));
  const lines = list.map((r) =>
    [r.decision.status, r.sku, r.name, r.maker, r.decision.from, r.decision.to ?? '', r.decision.score, r.decision.alternatives.map((a) => `${a.leaf} (${a.score})`).join(' | '), r.decision.flags.join(', '), r.decision.reason].map(q).join(';'),
  );
  return BOM + [head.map(q).join(';'), ...lines].join('\r\n');
}

export function hideCsv(rows: EngineRow[]): string {
  const head = ['SKU', 'Nazwa', 'Producent', 'Stan', 'Powód ukrycia'];
  const lines = rows.map((r) => [r.sku, r.name, r.maker, r.stock, r.decision.reason].map(q).join(';'));
  return BOM + [head.map(q).join(';'), ...lines].join('\r\n');
}

export function researchCsv(rows: EngineRow[]): string {
  const head = ['SKU', 'Nazwa', 'Producent', 'EAN', 'Obecna kategoria', 'Stan', 'Uwaga', 'Zapytanie', 'Link do wyszukania'];
  const lines = rows.map((r) => {
    const maker = r.maker && !/^(inni producenci|ogólna|marka niezdefiniowana)$/i.test(r.maker) ? `${r.maker} ` : '';
    const query = `${maker}${r.name} do czego służy zastosowanie`;
    const note = NON_SALES.test(r.name) ? 'prawdopodobnie pozycja niesprzedażowa (usługa, wysyłka, sprzęt biurowy) — do ukrycia lub usunięcia z katalogu' : '';
    return [r.sku, r.name, r.maker, r.ean, r.decision.from, r.stock, note, query, `https://www.google.com/search?q=${encodeURIComponent(r.ean ? `${r.ean} ${r.name}` : query)}`].map(q).join(';');
  });
  return BOM + [head.map(q).join(';'), ...lines].join('\r\n');
}
