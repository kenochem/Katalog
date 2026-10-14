/**
 * Warstwa techniczna produktów (nyple, trójniki, kolanka, redukcje, dysze): rozpoznawanie typu i
 * parametrów (końcówki gwintowe, materiał, podtyp) z chaotycznych nazw WAPRO. Nazw WAPRO nie
 * zmieniamy — wynik jest tylko propozycją (albo zatwierdzonym zapisem w `product_tech`).
 */

export type TechType = 'nypel' | 'trojnik' | 'kolanko' | 'redukcja' | 'dysza';

export const TECH_TYPES: { id: TechType; label: string; labelPlural: string; ends: number }[] = [
  { id: 'nypel', label: 'Nypel', labelPlural: 'Nyple', ends: 2 },
  { id: 'trojnik', label: 'Trójnik', labelPlural: 'Trójniki', ends: 3 },
  { id: 'kolanko', label: 'Kolanko', labelPlural: 'Kolanka', ends: 2 },
  { id: 'redukcja', label: 'Redukcja', labelPlural: 'Redukcje', ends: 2 },
  { id: 'dysza', label: 'Dysza', labelPlural: 'Dysze', ends: 1 },
];

export const TECH_TYPE_LABEL: Record<TechType, string> = Object.fromEntries(
  TECH_TYPES.map((t) => [t.id, t.label]),
) as Record<TechType, string>;

export const TECH_TYPE_PLURAL: Record<TechType, string> = Object.fromEntries(
  TECH_TYPES.map((t) => [t.id, t.labelPlural]),
) as Record<TechType, string>;

export type Material = 'stal' | 'mosiadz' | 'inox' | 'ocynk' | 'plastik';

export const MATERIAL_LABEL: Record<Material, string> = {
  stal: 'Stal',
  mosiadz: 'Mosiądz',
  inox: 'Inox (nierdzewna)',
  ocynk: 'Ocynk',
  plastik: 'Plastik',
};

/** Przymiotniki wg rodzaju rzeczownika: [męski, nijaki, żeński]. */
const MATERIAL_ADJ: Record<Material, [string, string, string]> = {
  stal: ['stalowy', 'stalowe', 'stalowa'],
  mosiadz: ['mosiężny', 'mosiężne', 'mosiężna'],
  inox: ['nierdzewny', 'nierdzewne', 'nierdzewna'],
  ocynk: ['ocynkowany', 'ocynkowane', 'ocynkowana'],
  plastik: ['plastikowy', 'plastikowe', 'plastikowa'],
};
const TYPE_GENDER: Record<TechType, 0 | 1 | 2> = { nypel: 0, trojnik: 0, kolanko: 1, redukcja: 2, dysza: 2 };

/** Podtypy (zależne od typu). */
export const TECH_SUBTYPES: Record<TechType, { id: string; label: string }[]> = {
  nypel: [
    { id: 'zwykly', label: 'Zwykły' },
    { id: 'obrotowy', label: 'Obrotowy' },
    { id: 'nakretka', label: 'Z nakrętką' },
    { id: 'inny', label: 'Inny' },
  ],
  trojnik: [
    { id: 'zwykly', label: 'Zwykły' },
    { id: 'y', label: 'Typu Y' },
    { id: 'inny', label: 'Inny' },
  ],
  kolanko: [
    { id: 'zwykle', label: 'Zwykłe' },
    { id: 'inne', label: 'Inne' },
  ],
  redukcja: [
    { id: 'zwykla', label: 'Zwykła' },
    { id: 'nakretka', label: 'Z nakrętką' },
    { id: 'obrotowa', label: 'Obrotowa' },
    { id: 'bayonet', label: 'Bayonet' },
    { id: 'inna', label: 'Inna' },
  ],
  dysza: [
    { id: 'wody', label: 'Dysza wody' },
    { id: 'rotacyjna', label: 'Rotacyjna' },
    { id: 'kanalizacyjna', label: 'Kanalizacyjna' },
    { id: 'paliwa', label: 'Paliwa (palnikowa)' },
    { id: 'pianowa', label: 'Pianowa' },
    { id: 'inzektora', label: 'Inżektora chemii' },
    { id: 'rolnicza', label: 'Rolnicza (opryskiwacz)' },
    { id: 'dwupozycyjna', label: 'Dwupozycyjna' },
    { id: 'inna', label: 'Inna' },
  ],
};

