import type { Product } from '../types';
import { KNOWLEDGE_CHECKS, assessProductKnowledge, type KnowledgeLevel } from './productKnowledge';
import { getProductDisplayCategory } from './catalogCategory';
import { effectiveManufacturer } from './waproManufacturers';
import { getProductImage } from './products';
import { VALIDATION_KINDS, VALIDATION_LABEL, buildValidationContext, validateProduct, type ValidationKind } from './validations';

/** Statystyki katalogu do panelu „Postępy” (jedno przejście po produktach). */
export interface GroupStat {
  name: string;
  count: number;
  /** % produktów ze zdjęciem. */
  photoPct: number;
  /** % produktów z EAN. */
  eanPct: number;
  /** Średnia kompletność (0–100). */
  avgScore: number;
  /** Ile produktów ma słabą kompletność (< 55). */
  weak: number;
}

export interface CheckCoverage {
  label: string;
  weight: number;
  filled: number;
  missing: number;
  pct: number;
}

export interface CatalogStats {
  total: number;
  withPhoto: number;
  withEan: number;
  withManufacturer: number;
  withPrice: number;
  inStock: number;
  zeroStock: number;
  avgScore: number;
  levels: Record<KnowledgeLevel, number>;
  /** 10 przedziałów po 10 punktów kompletności (0–9, 10–19, … 90–100). */
  histogram: number[];
  catalogs: { accessories: number; shop: number };
  manufacturers: GroupStat[];
  categories: GroupStat[];
  checks: CheckCoverage[];
  /** Kandydaci do ukrycia: bez zdjęcia, bez stanu i bez ceny sprzedaży. */
  junkCandidates: number;
  /** Liczba produktów z danym problemem jakości (walidacje). */
  validation: Record<ValidationKind, number>;
}

const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);

