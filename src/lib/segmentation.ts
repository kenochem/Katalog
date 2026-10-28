import type { Product } from '../types';
import { findCapacities } from './nameStandard';
import type { AttrValue, AttributeDef } from './attributes';

/**
 * Segregacja produktów atrybutami: „Typ towaru”, „Grupa części” oraz konkretne właściwości odczytywane z nazwy
 * (pojemność, kąt i rozmiar dyszy, gwint, materiał, ciśnienie, długość, kompatybilność).
 * Wszystko to PROPOZYCJE do zatwierdzenia — nic nie zapisuje się samo.
 */

// ---------------------------------------------------------------------------------------------
// Słowniki wartości
// ---------------------------------------------------------------------------------------------

export const TYPE_CHEM = 'Chemia do mycia i pielęgnacji';
export const TYPE_PART = 'Część do myjek ciśnieniowych';
export const TYPE_FOAM = 'Pianownica / opryskiwacz';
export const TYPE_CLEAN = 'Sprzątanie: narzędzia i akcesoria';
export const TYPE_SCENT = 'Zapachy i odświeżacze';
export const TYPE_HYGIENE = 'Dozowniki i higiena';
export const TYPE_MACHINE = 'Sprzęt i maszyny';
export const TYPE_SERVICE = 'Usługa';
export const TYPE_OTHER = 'Inne';

export const PRODUCT_TYPES = [TYPE_CHEM, TYPE_PART, TYPE_FOAM, TYPE_CLEAN, TYPE_SCENT, TYPE_HYGIENE, TYPE_MACHINE, TYPE_SERVICE, TYPE_OTHER];

export const PART_GROUPS = [
  'Dysze',
  'Lance i pistolety',
  'Węże i bębny',
  'Szybkozłącza i złączki',
  'Nyple, trójniki i kolanka',
  'Zawory i regulatory',
  'Pompy i silniki',
  'Uszczelnienia i o-ringi',
  'Filtry',
  'Manometry i osprzęt pomiarowy',
  'Obudowy i elementy',
  'Inne części',
];

export const MATERIALS = ['Mosiądz', 'Stal nierdzewna', 'Stal', 'Aluminium', 'Tworzywo', 'Guma', 'Ceramika', 'Mikrofibra', 'Bawełna', 'Drewno'];
export const FORMS = ['Płyn', 'Żel', 'Pasta', 'Piana / pianka', 'Spray', 'Proszek / tabletki', 'Wosk', 'Koncentrat'];
export const PURPOSES = [
  'Myjnia bezdotykowa / samoobsługowa',
  'Detailing i auto',
  'Sprzątanie profesjonalne',
  'Gastronomia i HoReCa',
  'Przemysł i warsztat',
  'Dom i ogród',
];

const ONLY_PARTS = [TYPE_PART, TYPE_FOAM];