export function subtypeLabel(type: TechType, subtype: string): string {
  return TECH_SUBTYPES[type]?.find((s) => s.id === subtype)?.label ?? subtype;
}

// ---------------------------------------------------------------------------------------------
// Gwinty
// ---------------------------------------------------------------------------------------------

/** M = zewnętrzny („męski”, GZ), Ż = wewnętrzny („żeński”, GW), null = nie wiadomo. */
export type ThreadGender = 'M' | 'Ż' | null;

export interface Thread {
  /** np. `1/4″`, `3/8″`, `M22`; przy nierozpoznanym rozmiarze — tekst z nazwy. */
  size: string;
  gender: ThreadGender;
  /** false = rozmiar spoza typowych (prawdopodobna literówka w nazwie, np. 3/18). */
  valid: boolean;
}

const INCH_VALID = new Set(['1/8', '1/4', '3/8', '1/2', '5/8', '3/4', '1', '1 1/4', '1 1/2', '2']);
const METRIC_VALID = new Set([12, 14, 15, 16, 18, 20, 22, 24, 26, 30]);

export function threadLabel(t: Thread): string {
  return `${t.size}${t.gender ? ' ' + t.gender : ''}`;
}

/** Klucz do porównań (rozmiar + rodzaj) — do filtrów. */
export function threadKey(t: Thread): string {
  return threadLabel(t);
}

/** Alias „po waprowemu” dla jednej końcówki. */
function threadAliases(t: Thread): string[] {
  const raw = t.size.replace('″', '');
  const out = [raw.toLowerCase()];
  if (t.gender === 'M') out.push(`gz ${raw}`, `${raw} m`, `${raw} zewnętrzny`, `${raw} męski`);
  if (t.gender === 'Ż') out.push(`gw ${raw}`, `${raw} ż`, `${raw} f`, `${raw} wewnętrzny`, `${raw} żeński`);
  return out;
}

const L = 'A-ZĄĆĘŁŃÓŚŹŻ';
const THREAD_RE = new RegExp(
  `(?<![${L}0-9/.,])(GZ|GW|G)?\\s?(M)?\\s?(\\d+\\s?/\\s?\\d+|\\d+)\\s?(GZ|GW|M|F|Ż)?(?![${L}0-9/]|[.,]\\d)`,
  'g',
);

function normalizeSize(rawNum: string, metric: boolean): { size: string; valid: boolean } {
  const num = rawNum.replace(/\s/g, '');
  if (!num.includes('/') && (metric || Number(num) >= 10)) {
    const n = Number(num);
    return { size: `M${num}`, valid: METRIC_VALID.has(n) };
  }
  return { size: `${num}″`, valid: INCH_VALID.has(num) };
}

export function parseThreadToken(text: string): Thread | null {
  THREAD_RE.lastIndex = 0;
  const m = THREAD_RE.exec(text.toUpperCase());
  THREAD_RE.lastIndex = 0;
  if (!m) return null;
  return buildThread(m);
}

function buildThread(m: RegExpExecArray): Thread {
  const [, pre, metricM, num, suf] = m;
  const { size, valid } = normalizeSize(num, Boolean(metricM));
  let gender: ThreadGender = null;
  const g = (suf || pre || '').toUpperCase();
  if (g === 'GZ' || (g === 'M' && suf)) gender = 'M';
  else if (g === 'GW' || g === 'F' || g === 'Ż') gender = 'Ż';
  return { size, gender, valid };
}

