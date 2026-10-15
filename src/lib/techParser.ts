/**
 * Warstwa techniczna produktów (nyple, trójniki, kolanka, redukcje, dysze): rozpoznawanie typu i
 * parametrów (końcówki gwintowe, materiał, podtyp) z chaotycznych nazw WAPRO. Nazw WAPRO nie
 * zmieniamy — wynik jest tylko propozycją (albo zatwierdzonym zapisem w `product_tech`).
 */

export type TechType =
  | 'nypel'
  | 'trojnik'
  | 'kolanko'
  | 'redukcja'
  | 'dysza'
  | 'szybkozlacze'
  | 'adapter'
  | 'zawor'
  | 'oring'
  | 'zaslepka'
  | 'manometr'
  | 'gniazdo'
  | 'lanca'
  | 'pistolet'
  | 'waz'
  | 'filtr'
  | 'sitko'
  | 'pianownica'
  | 'zbiornik'
  | 'naprawczy';

export const TECH_TYPES: { id: TechType; label: string; labelPlural: string; ends: number }[] = [
  { id: 'nypel', label: 'Nypel', labelPlural: 'Nyple', ends: 2 },
  { id: 'trojnik', label: 'Trójnik', labelPlural: 'Trójniki', ends: 3 },
  { id: 'kolanko', label: 'Kolanko', labelPlural: 'Kolanka', ends: 2 },
  { id: 'redukcja', label: 'Redukcja', labelPlural: 'Redukcje', ends: 2 },
  { id: 'dysza', label: 'Dysza', labelPlural: 'Dysze', ends: 1 },
  { id: 'szybkozlacze', label: 'Szybkozłącze', labelPlural: 'Szybkozłącza', ends: 0 },
  { id: 'adapter', label: 'Adapter', labelPlural: 'Adaptery', ends: 2 },
  { id: 'zawor', label: 'Zawór', labelPlural: 'Zawory', ends: 0 },
  { id: 'oring', label: 'Uszczelka', labelPlural: 'Uszczelki i o-ringi', ends: 0 },
  { id: 'zaslepka', label: 'Zaślepka', labelPlural: 'Zaślepki i korki', ends: 1 },
  { id: 'manometr', label: 'Manometr', labelPlural: 'Manometry', ends: 1 },
  { id: 'gniazdo', label: 'Gniazdo', labelPlural: 'Gniazda', ends: 0 },
  { id: 'lanca', label: 'Lanca', labelPlural: 'Lance', ends: 0 },
  { id: 'pistolet', label: 'Pistolet', labelPlural: 'Pistolety', ends: 0 },
  { id: 'waz', label: 'Wąż', labelPlural: 'Węże', ends: 0 },
  { id: 'filtr', label: 'Filtr', labelPlural: 'Filtry', ends: 0 },
  { id: 'sitko', label: 'Sitko', labelPlural: 'Sitka', ends: 0 },
  { id: 'pianownica', label: 'Pianownica', labelPlural: 'Pianownice', ends: 0 },
  { id: 'zbiornik', label: 'Zbiornik', labelPlural: 'Zbiorniki', ends: 0 },
  { id: 'naprawczy', label: 'Zestaw naprawczy', labelPlural: 'Zestawy naprawcze', ends: 0 },
];

export const TECH_TYPE_LABEL: Record<TechType, string> = Object.fromEntries(
  TECH_TYPES.map((t) => [t.id, t.label]),
) as Record<TechType, string>;

export const TECH_TYPE_PLURAL: Record<TechType, string> = Object.fromEntries(
  TECH_TYPES.map((t) => [t.id, t.labelPlural]),
) as Record<TechType, string>;

export type Material = 'stal' | 'mosiadz' | 'inox' | 'ocynk' | 'plastik' | 'miedz';