/** Zestaw atrybutów segregujących (instalowany jednym kliknięciem; istniejących nie nadpisuje). */
export const SEGMENT_ATTRIBUTES: AttributeDef[] = [
  { key: 'typ_towaru', label: 'Typ towaru', type: 'select', unit: '', options: PRODUCT_TYPES, categories: [], required: true, sort: 10 },
  { key: 'grupa_czesci', label: 'Grupa części', type: 'select', unit: '', options: PART_GROUPS, categories: [], required: false, sort: 20, showWhen: { key: 'typ_towaru', values: ONLY_PARTS } },
  { key: 'kat_rozpylania', label: 'Kąt rozpylania', type: 'number', unit: '°', options: [], categories: [], required: false, sort: 30, showWhen: { key: 'grupa_czesci', values: ['Dysze'] } },
  { key: 'rozmiar_dyszy', label: 'Rozmiar dyszy', type: 'text', unit: '', options: [], categories: [], required: false, sort: 31, showWhen: { key: 'grupa_czesci', values: ['Dysze'] } },
  { key: 'gwint', label: 'Gwint / przyłącze', type: 'text', unit: '', options: [], categories: [], required: false, sort: 32, showWhen: { key: 'typ_towaru', values: ONLY_PARTS } },
  { key: 'material', label: 'Materiał', type: 'select', unit: '', options: MATERIALS, categories: [], required: false, sort: 33, showWhen: { key: 'typ_towaru', values: [...ONLY_PARTS, TYPE_CLEAN] } },
  { key: 'cisnienie_max_bar', label: 'Ciśnienie maksymalne', type: 'number', unit: 'bar', options: [], categories: [], required: false, sort: 34, showWhen: { key: 'typ_towaru', values: ONLY_PARTS } },
  { key: 'dlugosc_m', label: 'Długość', type: 'number', unit: 'm', options: [], categories: [], required: false, sort: 35, showWhen: { key: 'grupa_czesci', values: ['Węże i bębny'] } },
  { key: 'pasuje_do', label: 'Pasuje do (marki myjek)', type: 'text', unit: '', options: [], categories: [], required: false, sort: 36, showWhen: { key: 'typ_towaru', values: ONLY_PARTS } },
  { key: 'pojemnosc_ml', label: 'Pojemność', type: 'number', unit: 'ml', options: [], categories: [], required: false, sort: 40, showWhen: { key: 'typ_towaru', values: [TYPE_CHEM, TYPE_SCENT, TYPE_HYGIENE, TYPE_FOAM] } },
  { key: 'masa_g', label: 'Masa / waga', type: 'number', unit: 'g', options: [], categories: [], required: false, sort: 41, showWhen: { key: 'typ_towaru', values: [TYPE_CHEM, TYPE_SCENT, TYPE_HYGIENE] } },
  { key: 'forma_produktu', label: 'Forma produktu', type: 'select', unit: '', options: FORMS, categories: [], required: false, sort: 42, showWhen: { key: 'typ_towaru', values: [TYPE_CHEM] } },
  { key: 'przeznaczenie', label: 'Przeznaczenie', type: 'select', unit: '', options: PURPOSES, categories: [], required: false, sort: 50 },
];

// ---------------------------------------------------------------------------------------------
// Klasyfikacja po nazwie (wygrywa słowo kluczowe występujące najwcześniej — rzeczownik główny)
// ---------------------------------------------------------------------------------------------

const fold = (s: string) =>
  (s || '')
    .toLowerCase()
    .replace(/ł/g, 'l')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

interface Rule {
  type: string;
  group?: string;
  re: RegExp;
  /** Ogólne słowa (uchwyt, koło…): liczą się tylko dla producentów/nazw ze świata części do myjek. */
  weak?: boolean;
}