function groupStats(map: Map<string, { count: number; photo: number; ean: number; score: number; weak: number }>): GroupStat[] {
  return [...map.entries()]
    .map(([name, g]) => ({
      name,
      count: g.count,
      photoPct: pct(g.photo, g.count),
      eanPct: pct(g.ean, g.count),
      avgScore: g.count ? Math.round(g.score / g.count) : 0,
      weak: g.weak,
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'pl'));
}

export function computeCatalogStats(products: Product[]): CatalogStats {
  const real = products.filter((p) => !p.isGroup || p.sku);
  const levels: Record<KnowledgeLevel, number> = { weak: 0, fair: 0, good: 0, rich: 0 };
  const histogram = new Array<number>(10).fill(0);
  const checkFilled = new Map<string, number>();
  const mf = new Map<string, { count: number; photo: number; ean: number; score: number; weak: number }>();
  const cat = new Map<string, { count: number; photo: number; ean: number; score: number; weak: number }>();
  let withPhoto = 0;
  let withEan = 0;
  let withManufacturer = 0;
  let withPrice = 0;
  let inStock = 0;
  let zeroStock = 0;
  let scoreSum = 0;
  let junk = 0;
  let accessories = 0;
  let shop = 0;
  const vctx = buildValidationContext(real);
  const validation = Object.fromEntries(VALIDATION_KINDS.map((k) => [k, 0])) as Record<ValidationKind, number>;

  const bump = (
    map: typeof mf,
    key: string,
    photo: boolean,
    ean: boolean,
    score: number,
  ) => {
    const g = map.get(key) ?? { count: 0, photo: 0, ean: 0, score: 0, weak: 0 };
    g.count++;
    if (photo) g.photo++;
    if (ean) g.ean++;
    g.score += score;
    if (score < 55) g.weak++;
    map.set(key, g);
  };

  for (const p of real) {
    const k = assessProductKnowledge(p);
    const photo = !!getProductImage(p) || !!p.hasImage;
    const ean = !!p.ean?.trim() || !!p.variants?.some((v) => v.ean?.trim());
    const manufacturer = effectiveManufacturer(p);
    const price = p.priceSaleGross != null || p.priceSaleNet != null;
    const stock = p.stock ?? 0;

    levels[k.level]++;
    histogram[Math.min(9, Math.floor(k.score / 10))]++;
    scoreSum += k.score;
    // wyjątki z „Uzupełniania danych”: brak objęty wyjątkiem liczymy jak spełniony warunek
    const ex = p.meta?.dataExceptions ?? [];
    const filledLabels = new Set(k.filled);
    if (ex.length) {
      for (const label of k.missing) {
        const kind = CHECK_ACTIONS.find((a) => a.match.test(label))?.kind;
        if (ex.includes('all') || (kind && ex.includes(kind))) filledLabels.add(label);
      }
    }
    for (const label of filledLabels) checkFilled.set(label, (checkFilled.get(label) ?? 0) + 1);
    if (photo) withPhoto++;
    if (ean) withEan++;
    if (manufacturer) withManufacturer++;
    if (price) withPrice++;
    if (stock > 0) inStock++;
    else zeroStock++;
    if (!photo && stock <= 0 && !price) junk++;
    if ((p.catalog || 'accessories') === 'shop') shop++;
    else accessories++;
    // walidacje jakości (z uwzględnieniem wyjątków „Walidacje jakości” i „Cały produkt”)
    const exc = p.meta?.dataExceptions ?? [];
    if (!exc.includes('all') && !exc.includes('validation')) {
      const kinds = new Set(validateProduct(p, vctx).map((f) => f.kind));
      for (const kd of kinds) validation[kd]++;
    }

    bump(mf, manufacturer || 'Bez producenta', photo, ean, k.score);
    bump(cat, getProductDisplayCategory(p) || 'Bez kategorii', photo, ean, k.score);
  }

  const total = real.length;
  const checks: CheckCoverage[] = KNOWLEDGE_CHECKS.map((c) => {
    const filled = checkFilled.get(c.label) ?? 0;
    return { label: c.label, weight: c.weight, filled, missing: total - filled, pct: pct(filled, total) };
  });

  return {
    total,
    withPhoto,
    withEan,
    withManufacturer,
    withPrice,
    inStock,
    zeroStock,
    avgScore: total ? Math.round(scoreSum / total) : 0,
    levels,
    histogram,
    catalogs: { accessories, shop },
    manufacturers: groupStats(mf),
    categories: groupStats(cat),
    checks,
    junkCandidates: junk,
    validation,
  };
}

// ---------------------------------------------------------------------------------------------
// Podpowiedzi „co dalej”
// ---------------------------------------------------------------------------------------------

export interface Suggestion {
  id: string;
  title: string;
  detail: string;
  /** Ilu produktów dotyczy. */
  count: number;
  /** O ile punktów wzrosłaby średnia kompletność katalogu po uzupełnieniu. */
  gain: number;
  /** Rodzaje braków do ustawienia w filtrze Uzupełniania danych. */
  kinds: string[];
}

/** Etykieta składnika kompletności → rodzaj braku w widoku Uzupełnianie danych + opis działania. */
const CHECK_ACTIONS: { match: RegExp; kind: string; verb: string }[] = [
  { match: /^Zdjęcie/, kind: 'photo', verb: 'Dodaj zdjęcia' },
  { match: /^EAN/, kind: 'ean', verb: 'Uzupełnij kody EAN' },
  { match: /^Producent/, kind: 'mfr', verb: 'Przypisz producentów' },
  { match: /^Cena sprzedaży/, kind: 'price', verb: 'Uzupełnij ceny sprzedaży' },
  { match: /^Kategoria szczegółowa/, kind: 'category', verb: 'Ustaw szczegółowe kategorie' },
  { match: /^Pełny opis/, kind: 'low', verb: 'Napisz pełne opisy' },
  { match: /^Krótki opis/, kind: 'low', verb: 'Dopisz krótkie opisy' },
  { match: /^Sposób użycia/, kind: 'low', verb: 'Uzupełnij sposób użycia / skład / bezpieczeństwo' },
  { match: /^Typ rozpoznany/, kind: 'type', verb: 'Potwierdź typy produktów' },
  { match: /^Nazwa produktu/, kind: 'low', verb: 'Popraw nazwy produktów' },
];

/** Najbardziej opłacalne następne kroki: wg wzrostu średniej kompletności katalogu. */
export function suggestNext(stats: CatalogStats, limit = 5): Suggestion[] {
  const out: Suggestion[] = [];
  for (const c of stats.checks) {
    if (c.missing <= 0 || stats.total === 0) continue;
    const action = CHECK_ACTIONS.find((a) => a.match.test(c.label));
    if (!action) continue;
    const gain = (c.weight * c.missing) / stats.total;
    out.push({
      id: action.kind + ':' + c.label,
      title: `${action.verb} (${c.missing.toLocaleString('pl-PL')})`,
      detail: `${c.pct}% katalogu ma już „${c.label}”. Uzupełnienie wszystkich podniesie średnią kompletność o ok. ${gain.toFixed(1)} pkt.`,
      count: c.missing,
      gain,
      kinds: [action.kind],
    });
  }
  out.sort((a, b) => b.gain - a.gain);
  const validationHints: { kind: ValidationKind; verb: string; gain: number }[] = [
    { kind: 'eanBad', verb: 'Popraw błędne kody EAN', gain: 0.9 },
    { kind: 'dupEan', verb: 'Rozwiąż duplikaty EAN', gain: 0.9 },
    { kind: 'priceBelow', verb: 'Sprawdź ceny sprzedaży poniżej zakupu', gain: 0.8 },
    { kind: 'dupName', verb: 'Sprawdź duplikaty nazw', gain: 0.4 },
  ];
  for (const h of validationHints) {
    const n = stats.validation[h.kind];
    if (n > 0) {
      out.push({
        id: 'val:' + h.kind,
        title: `${h.verb} (${n.toLocaleString('pl-PL')})`,
        detail: `${VALIDATION_LABEL[h.kind]} — to błąd jakości danych, który może blokować wystawienie produktu albo prowadzić do strat.`,
        count: n,
        gain: h.gain,
        kinds: [h.kind],
      });
    }
  }
  out.sort((a, b) => b.gain - a.gain);
  if (stats.junkCandidates >= 10) {

    out.push({
      id: 'junk',
      title: `Sprawdź ${stats.junkCandidates.toLocaleString('pl-PL')} pozycji do ukrycia`,
      detail: 'Bez zdjęcia, bez stanu i bez ceny — to zwykle części, śmietnik albo martwe indeksy. Ukrycie ich oczyści statystyki.',
      count: stats.junkCandidates,
      gain: 0.5,
      kinds: ['photo'],
    });
  }
  return out.slice(0, limit);
}
