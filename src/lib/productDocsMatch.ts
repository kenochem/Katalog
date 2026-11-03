import { fold } from './partsText';

/**
 * Dopasowanie plików z materiałami (karty charakterystyki, ulotki, certyfikaty) do produktów katalogu.
 * Najpierw po SKU zapisanym w nazwie pliku, potem po nazwie handlowej produktu.
 */

export interface DocFile {
  /** Ścieżka względna wybranego folderu, np. „Cid Lines/Alcalu S_266_PL_9.05.pdf”. */
  path: string;
}

export interface DocProduct {
  id: string;
  sku: string;
  name: string;
  maker: string;
}

export interface DocMatch {
  path: string;
  products: DocProduct[];
}

/** Marka folderu → słowa, po których rozpoznajemy producenta produktu (Cid Lines sprzedaje się też jako Kenotek). */
const BRAND_ALIASES: [RegExp, RegExp][] = [
  [/cid\s*lines|kenotek/, /cid lines|kenotek|kenotk/],
  [/tenzi/, /tenzi/],
  [/draco/, /draco/],
  [/eco\s*shine|ecoshine/, /eco shine|ecoshine/],
  [/(^|\/)k2(\/|$)/, /\bk2\b/],
  [/cartec/, /cartec/],
  [/kala/, /kala/],
  [/freshtek/, /freshtek|vaportek|hotellux/],
  [/sonax/, /sonax/],
];

/** Rozszerzenia dokumentów, które importujemy (zdjęcia i archiwa pomijamy). */
const DOC_EXT = /\.(pdf|docx?|xlsx?|txt)$/i;

/** Czy plik z folderu jest materiałem do wgrania: nie zdjęcie, nie zbiorczy pakiet wielu produktów, nie manifest. */
export function isImportableDoc(path: string): boolean {
  if (!DOC_EXT.test(path)) return false;
  const segs = path.split('/');
  if (segs.slice(0, -1).some((s) => /^(zdjecia|zdjęcia|etykiety|dane_produktowe)$/i.test(s))) return false;
  return !/zbiorcz|manifest|robots|sitemap/i.test(segs[segs.length - 1]);
}

/** Typ dokumentu rozpoznany po nazwie podfolderu — dopisujemy go do nazwy wgrywanego pliku, żeby karta i KCH o tej samej nazwie nie nadpisały się. */
const DOC_KINDS: [RegExp, string][] = [
  [/informacje_bezpieczenstwa|karty_charakterystyki/i, 'KCH'],
  [/karty_produktu/i, 'Karta produktu'],
  [/^tds$/i, 'TDS'],
  [/ulotki/i, 'Ulotka'],
  [/certyfikaty/i, 'Certyfikat'],
  [/arkusze_skladnikow/i, 'Skladniki'],
  [/deklaracje/i, 'Deklaracja'],
  [/dokumenty_formalne/i, 'Dokument'],
  [/inne_dokumenty/i, 'Inne'],
];

/** Nazwa pliku w materiałach produktu: dla plików z podfolderów typów dokumentów z prefiksem typu, dla pozostałych bez zmian. */
export function uploadNameFor(path: string): string {
  const segs = path.split('/');
  const file = segs[segs.length - 1];
  for (const s of segs.slice(0, -1)) {
    const kind = DOC_KINDS.find(([re]) => re.test(s));
    if (kind) return `${kind[1]} - ${file}`;
  }
  return file;
}

const STOP = new Set(['do', 'na', 'dla', 'i', 'w', 'z', 'ze', 'the', 'and', 'pl', 'pt', 'v1', 'beczka', 'kanister', 'szt']);
/** Słowa opisujące rodzaj dokumentu, a nie produkt. */
const NOISE = new Set([
  'karta', 'techniczna', 'charakterystyki', 'produktu', 'instrukcja', 'deklaracja', 'zgodnosci', 'atest', 'certyfikat',
  'pozwolenie', 'badanie', 'dermat', 'informacje', 'bezpieczenstwa', 'ulotka', 'informacyjna', 'sds', 'tds', 'kch', 'eng', 'gb',
  'technical', 'datasheets', 'datasheet',
]);
/** Pojemności (10l, 500ml, 25kg) — to samo „kartę” mają wszystkie opakowania produktu. Same liczby zostają: to numery modeli. */
const VOLUME = /^\d+([.,]\d+)?(ml|l|g|kg|szt|mm|cm)$/;
/** Słowa linii produktowej przed nazwą (np. „home pro kabiny prysznicowe”, „detailer tapicerka”) nie są częścią nazwy produktu. */
const LINE_WORDS = new Set(['home', 'pro', 'detailer', 'refinish', 'colorline']);
const BRAND_PREFIX = /^(cid lines|kenotek|kenotk|tenzi|k2|draco|cartec|kala|freshtek|eco shine|ecoshine)(?![a-z0-9])[\s_-]*/i;