const RULES: Rule[] = [
  { type: TYPE_SERVICE, re: /\b(usluga|naprawa|dojazd|transport|kurier|serwis)\b/ },
  { type: TYPE_PART, group: 'Dysze', re: /\bdysz|\bdyza\b/ },
  { type: TYPE_PART, group: 'Lance i pistolety', re: /\blanc[ay]?\b|\blancy\b|\bpistolet/ },
  { type: TYPE_PART, group: 'Węże i bębny', re: /\bwaz\b|\bwaz[a-z]*\b|\bwez|\bbeben|\bbebny|\bzakucie/ },
  { type: TYPE_PART, group: 'Szybkozłącza i złączki', re: /szybkoz|\bzlacz|\bmufa|\bbayonet|\bkoncowk|\badapter|\bgniazd|\bwtyk|\bsprzeg|\bprzylacz/ },
  { type: TYPE_PART, group: 'Nyple, trójniki i kolanka', re: /\bnypel|\btrojnik|\bkolank|\bredukc|\bzaslepk|\bkrociec|\bnakretk|\bprzelotk|\bsiatk|\bkapturek|\bkorek\b/ },
  { type: TYPE_PART, group: 'Zawory i regulatory', re: /\bzawor|\bregulator|\bby ?pass|\bkran\b|\bzaworek/ },
  { type: TYPE_PART, group: 'Pompy i silniki', re: /\bpomp|\bsilnik|\bwirnik|\btloczek|\bglowic|\btlok\b/ },
  { type: TYPE_PART, group: 'Uszczelnienia i o-ringi', re: /\buszczelk|\buszczelnien|\bo-?ring|\boring|\bmanszet|\bpierscien|\bsimmering/ },
  { type: TYPE_PART, group: 'Filtry', re: /\bfiltr|\bsitko/ },
  { type: TYPE_PART, group: 'Manometry i osprzęt pomiarowy', re: /\bmanometr|\bwskaznik|\bczujnik|\bprzepustnic/ },
  { type: TYPE_PART, group: 'Obudowy i elementy', weak: true, re: /\bobudow|\bpokryw|\bkolko|\bkola\b|\bkolo\b|\buchwyt|\bdzwignia|\brekojesc|\bsprezyn|\bsruba|\bwkret|\bsworzen|\btulej|\bpodkladk|\bklips|\bzatrzask|\bklamr|\bwspornik|\bramka|\bpodstaw|\bzasilacz|\bkabel|\bwlacznik|\bprzelacznik/ },
  { type: TYPE_FOAM, re: /\bpianownic|\bopryskiw|\bzbiornik natrysku|\bspryskiw|\brozpylacz|\batomizer|\bzraszacz|\bpiankowni/ },
  { type: TYPE_MACHINE, re: /\bmyjka\b(?!\s+sciagaczk)|\bodkurzacz\b|\bkompresor|\bagregat|\bmaszyna|\bszorowark|\bpolerk|\bpodnosnik|\bparownic/ },
  { type: TYPE_CLEAN, re: /\bmop\b|\bmopa\b|\bmopy\b|\bszczotk|\bmiotl|\bzgarniacz|\bscierk|\bmikrofib|\bgabk|\brekaw|\bwiadr|\bkosz\b|\bszufel|\bczyscio|\braczk|\bsciagacz|\bteleskop|\baplikator|\bpad\b|\bstelaz|\bzmiotk|\bwozek|\bpedzel/ },
  { type: TYPE_HYGIENE, re: /\bdozownik|\brecznik|\bpapier|\bpodajnik|\bworek|\bworki|\btorebk|\bfolia\b/ },
  { type: TYPE_SCENT, re: /\bzapach|\bolejek|\bpatyczk|\bperfum|\bodswiezacz|\bdyfuzor|\bswiec|\bzawieszk|\bneutralizator|\bpisuar|\bkostka toaletow/ },
  {
    type: TYPE_CHEM,
    re: /\bplyn|\bpreparat|\bszampon|\bpiana\b|\bpianka|\bwosk|\bpasta\b|\bzel\b|\bspray|\bkoncentrat|\bodtluszcz|\bcleaner|\baktywna|\bdezynfek|\bmleczko|\bdressing|\bimpregnat|\bodkamien|\bmydlo|\bkrem\b|\bproszek|\bdetergent|\bapc\b|\bpre ?wash|\bfelg|\bantypara|\bodmrazacz|\bnablyszcz|\bwybielacz|\bodplamiacz|\bsmar\b|\bolej\b|\bzmywacz|\brozpuszczalnik|\bkwas|\blug\b|\btabletk|\bglikol|\bczernid|\bpolish|\bpolerski|\bpolerska/,
  },
];

export interface TypeProposal {
  type: string;
  group?: string;
  /** Słowo, które zdecydowało o klasyfikacji (do pokazania w podglądzie). */
  matched: string;
  /** high: słowo na początku nazwy; low: dopasowanie dalej w nazwie albo tylko po pojemności. */
  confidence: 'high' | 'low';
}

const PART_WORLD = /myjk|karcher|\bk\d{1,3}\b|lavor|comet|nilfisk|interpump|\bhd\b|\bhds\b|\bcat\b|pompa|kranzle|wysokocisn/;
const PART_MAKERS = new Set(['hydroflex', 'akcesoria do myjni', 'wapro', 'interpump', 'comet', 'karcher']);