/** Wyciąga wszystkie końcówki gwintowe z fragmentu nazwy (z obsługą `3x1/4F`, `2xGZM22 i 1xGWM22`). */
export function parseThreads(text: string): Thread[] {
  // „3x1/4F” → „1/4F - 1/4F - 1/4F”
  const s = text
    .toUpperCase()
    .replace(/(?<![\d/])([1-6])\s?X\s?((?:GZ|GW|G)?\s?M?\s?\d+(?:\/\d+)?\s?(?:GZ|GW|M|F|Ż)?)/g, (_m, n: string, tok: string) =>
      Array(Number(n)).fill(tok.trim()).join(' - ') + ' ',
    );
  const out: Thread[] = [];
  THREAD_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = THREAD_RE.exec(s))) {
    const t = buildThread(m);
    out.push(t);
  }
  THREAD_RE.lastIndex = 0;
  return out;
}

// ---------------------------------------------------------------------------------------------
// Parser nazwy
// ---------------------------------------------------------------------------------------------

export interface TechAttrs {
  /** Końcówki (A, B, C…) — zależnie od typu. */
  ends: Thread[];
  material?: Material;
  /** Dysze: rozmiar otworu (np. 075) i kod katalogowy (np. 25-040). */
  orifice?: string;
  code?: string;
  series?: string;
  maxBar?: number;
  /** Dysze: czy ma gwint przyłączeniowy (do grupowania „z gwintem / bez gwintu”). */
  threaded?: boolean;
  swivel?: boolean;
  nut?: boolean;
  long?: boolean;
}

export type TechConfidence = 'ok' | 'review';

export interface TechParse {
  type: TechType;
  subtype: string;
  attrs: TechAttrs;
  displayName: string;
  aliases: string[];
  confidence: TechConfidence;
  reasons: string[];
}

const TYPE_START: { type: TechType; re: RegExp }[] = [
  { type: 'nypel', re: /^(?:\S+\s+)?NYP(?:EL|LE)\b/ },
  { type: 'trojnik', re: /^(?:\S+\s+)?TR[ÓO]JNIK/ },
  { type: 'kolanko', re: /^(?:\S+\s+)?KOLAN(?:KO|KA|O)\b/ },
  { type: 'redukcja', re: /^(?:\S+\s+)?REDUKCJ/ },
  { type: 'dysza', re: /^(?:\S+\s+)?DYSZA\b/ },
];

function detectMaterial(s: string): Material | undefined {
  if (/\bINO?X\b|NIERDZEW/.test(s)) return 'inox';
  if (/MOSI[ĄA]DZ|MOSI[ĘE]Ż|MOSIEZ/.test(s)) return 'mosiadz';
  if (/\bSTAL(OW[AEY])?\b|\bSTEEL\b/.test(s)) return 'stal';
  if (/OCYNK/.test(s)) return 'ocynk';
  if (/PLASTIK|\bPVC\b|TWORZYW/.test(s)) return 'plastik';
  return undefined;
}

function cleanForThreads(s: string): { clean: string; code?: string; maxBar?: number; orifice?: string } {
  let clean = s;
  let maxBar: number | undefined;
  let code: string | undefined;
  let orifice: string | undefined;
  clean = clean.replace(/\([^)]*\)/g, ' '); // nawiasy: numery katalogowe, wymiary
  clean = clean.replace(/(\d{2,3})\s?BAR\b/g, (_, n: string) => {
    maxBar = Number(n);
    return ' ';
  });
  clean = clean.replace(/(?<![\d/])(\d{2})\s?-\s?(\d{3})(?![\d/])/g, (_, a: string, b: string) => {
    code = `${a}-${b}`;
    return ' ';
  });
  clean = clean.replace(/\b[A-Z]{1,4}-\d{1,3}\b/g, ' '); // oznaczenia modeli: SF-03, ST-160
  clean = clean.replace(/\b\d{4,}\b/g, ' '); // długie numery katalogowe
  clean = clean.replace(/\bKAT\d+\b/g, ' ');
  clean = clean.replace(/\bDN\s?\d+\b/g, ' ');
  clean = clean.replace(/\b\d+(?:[.,]\d+)?\s?MM\b/g, ' ');
  clean = clean.replace(/(?<![\d/])0\d{2}(?![\d/])/g, (m0) => {
    orifice = m0;
    return ' ';
  });
  return { clean, code, maxBar, orifice };
}

