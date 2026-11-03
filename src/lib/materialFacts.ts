import type { MaterialFact } from './categoryEngine';

/**
 * Wyciąganie faktów o produkcie z tekstu kart charakterystyki (SDS), kart technicznych (TDS) i ulotek.
 * Tekst pochodzi z pdftotext; parsery są odporne na bałagan układu kolumn i brak polskich znaków.
 */

/** Fakty o produktach (SKU → fakty) zbudowane skryptem scripts/build-material-facts.ts; brak pliku oznacza brak faktów. */
export async function loadMaterialFacts(): Promise<Record<string, MaterialFact>> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}data/material-facts.json`);
    if (!res.ok) return {};
    const facts = ((await res.json()) as { facts?: Record<string, MaterialFact> }).facts ?? {};
    // pH spoza skali 0–14 w starszych plikach to pomyłka parsera (np. temperatura obok napisu pH)
    for (const f of Object.values(facts)) f.ph = validPh(f.ph);
    return facts;
  } catch {
    return {};
  }
}

const clean = (s: string) =>
  s
    .replace(/\f/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).replace(/\s+\S*$/, '')}…` : s);

export type DocKind = 'sds' | 'tds';

export function docKindOf(text: string): DocKind {
  return /karta\s+charakterystyki|sekcja\s+1\s*:|1907\/2006/i.test(text.slice(0, 4000)) ? 'sds' : 'tds';
}

/** Nagłówki spotykane w kartach technicznych i ulotkach (po polsku, bez względu na wielkość liter). */
const HEADINGS: [string, RegExp][] = [
  ['use', /(?:^|\n)\s*(zastosowanie|przeznaczenie|do czego s[łl]u[żz]y)\s*:?\s*/gi],
  ['props', /(?:^|\n)\s*(w[łl]a[śs]ciwo[śs]ci|cechy|opis produktu|opis)\s*:?\s*/gi],
  ['usage', /(?:^|\n)\s*(spos[óo]b u[żz]ycia(?: i dozowania)?|spos[óo]b stosowania|stosowanie|dozowanie)\s*:?\s*/gi],
  ['comp', /(?:^|\n)\s*(sk[łl]ad|sk[łl]adniki)\s*:?\s*/gi],
  ['data', /(?:^|\n)\s*(dane techniczne|parametry)\s*:?\s*/gi],
  ['stop', /(?:^|\n)\s*(bezpiecze[ńn]stwo stosowania|odradzane zastosowania|przechowywanie|uwagi|pierwsza pomoc|opakowania)\s*:?\s*/gi],
];

function sectionsOf(text: string): Record<string, string> {
  const marks: { at: number; len: number; key: string }[] = [];
  for (const [key, re] of HEADINGS) {
    re.lastIndex = 0;
    for (const m of text.matchAll(re)) marks.push({ at: m.index ?? 0, len: m[0].length, key });
  }
  marks.sort((a, b) => a.at - b.at);
  const out: Record<string, string> = {};
  marks.forEach((m, i) => {
    const end = marks[i + 1]?.at ?? text.length;
    if (m.key === 'stop') return;
    const body = clean(text.slice(m.at + m.len, end));
    if (body.length > 15 && !out[m.key]) out[m.key] = body;
  });
  // pierwszy akapit przed nagłówkami zwykle opisuje produkt jednym zdaniem
  if (marks.length) {
    const lead = clean(text.slice(0, marks[0].at));
    if (lead.length > 40) out.lead = lead;
  }
  return out;
}

const PH = /\bpH\b[^0-9\n]{0,40}(\d{1,2}(?:[.,]\d+)?(?:\s?[-–]\s?\d{1,2}(?:[.,]\d+)?)?)/i;