/** Dwie wersje słów: z polskimi znakami usuniętymi przez eksport (p_yn) i znormalizowana — dopasowanie zalicza dowolną. */
function words(text: string): string[][] {
  const clean = (t: string) =>
    t
      .replace(/\+/g, ' plus ')
      .split(/[^a-z0-9]+/)
      .filter((w) => w && !STOP.has(w) && !NOISE.has(w) && !VOLUME.test(w));
  const lower = text.toLowerCase();
  return [clean(lower), clean(fold(lower))];
}

/** Wyciąga nazwę produktu z nazwy pliku: bez rozszerzenia, kodu dokumentu, wersji, języka, skrótu z końca i marki z początku. */
export function productPartOfFile(path: string): string {
  let b = (path.split('/').pop() ?? path).replace(/\.[a-z0-9]{2,4}$/i, '');
  b = b
    .replace(/�/g, ' ')
    .replace(/\(\s*\d+\s*(kb|mb)\s*\)/gi, ' ')
    .replace(/[-_]*ulotka[_ ]informacyjna.*$/i, '')
    .replace(/_[0-9a-f]{8,10}$/, '')
    .replace(/_PL_[A-Z0-9]{3}_PL_[\d.]+$/, '')
    .replace(/_[A-Z0-9]{1,3}_(PL|PT|EN|DE)_[\d.]+$/, '')
    .replace(/_(PL|PT|EN|DE)_[\d.]+$/, '')
    .replace(/\s*\((eng|pl|en)\)\s*/gi, ' ')
    .replace(/^(sds|tds)[_\s-]+/i, '')
    .replace(/_\d$/, '')
    .replace(/^\d{3,5}\s*[-–]?\s+/, '')
    .replace(/^[A-Z]{2,6}\d{1,3}\s+/, '')
    .replace(/[_\s-]+kch$/i, '')
    .trim();
  // eksport dublował nazwę („AIR_FRESHENER_czarne_AIR_FRESHENER_czarne”)
  const parts = b.split(/[_\s]+/).filter(Boolean);
  if (parts.length >= 2 && parts.length % 2 === 0) {
    const half = parts.length / 2;
    if (parts.slice(0, half).join(' ').toLowerCase() === parts.slice(half).join(' ').toLowerCase()) b = parts.slice(0, half).join(' ');
  }
  b = b.split(/\s[-–]\s/)[0];
  // pojemność i opis po niej nie należą do nazwy („K2 TAPIS 750 ML”)
  b = b.replace(/\s*\b\d+(?:[.,]\d+)?\s?(?:ml|l|kg|g)\b.*$/i, '');
  for (let i = 0; i < 3 && BRAND_PREFIX.test(b); i++) b = b.replace(BRAND_PREFIX, '');
  return b.replace(/^\d{3,5}\s+/, '').trim();
}

/** Nazwa handlowa produktu: bez marki na początku, opisu po myślniku i pojemności. */
export function coreOfProductName(name: string): string {
  const trimmed = name
    .split(/\s[-–]\s/)[0]
    .replace(BRAND_PREFIX, '')
    .replace(/^pro\s+/i, '')
    .trim();
  // opis i pojemność nie należą do nazwy handlowej: „ACTIVE FOAM CHERRY 20L- kwaśna piana” → „ACTIVE FOAM CHERRY”
  const cut = trimmed.replace(/\s*\b\d+(?:[.,]\d+)?\s?(?:ml|l|kg|g|litr\w*)(?![a-ząćęłńóśźż]).*$/i, '').trim();
  return (cut || trimmed).replace(/\s{2,}/g, ' ');
}

function brandOfFolder(path: string): RegExp | null {
  const folder = fold(path.split('/').slice(0, -1).join('/'));
  const file = fold(path.split('/').pop() ?? '');
  for (const [folderRe, makerRe] of BRAND_ALIASES) if (folderRe.test(folder)) return makerRe;
  if (!folder) for (const [folderRe, makerRe] of BRAND_ALIASES) if (folderRe.test(file)) return makerRe;
  return null;
}

/** Pliki pobrane ze sklepu mają nazwę „tenzi_tenzi_<produkt>_<opis>_<pojemność>_<skrót>”: nazwa produktu jest na początku, dalej opis. */
const isShopSlug = (path: string) => /^tenzi[_-]tenzi[_-]/i.test(path.split('/').pop() ?? '');

/** Pojemność z nazwy produktu lub pliku (np. „10l”, „0.5l”) — rozstrzyga, gdy kilka kart pasuje tak samo. */
function sizeOf(text: string): string | null {
  const m = text.toLowerCase().match(/(\d+(?:[._,]\d+)?)\s?(ml|l|kg)(?![a-z])/);
  return m ? `${m[1].replace(/[_,]/g, '.')}${m[2]}` : null;
}

interface View {
  toks: Set<string>;
  list: string[];
  compact: string;
}

const viewsOf = (text: string): View[] =>
  words(text).map((t) => {
    while (t.length > 1 && LINE_WORDS.has(t[0])) t = t.slice(1);
    return { toks: new Set(t), list: t, compact: t.join('') };
  });