export const MATERIAL_LABEL: Record<Material, string> = {
  stal: 'Stal',
  mosiadz: 'Mosiądz',
  inox: 'Inox (nierdzewna)',
  ocynk: 'Ocynk',
  plastik: 'Plastik',
  miedz: 'Miedź',
};

/** Przymiotniki wg rodzaju rzeczownika: [męski, nijaki, żeński]. */
const MATERIAL_ADJ: Record<Material, [string, string, string]> = {
  stal: ['stalowy', 'stalowe', 'stalowa'],
  mosiadz: ['mosiężny', 'mosiężne', 'mosiężna'],
  inox: ['nierdzewny', 'nierdzewne', 'nierdzewna'],
  ocynk: ['ocynkowany', 'ocynkowane', 'ocynkowana'],
  plastik: ['plastikowy', 'plastikowe', 'plastikowa'],
  miedz: ['miedziany', 'miedziane', 'miedziana'],
};
const TYPE_GENDER: Record<TechType, 0 | 1 | 2> = {
  nypel: 0,
  trojnik: 0,
  kolanko: 1,
  redukcja: 2,
  dysza: 2,
  szybkozlacze: 1,
  adapter: 0,
  zawor: 0,
  oring: 2,
  zaslepka: 2,
  manometr: 0,
  gniazdo: 1,
  lanca: 2,
  pistolet: 0,
  waz: 0,
  filtr: 0,
  sitko: 1,
  pianownica: 2,
  zbiornik: 0,
  naprawczy: 1,
};

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
  szybkozlacze: [
    { id: 'zwykle', label: 'Zwykłe' },
    { id: 'wodne', label: 'Wodne' },
    { id: 'do-lancy', label: 'Do lancy' },
    { id: 'na-waz', label: 'Na wąż' },
  ],
  adapter: [
    { id: 'zwykly', label: 'Zwykły' },
    { id: 'klock', label: 'K-Lock' },
    { id: 'ssawki', label: 'Ssawki odkurzacza' },
  ],
  zawor: [
    { id: 'zwrotny', label: 'Zwrotny' },
    { id: 'kulowy', label: 'Kulowy' },
    { id: 'ssacy', label: 'Ssący' },
    { id: 'bypass', label: 'By-pass' },
    { id: 'bezpieczenstwa', label: 'Bezpieczeństwa' },
    { id: 'cisnieniowy', label: 'Ciśnieniowy / regulacji ciśnienia' },
    { id: 'plywakowy', label: 'Pływakowy' },
    { id: 'dozujacy', label: 'Dozujący / dozownika' },
    { id: 'regulacyjny', label: 'Regulacji (chemii, pianownicy)' },
    { id: 'inny', label: 'Inny' },
  ],
  oring: [
    { id: 'oring', label: 'O-ring' },
    { id: 'uszczelka', label: 'Uszczelka' },
  ],
  zaslepka: [
    { id: 'zaslepka', label: 'Zaślepka' },
    { id: 'korek', label: 'Korek' },
  ],
  manometr: [{ id: 'zwykly', label: 'Zwykły' }],
  gniazdo: [{ id: 'zwykle', label: 'Zwykłe' }],
  lanca: [
    { id: 'zwykla', label: 'Zwykła' },
    { id: 'pianowa', label: 'Pianowa' },
  ],
  pistolet: [
    { id: 'myjki', label: 'Myjki ciśnieniowej' },
    { id: 'suszacy', label: 'Suszący / przedmuchujący' },
    { id: 'pianowy', label: 'Pianowy' },
  ],
  waz: [
    { id: 'wysokocisnieniowy', label: 'Wysokociśnieniowy' },
    { id: 'zbrojony', label: 'Zbrojony' },
    { id: 'kanalizacyjny', label: 'Kanalizacyjny' },
    { id: 'ogrodowy', label: 'Ogrodowy' },
    { id: 'chemii', label: 'Do natrysku chemii' },
    { id: 'odkurzacza', label: 'Do odkurzacza' },
    { id: 'bebna', label: 'Do bębna / zwijaka' },
    { id: 'inny', label: 'Inny' },
  ],
  filtr: [
    { id: 'wody', label: 'Wody' },
    { id: 'chemii', label: 'Chemii' },
    { id: 'odkurzacza', label: 'Odkurzacza' },
    { id: 'powietrza', label: 'Powietrza / pyłowy' },
    { id: 'inny', label: 'Inny' },
  ],
  sitko: [{ id: 'zwykle', label: 'Zwykłe' }],
  pianownica: [{ id: 'zwykla', label: 'Zwykła' }],
  zbiornik: [{ id: 'zwykly', label: 'Zwykły' }],
  naprawczy: [{ id: 'zwykly', label: 'Zwykły' }],
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
  /** np. `1/4`, `3/8`, `M22` (bez znaczka cali); przy nierozpoznanym rozmiarze — tekst z nazwy. */
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
  `(?<![${L}0-9/.,])(GZ|GW|TR|G)?\\s?(M)?\\s?(\\d+\\s?/\\s?\\d+|\\d+)\\s?(GZ|GW|M|F|Ż|WEW|ZEW)?(?![${L}0-9/]|[.,]\\d)`,
  'g',
);