/** pH musi mieścić się w skali 0–14 (inaczej to temperatura, stężenie itp. z sąsiedztwa napisu pH). */
export function validPh(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const nums = value.replace(',', '.').match(/\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  return nums.length && nums.every((n) => n >= 0 && n <= 14) ? value : undefined;
}

/** Dane techniczne z kart: gęstość, termin trwałości i zapach. */
function technicalOf(t: string): Pick<MaterialFact, 'density' | 'shelfLife' | 'fragrance'> {
  const density = t.match(/g[ęe]sto[śs][ćc][^0-9\n]{0,15}(\d+(?:[.,]\d+)?(?:\s?[-–]\s?\d+(?:[.,]\d+)?)?)\s?g\s?\/\s?(?:ml|cm)/i)?.[1];
  const shelf = t.match(/termin\s+trwa[łl]o[śs]ci[^0-9\n]{0,10}(\d{1,3})\s?(miesi|lat|rok)/i);
  const months = shelf ? (/^(lat|rok)/i.test(shelf[2]) ? Number(shelf[1]) * 12 : Number(shelf[1])) : undefined;
  const fragrance = t.match(/(?:zapach(?:em|u)?\s+([a-ząćęłńóśźż]+(?:owy|owym|ny|nym))|([a-ząćęłńóśźż]+(?:owy|owym|ny))\s+zapach)/i);
  return { density: density?.replace(/\s+/g, ' ').replace(/\s?[-–]\s?/, ' – '), shelfLife: months, fragrance: (fragrance?.[1] ?? fragrance?.[2])?.toLowerCase() };
}

/** Boilerplate kart charakterystyki, który niczego nie mówi o produkcie. */
const SDS_NOISE = /zobacz instrukcj\w*|brak dodatkowych informacji|zastosowanie profesjonalne|zastosowanie substancji\/mieszaniny|odradzane zastosowanie|nie dotyczy/gi;

export function extractFact(text: string, fileName: string): { kind: DocKind; fact: Omit<MaterialFact, 'files'> } | null {
  const t = text.replace(/\r/g, '');
  const kind = docKindOf(t);
  const ph = validPh(t.match(PH)?.[1]?.replace(',', '.'));
  if (kind === 'sds') {
    const s12 = t.match(/1\.2\.?[^\n]*\n([\s\S]{0,900}?)(?=\n\s*1\.3\.?|\n\s*1\.2\.2)/i)?.[1] ?? '';
    const typ = [...t.slice(0, 3000).matchAll(/(?:Rodzaj produktu|Typ produktu|Kategoria produktu)\s*:?\s*([^\n]{3,60})/gi)].map((m) => m[1]);
    const useCandidate = clean(`${s12} ${typ.join(' ')}`).replace(SDS_NOISE, ' ').replace(/\s{2,}/g, ' ').trim();
    // karty bez sensownego opisu zastosowania (sam nagłówek sekcji) niczego nie mówią o produkcie
    const useRaw = useCandidate.length > 25 && !/SEKCJA|Identyfikator|1\.1\.|zidentyfikowane zastosowania/i.test(useCandidate) ? useCandidate : '';
    const form = t.match(/(?:Posta[ćc]?|Stan skupienia|Wygl[ąa]d)[^\n:]{0,20}:\s*([^\n]{3,40})/i)?.[1];
    return {
      kind,
      fact: {
        use: cut(useRaw, 300),
        ph,
        form: form ? clean(form) : undefined,
        ...technicalOf(t),
      },
    };
  }
  const sec = sectionsOf(t);
  const use = [sec.use, sec.props, sec.lead].filter(Boolean).join(' ');
  if (!use && !sec.usage) return null;
  void fileName;
  return {
    kind,
    fact: {
      use: cut(clean(use), 600),
      usage: sec.usage ? cut(sec.usage, 500) : undefined,
      comp: sec.comp ? cut(sec.comp, 300) : undefined,
      ph,
      ...technicalOf(t),
    },
  };
}

/** Łączy fakty z kilku dokumentów jednego produktu; karty techniczne mają pierwszeństwo przed boilerplate'em kart charakterystyki. */
export function mergeFacts(parts: { kind: DocKind; fact: Omit<MaterialFact, 'files'>; file: string }[]): MaterialFact | null {
  if (!parts.length) return null;
  const ordered = [...parts].sort((a, b) => Number(a.kind === 'sds') - Number(b.kind === 'sds'));
  const pick = (key: 'use' | 'usage' | 'comp' | 'ph' | 'form') => ordered.map((p) => p.fact[key]).find((v) => !!v && String(v).trim().length > 0);
  const uses = [...new Set(ordered.map((p) => p.fact.use).filter((v): v is string => !!v && v.length > 8))];
  return {
    use: cut(uses.join(' '), 700),
    usage: pick('usage'),
    comp: pick('comp'),
    ph: pick('ph'),
    form: pick('form'),
    density: ordered.map((p) => p.fact.density).find(Boolean),
    shelfLife: ordered.map((p) => p.fact.shelfLife).find((v) => !!v),
    fragrance: ordered.map((p) => p.fact.fragrance).find(Boolean),
    files: [...new Set(parts.map((p) => p.file))],
  };
}