function fmtEnds(ends: Thread[]): string {
  return ends.map(threadLabel).join(' × ');
}

function buildDisplayName(type: TechType, subtype: string, a: TechAttrs): string {
  const base = TECH_TYPE_LABEL[type];
  if (type === 'dysza') {
    const sub = subtype === 'inna' ? '' : subtype === 'wody' ? ' wody' : ' ' + subtypeLabel('dysza', subtype).toLowerCase();
    const model = [a.series, a.code ?? a.orifice].filter(Boolean).join(' ');
    const head = `${base}${sub}${model ? ' ' + model : ''}`;
    const tail: string[] = [];
    if (a.maxBar) tail.push(`${a.maxBar} bar`);
    if (a.ends.length) tail.push(fmtEnds(a.ends));
    else if (subtype === 'wody') tail.push('bez gwintu');
    return tail.length ? `${head}, ${tail.join(', ')}` : head;
  }
  let head = base;
  if (type === 'nypel' && subtype === 'obrotowy') head += ' obrotowy';
  if (type === 'redukcja' && subtype === 'obrotowa') head += ' obrotowa';
  if (type === 'redukcja' && subtype === 'bayonet') head += ' bayonet';
  if (type === 'trojnik' && subtype === 'y') head += ' Y';
  if (a.material) head += ' ' + MATERIAL_ADJ[a.material][TYPE_GENDER[type]];
  const tail: string[] = [];
  if (a.ends.length) tail.push(fmtEnds(a.ends));
  if (a.nut && subtype !== 'nakretka') tail.push('z nakrętką');
  if (subtype === 'nakretka') tail.push('z nakrętką');
  if (a.long) tail.push(['długi', 'długie', 'długa'][TYPE_GENDER[type]]);
  return tail.length ? `${head} ${tail.join(', ')}` : head;
}