export function classifyProduct(p: Pick<Product, 'displayName' | 'name' | 'category'> & { manufacturer?: string }): TypeProposal {
  const text = fold(p.displayName || p.name || '');
  const partWorld = PART_WORLD.test(text) || PART_MAKERS.has(fold(p.manufacturer || '').trim());
  let best: { rule: Rule; index: number; word: string } | null = null;
  const matchedTypes = new Set<string>();
  for (const rule of RULES) {
    const m = rule.re.exec(text);
    if (!m) continue;
    if (rule.weak && !partWorld) continue;
    matchedTypes.add(rule.type);
    if (!best || m.index < best.index) best = { rule, index: m.index, word: m[0].replace(/\W+/g, '').trim() || m[0] };
  }
  if (!best) {
    // bez słowa kluczowego: pojemność/waga w nazwie wskazuje na chemię, reszta do ręcznej klasyfikacji
    if (findCapacities(p.displayName || '').length > 0) return { type: TYPE_CHEM, matched: 'pojemność w nazwie', confidence: 'low' };
    return { type: TYPE_OTHER, matched: '', confidence: 'low' };
  }
  // słowo kluczowe w pierwszych ~3 wyrazach = pewne; dalej w nazwie = do sprawdzenia
  const wordsBefore = text.slice(0, best.index).trim().split(/\s+/).filter(Boolean).length;
  // pewne: słowo na początku nazwy albo żaden inny typ nie pasuje; do sprawdzenia: konkurujące typy i słowo dalej w nazwie
  return { type: best.rule.type, group: best.rule.group, matched: best.word, confidence: wordsBefore <= 2 || matchedTypes.size === 1 ? 'high' : 'low' };
}

// ---------------------------------------------------------------------------------------------
// Właściwości z nazwy
// ---------------------------------------------------------------------------------------------

const MATERIAL_RULES: [string, RegExp][] = [
  ['Stal nierdzewna', /\binox\b|nierdzewn/],
  ['Mosiądz', /\bmosiadz|\bmosiez/],
  ['Aluminium', /\balumin/],
  ['Ceramika', /\bceramik|\bceramicz/],
  ['Guma', /\bgum[aoy]|\bgumow/],
  ['Mikrofibra', /\bmikrofib/],
  ['Bawełna', /\bbawel/],
  ['Drewno', /\bdrewn/],
  ['Tworzywo', /\bplastik|\btworzyw|\bpvc\b|\bpp\b|\bnylon/],
  ['Stal', /\bstal\b|\bstalow/],
];

const COMPAT_BRANDS: [string, RegExp][] = [
  ['Karcher', /\bk[aä]rcher\b|\bkarcher\b/],
  ['Lavor', /\blavor\b/],
  ['Comet', /\bcomet\b/],
  ['Nilfisk', /\bnilfisk\b/],
  ['Parkside', /\bparkside\b/],
  ['Kranzle', /\bkr[aä]nzle\b|\bkranzle\b/],
  ['Bosch', /\bbosch\b/],
  ['Makita', /\bmakita\b/],
  ['Stihl', /\bstihl\b/],
  ['Interpump', /\binterpump\b/],
];

function amountOf(capText: string): { ml?: number; g?: number } {
  const m = capText.match(/^(\d+(?:[.,]\d+)?)(ml|L|kg|g)$/);
  if (!m) return {};
  const n = Number(m[1].replace(',', '.'));
  if (!Number.isFinite(n)) return {};
  switch (m[2]) {
    case 'ml':
      return { ml: n };
    case 'L':
      return { ml: n * 1000 };
    case 'kg':
      return { g: n * 1000 };
    default:
      return { g: n };
  }
}

function formOf(text: string): string | undefined {
  if (/\bkoncentrat/.test(text)) return 'Koncentrat';
  if (/\bzel\b/.test(text)) return 'Żel';
  if (/\bpasta\b/.test(text)) return 'Pasta';
  if (/\bwosk/.test(text)) return 'Wosk';
  if (/\bpiana\b|\bpianka/.test(text)) return 'Piana / pianka';
  if (/\bspray|\batomizer/.test(text)) return 'Spray';
  if (/\bproszek|\btabletk/.test(text)) return 'Proszek / tabletki';
  if (/\bplyn|\bpreparat|\bszampon|\bmleczko|\bodtluszcz/.test(text)) return 'Płyn';
  return undefined;
}