function normalizeSize(rawNum: string, metric: boolean): { size: string; valid: boolean } {
  const num = rawNum.replace(/\s/g, '');
  if (!num.includes('/') && (metric || Number(num) >= 10)) {
    const n = Number(num);
    return { size: `M${num}`, valid: METRIC_VALID.has(n) };
  }
  return { size: num, valid: INCH_VALID.has(num) };
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
  const norm = normalizeSize(num, Boolean(metricM));
  let { size, valid } = norm;
  if (pre === 'TR') {
    // K-Lock: TR22, TR18
    size = `TR${num.replace(/\s/g, '')}`;
    valid = ['18', '22'].includes(num.replace(/\s/g, ''));
  }
  let gender: ThreadGender = null;
  const g = (suf || pre || '').toUpperCase();
  if (g === 'GZ' || g === 'ZEW' || (g === 'M' && suf)) gender = 'M';
  else if (g === 'GW' || g === 'F' || g === 'Ż' || g === 'WEW') gender = 'Ż';
  return { size, gender, valid };
}

/** Wyciąga wszystkie końcówki gwintowe z fragmentu nazwy (z obsługą `3x1/4F`, `2xGZM22 i 1xGWM22`). */
export function parseThreads(text: string): Thread[] {
  // „3x1/4F” → „1/4F - 1/4F - 1/4F”
  const s = text
    .toUpperCase()
    .replace(/(?<![\d/])([1-6])\s?X\s?((?:GZ|GW|TR|G)?\s?M?\s?\d+(?:\/\d+)?\s?(?:GZ|GW|M|F|Ż)?)/g, (_m, n: string, tok: string) =>
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
  /** Płeć złącza podana słownie („męskie”, „damskie”) — gdy nie ma gwintu z oznaczeniem. */
  gender?: ThreadGender;
  /** System / marka (K-Lock, Comet, KEW, Karcher…). */
  system?: string;
  /** O-ringi: wymiary w mm (średnica wewn. × grubość). */
  dims?: string;
  /** Manometry: średnica tarczy w mm. */
  diameterMm?: number;
  /** Węże, lance: długość (np. „25 m”). */
  length?: string;
  /** Węże: średnica nominalna (np. DN13, Ø10). */
  dn?: string;
  /** Pianownice, zbiorniki: pojemność w litrach. */
  capacityL?: number;
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
  { type: 'szybkozlacze', re: /^(?:\S+\s+)?SZYBKOZ[ŁL][ĄA]CZ/ },
  { type: 'adapter', re: /^(?:\S+\s+)?ADAPTER\b/ },
  { type: 'zawor', re: /^(?:\S+\s+)?ZAW[ÓO]R(?![A-ZĄĆĘŁŃÓŚŹŻ])/ },
  { type: 'oring', re: /^(?:\S+\s+)?(?:O-?RING|USZCZELK)/ },
  { type: 'zaslepka', re: /^(?:\S+\s+)?(?:ZAŚLEPKA|ZASLEPKA|KOREK)\b/ },
  { type: 'manometr', re: /^(?:\S+\s+)?MANOMETR\b/ },
  { type: 'gniazdo', re: /^(?:\S+\s+)?GNIAZDO\b/ },
  { type: 'naprawczy', re: /^ZESTAW NAP/ },
  { type: 'lanca', re: /^(?:\S+\s+)?LANC(?:A|E|Y)(?![A-ZĄĆĘŁŃÓŚŹŻ])/ },
  { type: 'pistolet', re: /^(?:\S+\s+)?PISTOLET(?![A-ZĄĆĘŁŃÓŚŹŻ])/ },
  { type: 'waz', re: /^(?:\S+\s+)?(?:WĄŻ|WAZ|WĘŻYK|WEZYK)(?![A-ZĄĆĘŁŃÓŚŹŻ])/ },
  { type: 'filtr', re: /^(?:\S+\s+)?FILTR(?:Y)?(?![A-ZĄĆĘŁŃÓŚŹŻ])/ },
  { type: 'sitko', re: /^(?:\S+\s+)?(?:SITKO|SITO)(?![A-ZĄĆĘŁŃÓŚŹŻ])/ },
  { type: 'pianownica', re: /^(?:\S+\s+)?PIANOWNICA(?![A-ZĄĆĘŁŃÓŚŹŻ])/ },
  { type: 'zbiornik', re: /^(?:\S+\s+)?ZBIORNIK(?![A-ZĄĆĘŁŃÓŚŹŻ])/ },
];

const SYSTEMS: [RegExp, string][] = [
  [/K-?LOCK/, 'K-Lock'],
  [/\bKEW\b/, 'KEW'],
  [/COMET/, 'Comet'],
  [/K[ÄA]RCHER/, 'Karcher'],
  [/NILFISK/, 'Nilfisk'],
  [/LAVOR/, 'Lavor'],
  [/KR[ÄA]NZLE/, 'Kranzle'],
  [/STIHL/, 'Stihl'],
  [/PARKSIDE/, 'Parkside'],
  [/BLACK&DECKER/, 'Black&Decker'],
  [/\bCAT\b/, 'CAT'],
  [/PULSAR/, 'Pulsar'],
  [/\bIPC\b/, 'IPC'],
  [/\bSEKO\b/, 'Seko'],
  [/HAWK/, 'Hawk'],
];

function detectMaterial(s: string): Material | undefined {
  if (/\bINO?X\b|NIERDZEW/.test(s)) return 'inox';
  if (/MOSI[ĄA]DZ|MOSI[ĘE]Ż|MOSIEZ/.test(s)) return 'mosiadz';
  if (/\bSTAL(OW[AEY])?\b|\bSTEEL\b/.test(s)) return 'stal';
  if (/OCYNK/.test(s)) return 'ocynk';
  if (/PLASTIK|\bPVC\b|TWORZYW/.test(s)) return 'plastik';
  if (/MIEDŹ|MIEDZ/.test(s)) return 'miedz';
  return undefined;
}

function cleanForThreads(s: string): { clean: string; code?: string; maxBar?: number; orifice?: string } {
  let clean = s;
  let maxBar: number | undefined;
  let code: string | undefined;
  let orifice: string | undefined;
  clean = clean.replace(/\([^)]*\)/g, ' '); // nawiasy: numery katalogowe, wymiary
  clean = clean.replace(/(?:\d{1,3}\s?-\s?)?(\d{1,3})\s?BAR\b/g, (_, n: string) => {
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
  const extra = buildExtraDisplayName(type, subtype, a);
  if (extra) return extra;
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

const GENDER_WORD: Record<'M' | 'Ż', string[]> = { M: ['męski', 'męskie', 'męska'], Ż: ['żeński', 'żeńskie', 'żeńska'] };

function buildExtraDisplayName(type: TechType, subtype: string, a: TechAttrs): string | null {
  const g = type === 'zaslepka' && subtype === 'korek' ? 0 : TYPE_GENDER[type];
  const mat = a.material ? MATERIAL_ADJ[a.material][g] : '';
  const ends = a.ends.length ? fmtEnds(a.ends) : '';
  const gen = a.gender && a.ends.length === 0 ? GENDER_WORD[a.gender][g] : '';
  const join = (...p: (string | undefined | false)[]) => p.filter(Boolean).join(' ');
  switch (type) {
    case 'szybkozlacze': {
      const sub = subtype === 'wodne' ? 'wodne' : subtype === 'do-lancy' ? 'do lancy' : subtype === 'na-waz' ? 'na wąż' : '';
      return join('Szybkozłącze', sub, mat, gen, a.system, ends);
    }
    case 'adapter':
      return join('Adapter', subtype === 'ssawki' ? 'ssawki' : '', mat, a.system, ends);
    case 'zawor': {
      const SUB: Record<string, string> = {
        zwrotny: 'zwrotny',
        kulowy: 'kulowy',
        ssacy: 'ssący',
        bypass: 'by-pass',
        bezpieczenstwa: 'bezpieczeństwa',
        cisnieniowy: 'ciśnieniowy',
        plywakowy: 'pływakowy',
        dozujacy: 'dozujący',
        regulacyjny: 'regulacyjny',
      };
      const sub = SUB[subtype] ?? '';
      return join('Zawór', sub, mat, a.system, ends);
    }
    case 'oring':
      return join(subtype === 'uszczelka' ? 'Uszczelka' : 'O-ring', a.system, a.dims ? `${a.dims} mm` : '');
    case 'zaslepka':
      return join(subtype === 'korek' ? 'Korek' : 'Zaślepka', mat, ends);
    case 'manometr':
      return join('Manometr', a.diameterMm ? `Ø${a.diameterMm}` : '', a.maxBar ? `${a.maxBar} bar` : '', ends);
    case 'gniazdo':
      return join('Gniazdo', a.system, ends);
    case 'lanca':
    case 'pistolet':
    case 'waz':
    case 'filtr':
    case 'sitko':
    case 'pianownica':
    case 'zbiornik':
    case 'naprawczy': {
      const SUB: Record<string, string> = {
        pianowa: 'pianowa',
        suszacy: 'suszący',
        pianowy: 'pianowy',
        wysokocisnieniowy: 'wysokociśnieniowy',
        zbrojony: 'zbrojony',
        kanalizacyjny: 'kanalizacyjny',
        ogrodowy: 'ogrodowy',
        bebna: 'do bębna',
        wody: 'wody',

        chemii: 'chemii',
        odkurzacza: 'odkurzacza',
        powietrza: 'powietrza',
      };
      return join(
        TECH_TYPE_LABEL[type],
        SUB[subtype],
        mat,
        a.system,
        a.length,
        a.dn,
        a.capacityL ? a.capacityL + ' l' : '',
        a.maxBar ? a.maxBar + ' bar' : '',
        ends,
      );
    }
    default:
      return null;
  }
}

/** Rozpoznaje typ i parametry z nazwy WAPRO. Zwraca null, gdy to nie jest element z obsługiwanych typów. */
export function parseTechName(rawName: string): TechParse | null {
  const name = String(rawName ?? '').trim();
  if (!name) return null;
  const s = name.toUpperCase().replace(/\s+/g, ' ');
  if (/^(ZESTAW|KOMPLET|USZCZELNIENIE|ELEKTRO)\b/.test(s) && !/^ZESTAW NAP/.test(s)) return null;
  const hit = TYPE_START.find((t) => t.re.test(s));
  if (!hit) return null;
  const type = hit.type;
  const reasons: string[] = [];
  let attrsLength: string | undefined;
  let attrsDn: string | undefined;
  let attrsCap: number | undefined;

  const { clean, code, maxBar, orifice } = cleanForThreads(s);
  // tekst po słowie kluczowym typu (żeby nie łapać liczb z marki na początku)
  const afterType = clean.replace(
    /^.*?(NYP(?:EL|LE)|TR[ÓO]JNIK|KOLAN(?:KO|KA|O)|REDUKCJ\S*|DYSZA|SZYBKOZ\S*|ADAPTER|ZAW[ÓO]R|O-?RING|USZCZELK\S*|ZAŚLEPKA|ZASLEPKA|KOREK|MANOMETR|GNIAZDO|NAPRAWCZY|LANC[AEY]|PISTOLET|WĄŻ|WAZ|WĘŻYK|WEZYK|FILTRY?|SITKO|SITO|PIANOWNICA|ZBIORNIK)/,
    ' ',
  );
  const GENERIC = ['lanca', 'pistolet', 'waz', 'filtr', 'sitko', 'pianownica', 'zbiornik', 'naprawczy'];
  let genericText = afterType;
  if (GENERIC.includes(type)) {
    const lm = /(?<![\d/])(\d+(?:[.,]\d+)?)\s?(M|MB|MTR|CM)(?![A-ZĄĆĘŁŃÓŚŹŻ0-9])/.exec(afterType);
    if (lm) {
      attrsLength = lm[1].replace('.', ',') + (lm[2] === 'CM' ? ' cm' : ' m');
      genericText = genericText.replace(lm[0], ' ');
    }
    const dnm = /\bDN\s?(\d+)\b/.exec(s) ?? /\bFI\s?(\d+)\b/.exec(s);
    if (dnm) attrsDn = /\bDN/.test(dnm[0]) ? 'DN' + dnm[1] : 'Ø' + dnm[1];
    const cap = /(?<![\d/])(\d+(?:[.,]\d+)?)\s?L(?![A-ZĄĆĘŁŃÓŚŹŻ0-9])/.exec(afterType);
    if (cap) {
      attrsCap = Number(cap[1].replace(',', '.'));
      genericText = genericText.replace(cap[0], ' ');
    }
    genericText = genericText.replace(/\b(?:DN|FI)\s?\d+\b/g, ' ');
    if (type === 'lanca' && !attrsLength) {
      const rg = /(\d{2,4})\s?-\s?(\d{2,4})\s?CM/.exec(s);
      const mm = /(?<![\d/])(\d{3,4})\s?MM/.exec(s);
      if (rg) attrsLength = rg[1] + '–' + rg[2] + ' cm';
      else if (mm) attrsLength = mm[1] + ' mm';
    }
    if (type === 'waz') {
      // wymiary węża: „6 x 1”, „8 x 2” oraz „8/330 bar”
      const hx = /(?<![\d/])(\d{1,2})\s?X\s?(\d{1,2})(?![\d/,.])/.exec(genericText);
      if (hx) {
        attrsDn = attrsDn ?? hx[1] + '×' + hx[2];
        genericText = genericText.replace(hx[0], ' ');
      }
      const hb = /(?<![\d/])(\d{1,2})\/(\d{3})\s?BAR/.exec(s);
      if (hb) attrsDn = attrsDn ?? 'Ø' + hb[1];
      genericText = genericText.replace(/(?<![\d/])\d{1,2}\/(?![\d/])/g, ' ');
    }
  }
  let ends = type === 'oring' ? [] : parseThreads(genericText.replace(/\bD\.?\s?\d{2}\b/g, ' '));
  // dla elementów „ogólnych” liczby typu 800, 925, 365 to długości lub modele, nie gwinty
  if (GENERIC.includes(type)) ends = ends.filter((e) => e.valid);

  const material = detectMaterial(s);

  const attrs: TechAttrs = { ends, material };
  if (attrsLength) attrs.length = attrsLength;
  if (attrsDn) attrs.dn = attrsDn;
  if (attrsCap) attrs.capacityL = attrsCap;
  const sys = SYSTEMS.find(([re]) => re.test(s));
  if (sys) attrs.system = sys[1];
  if (/M[ĘE]SK/.test(s)) attrs.gender = 'M';
  else if (/DAMSK|[ŻZ]E[ŃN]SK/.test(s)) attrs.gender = 'Ż';
  if (attrs.gender && ends.length === 1 && ends[0].gender == null) ends[0] = { ...ends[0], gender: attrs.gender };
  if (type === 'oring') {
    const dm = /(\d+(?:[.,]\d+)?)\s?X\s?(\d+(?:[.,]\d+)?)/.exec(s);
    if (dm) attrs.dims = `${dm[1].replace('.', ',')} × ${dm[2].replace('.', ',')}`;
    else {
      const single = /(\d+(?:[.,]\d+)?)\s?MM/.exec(s);
      if (single) attrs.dims = single[1].replace('.', ',');
    }
  }
  if (type === 'manometr') {
    const dm = /\bD\.?\s?(\d{2})\b/.exec(s) ?? /ŚREDNICA\s?(\d{2})\s?MM/.exec(s);
    if (dm) attrs.diameterMm = Number(dm[1]);
  }
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
    case 'szybkozlacze':
      subtype = /WODN/.test(s) ? 'wodne' : /LANC/.test(s) ? 'do-lancy' : /NA W[ĄA]Ż?/.test(s) ? 'na-waz' : 'zwykle';
      break;
    case 'adapter':
      subtype = /K-?LOCK/.test(s) ? 'klock' : /SSAWK/.test(s) ? 'ssawki' : 'zwykly';
      break;
    case 'zawor':
      subtype = /ZWROTN/.test(s)
        ? 'zwrotny'
        : /KULOW|\bKUL\./.test(s)
          ? 'kulowy'
          : /SS[ĄA]C/.test(s)
            ? 'ssacy'
            : /BY ?-?PAS/.test(s)
              ? 'bypass'
              : /BEZPIECZE[ŃN]STW/.test(s)
                ? 'bezpieczenstwa'
                : /CI[ŚS]NIENI/.test(s)
                  ? 'cisnieniowy'
                  : /P[ŁL]YWAK/.test(s)
                    ? 'plywakowy'
                    : /DOZ(UJ|OWNIK)/.test(s)
                      ? 'dozujacy'
                      : /REGULACJI/.test(s)
                        ? 'regulacyjny'
                        : 'inny';
      break;
    case 'oring':
      subtype = /^(?:\S+\s+)?USZCZELK/.test(s) ? 'uszczelka' : 'oring';
      break;
    case 'zaslepka':
      subtype = /KOREK/.test(s) ? 'korek' : 'zaslepka';
      break;
    case 'manometr':
      subtype = 'zwykly';
      break;
    case 'gniazdo':
      subtype = 'zwykle';
      break;
    case 'lanca':
      subtype = /PIAN/.test(s) ? 'pianowa' : 'zwykla';
      break;
    case 'pistolet':
      subtype = /SUSZ|PRZEDMUCH/.test(s) ? 'suszacy' : /PIAN/.test(s) ? 'pianowy' : 'myjki';
      break;
    case 'waz':
      subtype = /ZBROJ/.test(s)
        ? 'zbrojony'
        : /KANALIZ/.test(s)
          ? 'kanalizacyjny'
          : /OGROD/.test(s)
            ? 'ogrodowy'
            : /ODKURZ/.test(s)
              ? 'odkurzacza'
              : /CHEMII/.test(s)
                ? 'chemii'
                : /B[ĘE]BN|ZWIJAK/.test(s)
                  ? 'bebna'
                  : /WYSOKOCI|\bHD\b|DN ?\d|CI[ŚS]NIEN|MYJNI|MYJK|TERMOPLAST|HDS/.test(s)
                    ? 'wysokocisnieniowy'
                    : 'inny';
      break;
    case 'filtr':
      subtype = /WODY/.test(s) ? 'wody' : /CHEMII/.test(s) ? 'chemii' : /ODKURZ/.test(s) ? 'odkurzacza' : /POWIETRZ|PY[ŁL]OW/.test(s) ? 'powietrza' : 'inny';
      break;
    case 'sitko':
      subtype = 'zwykle';
      break;
    case 'pianownica':
      subtype = 'zwykla';
      break;
    case 'zbiornik':
      subtype = 'zwykly';
      break;
    case 'naprawczy':
      subtype = 'zwykly';
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

  if (type === 'adapter' && subtype === 'ssawki' && ends.length === 0) {
    // ssawki odkurzacza: „45w - 32z” = średnice w mm, w = wewnętrzna, z = zewnętrzna
    const found: Thread[] = [];
    for (const mm of s.matchAll(/(?<![\d/])(\d{2})\s?([WZ])(?![A-ZĄĆĘŁŃÓŚŹŻ0-9])/g)) {
      found.push({ size: `Ø${mm[1]}`, gender: mm[2] === 'W' ? 'Ż' : 'M', valid: true });
    }
    if (found.length) attrs.ends = ends = found;
  }
  if (type === 'szybkozlacze' && attrs.gender && ends.some((e) => e.gender && e.gender !== attrs.gender)) {
    reasons.push('Płeć w nazwie („męskie/damskie”) nie zgadza się z oznaczeniem gwintu — sprawdź');
  }

  // oczekiwana liczba końcówek

  let expected = TECH_TYPES.find((t) => t.id === type)!.ends;
  if (subtype === 'bayonet' || (ends.length === 1 && /ZAKUCI|WĘŻ|WEZ|WTYK/.test(s))) expected = 1;
  if (type === 'trojnik' && ends.length === 1) {
    attrs.ends = ends = [ends[0], ends[0], ends[0]];
    reasons.push('Jedna końcówka w nazwie — przyjęto, że wszystkie trzy są takie same');
  }
  if (type === 'zawor' && subtype === 'inny') reasons.push('Nie rozpoznano rodzaju zaworu');
  if (GENERIC.includes(type) && !attrs.system && !attrs.length && !attrs.dn && !attrs.capacityL && !attrs.material && ends.length === 0)
    reasons.push('Brak rozpoznanych parametrów w nazwie');
  if ((type === 'waz' && subtype === 'inny') || (type === 'filtr' && subtype === 'inny'))
    reasons.push(type === 'waz' ? 'Nie rozpoznano rodzaju węża' : 'Nie rozpoznano rodzaju filtra');

  if (type === 'oring' && !attrs.dims) reasons.push('Brak wymiarów (średnica × grubość)');
  if (type === 'manometr' && !attrs.diameterMm) reasons.push('Brak średnicy tarczy');
  if (type !== 'dysza' && expected > 0 && ends.length !== expected) {
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
  if (type === 'szybkozlacze') ['złączka szybka', 'szybkozłączka'].forEach((x) => aliases.add(x));
  if (type === 'oring') ['uszczelka', 'o-ring', 'oring'].forEach((x) => aliases.add(x));
  if (type === 'zaslepka') ['korek', 'zaślepka'].forEach((x) => aliases.add(x));
  if (attrs.system) aliases.add(attrs.system.toLowerCase());
  if (attrs.dims) aliases.add(attrs.dims.replace(/ × /g, 'x'));
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
  if (attrs.system) aliases.add(attrs.system.toLowerCase());
  if (attrs.dims) aliases.add(attrs.dims.replace(/ × /g, 'x'));
  void type;

  return [...aliases];
}