/** Rozpoznaje typ i parametry z nazwy WAPRO. Zwraca null, gdy to nie jest element z obsługiwanych typów. */
export function parseTechName(rawName: string): TechParse | null {
  const name = String(rawName ?? '').trim();
  if (!name) return null;
  const s = name.toUpperCase().replace(/\s+/g, ' ');
  const hit = TYPE_START.find((t) => t.re.test(s));
  if (!hit) return null;
  const type = hit.type;
  const reasons: string[] = [];

  const { clean, code, maxBar, orifice } = cleanForThreads(s);
  // tekst po słowie kluczowym typu (żeby nie łapać liczb z marki na początku)
  const afterType = clean.replace(/^.*?(NYP(?:EL|LE)|TR[ÓO]JNIK|KOLAN(?:KO|KA|O)|REDUKCJ\S*|DYSZA)/, ' ');
  let ends = parseThreads(afterType);
  const material = detectMaterial(s);

  const attrs: TechAttrs = { ends, material };
  if (code) attrs.code = code;
  if (orifice) attrs.orifice = orifice;
  if (maxBar) attrs.maxBar = maxBar;
  if (/OBROTOW/.test(s)) attrs.swivel = true;
  if (/NAKR[ĘE]TK/.test(s)) attrs.nut = true;
  if (/D[ŁL]UG(A|I|IE)\b/.test(s)) attrs.long = true;

  let subtype = '';
  switch (type) {
    case 'nypel':
      subtype = attrs.swivel ? 'obrotowy' : attrs.nut ? 'nakretka' : 'zwykly';
      break;
    case 'trojnik':
      subtype = /TR[ÓO]JNIK Y\b/.test(s) ? 'y' : 'zwykly';
      break;
    case 'kolanko':
      subtype = 'zwykle';
      break;
    case 'redukcja':
      subtype = /BAYON/.test(s) ? 'bayonet' : attrs.swivel ? 'obrotowa' : attrs.nut ? 'nakretka' : 'zwykla';
      break;
    case 'dysza':
      if (/ROTACYJN|ROTJET/.test(s)) subtype = 'rotacyjna';
      else if (/KANALIZ/.test(s)) subtype = 'kanalizacyjna';
      else if (/PALIWA|DANFOS/.test(s)) subtype = 'paliwa';
      else if (/PIAN/.test(s)) subtype = 'pianowa';
      else if (/INŻEKTOR|INZEKTOR/.test(s)) subtype = 'inzektora';
      else if (/KWAZAR|OPRYSKIWACZ|LOWDRIFT|EVENFAN|DEFLECTOR/.test(s)) subtype = 'rolnicza';
      else if (/DW[ÓU]CH POZYCJI/.test(s)) subtype = 'dwupozycyjna';
      else if (/WODY|STRUMIENIOW/.test(s) || code) subtype = 'wody';
      else subtype = 'inna';
      break;
  }

  if (type === 'dysza') {
    const series = /\b(HB|LP|F3|ROTJET)\b/.exec(s)?.[1];
    if (series) attrs.series = series;
    if (subtype === 'paliwa' || subtype === 'inzektora' || subtype === 'rolnicza') ends = [];
    ends = ends.filter((e) => e.valid);
    attrs.ends = ends;
    attrs.threaded = ends.length > 0;
  }

  // oczekiwana liczba końcówek
  let expected = TECH_TYPES.find((t) => t.id === type)!.ends;
  if (subtype === 'bayonet' || (ends.length === 1 && /ZAKUCI|WĘŻ|WEZ|WTYK/.test(s))) expected = 1;
  if (type === 'trojnik' && ends.length === 1) {
    attrs.ends = ends = [ends[0], ends[0], ends[0]];
    reasons.push('Jedna końcówka w nazwie — przyjęto, że wszystkie trzy są takie same');
  }
  if (type !== 'dysza' && ends.length !== expected) {
    reasons.push(
      ends.length === 0
        ? 'Nie znaleziono gwintów w nazwie'
        : `Znaleziono ${ends.length} końcówki/ek zamiast ${expected}`,
    );
  }
  if (type === 'dysza' && subtype === 'rotacyjna' && !orifice) reasons.push('Brak rozmiaru otworu');
  if (type === 'dysza' && subtype === 'inna') reasons.push('Nie rozpoznano rodzaju dyszy');
  if (ends.some((e) => !e.valid)) reasons.push('Nietypowy rozmiar gwintu (możliwa literówka w nazwie)');

  // aliasy „po waprowemu” + synonimy
  const aliases = new Set<string>();
  for (const e of ends) for (const a of threadAliases(e)) aliases.add(a);
  if (type === 'nypel') ['łącznik', 'złączka'].forEach((x) => aliases.add(x));
  if (type === 'kolanko') ['kątownik', 'kolano'].forEach((x) => aliases.add(x));
  if (type === 'trojnik') ['rozdzielacz', 'trójnik'].forEach((x) => aliases.add(x));
  if (type === 'redukcja') ['przejściówka', 'adapter'].forEach((x) => aliases.add(x));
  if (attrs.series) aliases.add(attrs.series.toLowerCase());
  if (attrs.code) aliases.add(attrs.code);

  const displayName = buildDisplayName(type, subtype, attrs);
  return {
    type,
    subtype,
    attrs,
    displayName,
    aliases: [...aliases],
    confidence: reasons.length ? 'review' : 'ok',
    reasons,
  };
}

/** Składa nazwę katalogową po ręcznej edycji parametrów. */
export function rebuildDisplayName(type: TechType, subtype: string, attrs: TechAttrs): string {
  return buildDisplayName(type, subtype, attrs);
}

export function rebuildAliases(type: TechType, attrs: TechAttrs): string[] {
  const aliases = new Set<string>();
  for (const e of attrs.ends) for (const a of threadAliases(e)) aliases.add(a);
  if (attrs.series) aliases.add(attrs.series.toLowerCase());
  if (attrs.code) aliases.add(attrs.code);
  void type;
  return [...aliases];
}