/** Gwint/przyłącze z nazwy: GW1/4, GZ3/8, M22, 1/4F, DN32… */
export function threadsOf(name: string): string {
  const out: string[] = [];
  const add = (v: string) => {
    const t = v.replace(/\s+/g, '').toUpperCase();
    if (t && !out.includes(t)) out.push(t);
  };
  for (const m of name.matchAll(/\b(G[WZ]?)\s?(\d\/\d|\d{1,2})\b/gi)) add(`${m[1]}${m[2]}`);
  for (const m of name.matchAll(/\bM\s?(\d{2})(?:\s?x\s?\d(?:[.,]\d)?)?\b/gi)) add(`M${m[1]}`);
  for (const m of name.matchAll(/\b(\d\/\d)\s?([FM])\b/gi)) add(`${m[1]}${m[2]}`);
  for (const m of name.matchAll(/\bDN\s?(\d{2,3})\b/gi)) add(`DN${m[1]}`);
  return out.slice(0, 3).join(' / ');
}

export type SegmentProposal = Record<string, AttrValue>;

export interface ProductSegmentation {
  type: TypeProposal;
  /** Wszystkie proponowane wartości atrybutów (klucz atrybutu → wartość). */
  attrs: SegmentProposal;
}

/** Propozycje atrybutów dla jednego produktu (tylko te, które da się rzetelnie odczytać z nazwy). */
export function proposeSegmentation(p: Product): ProductSegmentation {
  const type = classifyProduct(p);
  const name = p.displayName || p.name || '';
  const text = fold(name);
  const attrs: SegmentProposal = { typ_towaru: type.type };
  const isPart = type.type === TYPE_PART || type.type === TYPE_FOAM;

  if (type.type === TYPE_PART && type.group) attrs.grupa_czesci = type.group;

  const caps = findCapacities(name);
  if (caps.length === 1 && [TYPE_CHEM, TYPE_SCENT, TYPE_FOAM].includes(type.type)) {
    const a = amountOf(caps[0].normalized);
    if (a.ml !== undefined) attrs.pojemnosc_ml = a.ml;
    if (a.g !== undefined && type.type !== TYPE_FOAM) attrs.masa_g = a.g;
  }
  if (type.type === TYPE_CHEM) {
    const form = formOf(text);
    if (form) attrs.forma_produktu = form;
  }

  if (isPart) {
    const thread = threadsOf(name);
    if (thread) attrs.gwint = thread;
    const bar = text.match(/\b(\d{2,4})\s?bar\b/);
    if (bar) attrs.cisnienie_max_bar = Number(bar[1]);
    const compat = COMPAT_BRANDS.filter(([, re]) => re.test(text)).map(([label]) => label);
    if (compat.length) attrs.pasuje_do = compat.join(', ');
  }
  if (isPart || type.type === TYPE_CLEAN) {
    for (const [label, re] of MATERIAL_RULES) {
      if (re.test(text)) {
        attrs.material = label;
        break;
      }
    }
  }

  if (type.group === 'Dysze') {
    // „25-040”: kąt rozpylania i rozmiar dyszy
    const nz = text.match(/\b(00|15|25|40|65)\s?-\s?(\d{3})\b/);
    if (nz) {
      attrs.kat_rozpylania = Number(nz[1]);
      attrs.rozmiar_dyszy = nz[2];
    }
  }
  if (type.group === 'Węże i bębny') {
    const len = text.match(/\b(\d{1,3}(?:[.,]\d)?)\s?m\b(?!m)/);
    if (len) attrs.dlugosc_m = Number(len[1].replace(',', '.'));
  }
  return { type, attrs };
}

/** Atrybuty z propozycji, które faktycznie coś zmieniają (pusty lub inny niż obecny). */
export function newAttrValues(current: Record<string, AttrValue>, proposed: SegmentProposal, overwrite: boolean): SegmentProposal {
  const out: SegmentProposal = {};
  for (const [k, v] of Object.entries(proposed)) {
    const have = current[k];
    const empty = have === undefined || have === null || have === '';
    if (empty || (overwrite && have !== v)) out[k] = v;
  }
  return out;
}