export function matchDocs(files: DocFile[], products: DocProduct[]): { matches: DocMatch[]; unmatched: string[]; ambiguous: string[] } {
  const bySku = new Map(products.map((p) => [p.sku.toUpperCase(), p]));
  const prepared = products
    .map((p) => ({ p, brand: fold(`${p.maker} ${p.name.split(/\s[-–]\s/)[0]}`), views: viewsOf(coreOfProductName(p.name)) }))
    .filter((x) => x.views[0].toks.size > 0);

  interface Cand {
    path: string;
    key: string;
    prec: number;
    size: string | null;
  }
  const perProduct = new Map<string, Cand[]>();
  const productOf = new Map<string, DocProduct>();
  const byPath = new Map<string, DocProduct[]>();
  const push = (path: string, p: DocProduct) => {
    const list = byPath.get(path) ?? [];
    if (!list.some((x) => x.id === p.id)) list.push(p);
    byPath.set(path, list);
  };
  const unmatched = new Set<string>();

  for (const f of files) {
    const base = (f.path.split('/').pop() ?? '').toUpperCase();
    // 1. SKU w nazwie pliku — najpewniejsze dopasowanie
    const skuHits = (base.split(/[^A-Z0-9]+/).filter((s) => /^[A-Z0-9]{5,10}$/.test(s)) ?? []).map((s) => bySku.get(s)).filter((p): p is DocProduct => !!p);
    if (skuHits.length) {
      for (const p of skuHits) push(f.path, p);
      continue;
    }
    // 2. nazwa handlowa
    const brand = brandOfFolder(f.path);
    const fileViews = viewsOf(productPartOfFile(f.path));
    if (!brand || !fileViews[0].toks.size) {
      unmatched.add(f.path);
      continue;
    }
    const slug = isShopSlug(f.path);
    // Cid Lines i Tenzi mają warianty o prefiksowych nazwach (DM Cid / DM Cid S), więc tam wymagamy dokładnej nazwy
    const prefixOk = !/cid lines|tenzi/.test(brand.source);
    const size = sizeOf(f.path.split('/').pop() ?? '');
    for (const x of prepared) {
      if (!brand.test(x.brand)) continue;
      let hit: { prec: number } | null = null;
      for (let v = 0; v < 2 && !hit; v++) {
        const pv = x.views[v];
        const fv = fileViews[v];
        if (!pv.toks.size || !fv.toks.size) continue;
        const exact = pv.compact === fv.compact || (pv.toks.size === fv.toks.size && [...pv.toks].every((t) => fv.toks.has(t)));
        const subset = slug && [...pv.toks].every((t, i) => fv.list[i] === t);
        // nazwa w pliku jest początkiem pełnej nazwy produktu („K2 BONO” → „K2 BONO do plastików zewnętrznych”)
        const prefix = prefixOk && pv.list.length > fv.list.length && fv.list.every((t, i) => pv.list[i] === t);
        if (exact) hit = { prec: 1 };
        else if (subset) hit = { prec: pv.toks.size / fv.toks.size };
        else if (prefix) hit = { prec: (0.9 * fv.list.length) / pv.list.length };
      }
      if (!hit) continue;
      const list = perProduct.get(x.p.id) ?? [];
      list.push({ path: f.path, key: fileViews[1].compact, prec: hit.prec, size });
      perProduct.set(x.p.id, list);
      productOf.set(x.p.id, x.p);
    }
  }

  // produkt dostaje tylko najlepiej pasujące pliki; kilka różnych dokumentów o tym samym dopasowaniu to niejednoznaczność
  const ambiguous = new Set<string>();
  for (const [id, all] of perProduct) {
    // wśród kart opisowych (nazwa produktu + opis) pierwszeństwo ma ta o pojemności zgodnej z produktem
    // (tylko gdy kandydaci to różne dokumenty — ten sam dokument w kilku pojemnościach trafia do produktu w całości)
    const want = sizeOf(productOf.get(id)!.name);
    const sized = want ? all.filter((c) => c.prec < 1 && c.size === want) : [];
    const differ = new Set(all.map((c) => c.key)).size > 1;
    const cands = !all.some((c) => c.prec >= 1) && differ && sized.length ? sized : all;
    const best = Math.max(...cands.map((c) => c.prec));
    const top = cands.filter((c) => c.prec >= best - 1e-9);
    const distinct = new Set(top.map((c) => c.key));
    if (best < 1 && distinct.size > 1) {
      for (const c of top) ambiguous.add(c.path);
      continue;
    }
    for (const c of top) push(c.path, productOf.get(id)!);
  }
  const matches: DocMatch[] = [...byPath].map(([path, ps]) => ({ path, products: ps }));
  const matchedPaths = new Set(matches.map((m) => m.path));
  for (const f of files) if (!matchedPaths.has(f.path)) unmatched.add(f.path);
  return { matches, unmatched: [...unmatched].filter((x) => !ambiguous.has(x)), ambiguous: [...ambiguous].filter((x) => !matchedPaths.has(x)) };
}
