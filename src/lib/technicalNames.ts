import { fold } from './partsText';

/**
 * Standard nazw dla produktów technicznych o wielu wersjach (nyple, lance, dysze, węże, redukcje…).
 * Nazwa jest rozbijana na pola i składana zawsze w tym samym szyku:
 *
 *   Rodzaj [cecha] [materiał] [do czego] [model] [przyłącza A × B] [wymiary] [kolor] - kod
 *
 *   NYPEL MOSIĄDZ GZ3/8 - GW1/4          →  Nypel mosiężny GZ 3/8 × GW 1/4
 *   LANCA DO OPRYSKU STAL 60cm            →  Lanca stalowa do opryskiwania 600mm
 *   ZŁĄCZE OBROT.90 Ż3/8 - M3/8 mosiądz   →  Złącze obrotowe mosiężne GW 3/8 × GZ 3/8 - 90
 *
 * Moduł niczego nie zapisuje: zwraca propozycję i ocenę pewności.
 */
export const CONNECTOR = ' × ';
export const TECH_NAME_MAX = 60;

type Gender = 'm' | 'f' | 'n';

const HEADS: { re: RegExp; name: string; g: Gender }[] = [
  { re: /^nyp(el|le|la)$/, name: 'Nypel', g: 'm' },
  { re: /^lanc(a|e|y|i)$/, name: 'Lanca', g: 'f' },
  { re: /^dysz(a|e|y)$/, name: 'Dysza', g: 'f' },
  { re: /^waz(e|y)?$/, name: 'Wąż', g: 'm' },
  { re: /^zlacz(e|a)$/, name: 'Złącze', g: 'n' },
  { re: /^zlaczk(a|i)$/, name: 'Złączka', g: 'f' },
  { re: /^redukcj(a|e|i)$/, name: 'Redukcja', g: 'f' },
  { re: /^adapter(y)?$/, name: 'Adapter', g: 'm' },
  { re: /^pistolet(y)?$/, name: 'Pistolet', g: 'm' },
  { re: /^trojnik(i)?$/, name: 'Trójnik', g: 'm' },
  { re: /^kolank(o|a)$/, name: 'Kolanko', g: 'n' },
  { re: /^zawor(y)?$/, name: 'Zawór', g: 'm' },
  { re: /^koncowk(a|i)$/, name: 'Końcówka', g: 'f' },
  { re: /^szybkozlaczk(a|i)$/, name: 'Szybkozłączka', g: 'f' },
  { re: /^mufa$/, name: 'Mufa', g: 'f' },
  { re: /^obrotowk(a|i)$/, name: 'Obrotówka', g: 'f' },
  { re: /^nakretk(a|i)$/, name: 'Nakrętka', g: 'f' },
  { re: /^sitk(o|a)$/, name: 'Sitko', g: 'n' },
  { re: /^rekojesc$/, name: 'Rękojeść', g: 'f' },
  { re: /^uchwyt(y)?$/, name: 'Uchwyt', g: 'm' },
  { re: /^filtr(y)?$/, name: 'Filtr', g: 'm' },
];

/** Przymiotniki w trzech rodzajach: [m, f, n]. */
const ADJ: Record<string, [string, string, string]> = {
  obrotowy: ['obrotowy', 'obrotowa', 'obrotowe'],
  prosty: ['prosty', 'prosta', 'proste'],
  giety: ['gięty', 'gięta', 'gięte'],
  krotki: ['krótki', 'krótka', 'krótkie'],
  dlugi: ['długi', 'długa', 'długie'],
  katowy: ['kątowy', 'kątowa', 'kątowe'],
  teleskopowy: ['teleskopowy', 'teleskopowa', 'teleskopowe'],
  rotacyjny: ['rotacyjny', 'rotacyjna', 'rotacyjne'],
  cisnieniowy: ['ciśnieniowy', 'ciśnieniowa', 'ciśnieniowe'],
  mosiadz: ['mosiężny', 'mosiężna', 'mosiężne'],
  stal: ['stalowy', 'stalowa', 'stalowe'],
  inox: ['inox', 'inox', 'inox'],
  plastik: ['plastikowy', 'plastikowa', 'plastikowe'],
  guma: ['gumowy', 'gumowa', 'gumowe'],
  aluminium: ['aluminiowy', 'aluminiowa', 'aluminiowe'],
  ceramika: ['ceramiczny', 'ceramiczna', 'ceramiczne'],
  chrom: ['chromowany', 'chromowana', 'chromowane'],
  czarny: ['czarny', 'czarna', 'czarne'],
  czerwony: ['czerwony', 'czerwona', 'czerwone'],
  niebieski: ['niebieski', 'niebieska', 'niebieskie'],
  zielony: ['zielony', 'zielona', 'zielone'],
  szary: ['szary', 'szara', 'szare'],
  bialy: ['biały', 'biała', 'białe'],
  zolty: ['żółty', 'żółta', 'żółte'],
  pomaranczowy: ['pomarańczowy', 'pomarańczowa', 'pomarańczowe'],
  srebrny: ['srebrny', 'srebrna', 'srebrne'],
};
const GI = { m: 0, f: 1, n: 2 } as const;
const adj = (key: string, g: Gender) => ADJ[key]?.[GI[g]] ?? key;

/** Wyrażenie z obsługą polskich liter: <b> = początek słowa, <w> = reszta słowa. */
const rx = (src: string) => new RegExp(src.replace(/<b>/g, String.raw`(?<![\p{L}\d])`).replace(/<w>/g, String.raw`[\p{L}]*`), 'giu');

const FEATURES: { key: string; re: RegExp }[] = [
  { key: 'obrotowy', re: rx(String.raw`<b>(obrotow<w>|obrot\.?(?![\p{L}])|obr\.(?![\p{L}])|z obrotem)`) },
  { key: 'prosty', re: rx('<b>prost<w>') },
  { key: 'giety', re: rx('<b>(gi[eę]t<w>|wygi[eę]t<w>)') },
  { key: 'krotki', re: rx('<b>kr[oó]tk<w>') },
  { key: 'dlugi', re: rx('<b>d[lł]ug<w>') },
  { key: 'katowy', re: rx('<b>k[aą]tow<w>') },
  { key: 'teleskopowy', re: rx('<b>teleskop<w>') },
  { key: 'rotacyjny', re: rx('<b>rotacyjn<w>') },
  { key: 'cisnieniowy', re: rx(String.raw`<b>ci[sś]nien<w>\.?`) },
];

const MATERIALS: { key: string; re: RegExp }[] = [
  { key: 'inox', re: rx(String.raw`<b>(stal\s+nier(dzewn<w>)?\.?|nierdzewn<w>|inox)`) },
  { key: 'mosiadz', re: rx('<b>(mosi[aą]dz<w>|mosi[eę][zż]n<w>)') },
  { key: 'stal', re: rx('<b>stal<w>') },
  { key: 'plastik', re: rx('<b>plastik<w>') },
  { key: 'guma', re: rx(String.raw`<b>(gumow<w>|guma(?![\p{L}]))`) },
  { key: 'aluminium', re: rx('<b>alumin<w>') },
  { key: 'ceramika', re: rx('<b>(ceramik<w>|ceramiczn<w>)') },
];

const COLOURS: { key: string; re: RegExp }[] = [
  { key: 'czarny', re: rx('<b>czarn<w>') },
  { key: 'czerwony', re: rx('<b>czerwon<w>') },
  { key: 'niebieski', re: rx('<b>niebiesk<w>') },
  { key: 'zielony', re: rx('<b>zielon<w>') },
  { key: 'szary', re: rx('<b>szar<w>') },
  { key: 'bialy', re: rx('<b>bia[lł]<w>') },
  { key: 'zolty', re: rx('<b>[zż][oó][lł]t<w>') },
  { key: 'pomaranczowy', re: rx('<b>pomara[nń]czow<w>') },
  { key: 'srebrny', re: rx('<b>srebrn<w>') },
  { key: 'chrom', re: rx('<b>chrom<w>') },
];

const USES: { text: string; re: RegExp }[] = [
  { text: 'do pianowania', re: rx(String.raw`<b>(do\s+)?(pianowani<w>|pianow<w>)`) },
  { text: 'do opryskiwania', re: rx(String.raw`<b>(do\s+)?oprysk<w>`) },
  { text: 'do mycia podwozia', re: rx(String.raw`<b>(do\s+)?(mycia\s+)?podwozi<w>`) },
];

const FUNCTION_WORDS = new Set(['do', 'z', 'ze', 'na', 'dla', 'i', 'oraz', 'w', 'od', 'pod', 'przy']);

/** Przyłącza calowe, z których składa się 99% nazw: ułamki (1/8…) i rozmiary metryczne (M22). */
const INCH = new Set(['1/8', '1/4', '3/8', '1/2', '3/4', '5/8', '1', '1/16', '5/16']);

export interface TechName {
  name: string;
  /** Rodzina (rodzaj produktu), np. „Nypel”. */
  family: string;
  /** pewna — wszystko rozpoznane; do sprawdzenia — zostały słowa, których nie umiemy zaszeregować. */
  confidence: 'pewna' | 'do sprawdzenia';
  notes: string[];
  unknown: string[];
}

const cleanWord = (w: string) => {
  const letters = w.replace(/[^\p{L}]/gu, '');
  if (/\d/.test(w) || letters.length < 4 || !/[aeiouyąęó]/i.test(letters)) return w;
  return w === w.toUpperCase() ? w[0] + w.slice(1).toLowerCase() : w;
};

function headOf(text: string): { name: string; g: Gender; rest: string } | null {
  const tokens = text.split(/\s+/).filter(Boolean);
  const first = fold(tokens[0] ?? '').replace(/[^a-z]/g, '');
  const h = HEADS.find((x) => x.re.test(first));
  if (!h) return null;
  return { name: h.name, g: h.g, rest: tokens.slice(1).join(' ') };
}

/** Ujednolica zapis pojedynczego przyłącza: GZ = gwint zewnętrzny, GW = wewnętrzny; Ż/F = żeński, M = męski. */
function thread(type: string, size: string, metric: boolean): string {
  return `${type} ${metric ? 'M' : ''}${size}`;
}

/** Zwraca ujednoliconą nazwę albo null, gdy nazwa nie zaczyna się od znanego rodzaju produktu. */
export function standardizeTechnicalName(raw: string, brand: string | null = null): TechName | null {
  let s = raw.replace(/\s+/g, ' ').trim();
  let prefix = '';
  if (brand && fold(s).startsWith(fold(brand))) {
    prefix = brand;
    s = s.slice(brand.length).trim();
  }
  s = s.replace(/\bD\/(?=\p{L})/giu, 'do ').replace(/\s*[–—]\s*/g, ' - ');
  const head = headOf(s);
  if (!head) return null;
  const notes: string[] = [];
  let t = ` ${head.rest} `;
  const hole = (m: string) => ' '.repeat(m.length);

  // kody katalogowe wędrują na koniec
  const codes: string[] = [];
  t = t.replace(/(?<![\p{L}\d])(\d{9,}|KAT\d{4,}|[A-Z]{1,2}\s\d{3}\s\d{3}\s\d{3})(?![\p{L}\d])/giu, (m) => {
    codes.push(m.trim());
    return hole(m);
  });

  // wymiary
  const dims: string[] = [];
  t = t.replace(/(\d{2,4})\s?bar\b/gi, (m, n) => (dims.push(`${n}bar`), hole(m)));
  t = t.replace(/(\d+)\s?\/\s?(\d+)\s?mm\b/gi, (m, a, b) => (dims.push(`${a}/${b}mm`), hole(m)));
  // zakres zostaje w jednostce z oryginału („40-280cm”), pojedyncze cm przeliczamy na mm
  t = t.replace(/(?<![\d/.,])(\d+)\s?-\s?(\d+)\s?(mm|cm)(?![\p{L}\d])/giu, (m, a, b, u) => (dims.push(`${a}-${b}${String(u).toLowerCase()}`), hole(m)));
  t = t.replace(/(?<![\d/])(\d+(?:[.,]\d+)?)\s?(mm|cm|m)(?![\p{L}\d])/giu, (m, n, u) => {
    const unit = String(u).toLowerCase();
    if (unit === 'cm') dims.push(`${Math.round(parseFloat(String(n).replace(',', '.')) * 10)}mm`);
    else dims.push(`${String(n).replace('.', ',')}${unit}`);
    return hole(m);
  });
  // teleskop: „1080/1925” to zakres długości w mm
  if (head.name === 'Lanca') t = t.replace(/(?<![\d/.,])(\d{3,4})\/(\d{3,4})(?![\p{L}\d/])/gu, (m, a, b) => (dims.push(`${a}/${b}mm`), hole(m)));
  t = t.replace(/\b(dn)\s?(\d+(?:\/\d+)?)/gi, (m, _p, n) => (dims.push(`DN${n}`), hole(m)));
  t = t.replace(/\b(fi|ø)\s?(\d+(?:[.,]\d+)?)(\s?mm)?/gi, (m, _p, n) => (dims.push(`Ø${String(n).replace('.', ',')}mm`), hole(m)));
  t = t.replace(/(?<![\d/])(\d{1,2})\s?x\s?(\d)(?![\d/])/gi, (m, a, b) => (dims.push(`${a}x${b}`), hole(m)));

  // przyłącza w kolejności występowania
  const ends: { at: number; text: string }[] = [];
  const takeEnd = (re: RegExp, make: (m: RegExpMatchArray) => string | null) => {
    t = t.replace(re, (...args) => {
      const m = args.slice(0, -2) as unknown as RegExpMatchArray;
      const text = make(m);
      if (!text) return args[0];
      ends.push({ at: args[args.length - 2] as number, text });
      return hole(args[0]);
    });
  };
  // dwa gołe rozmiary calowe przez myślnik: „1 - 1/2” → 1" × 1/2"
  t = t.replace(/(?<![\p{L}\d/.,])(\d+(?:\/\d+)?)\s*-\s*(\d+\/\d+)(?![\p{L}\d/])/gu, (m, a, b, at) => (ends.push({ at: at as number, text: `${a}"${CONNECTOR}${b}"` }), hole(m)));
  takeEnd(/(?<![\p{L}\d])g([zw])\s?(m)?\s?(\d+(?:\/\d+)?)(?![\d/])/giu, (m) => {
    const type = `G${m[1].toUpperCase()}`;
    const size = m[3];
    const metric = !!m[2] || (!size.includes('/') && Number(size) >= 10);
    if (!m[2] && metric) notes.push(`${type}${size} przyjęto jako ${type} M${size}`);
    if (!metric && !INCH.has(size)) notes.push(`podejrzany rozmiar gwintu ${size}`);
    return thread(type, size, metric);
  });
  takeEnd(/(?<![\p{L}\d])m\s?(\d{2})\s?([fm])?(?![\p{L}\d/])/giu, (m) => {
    const sex = m[2]?.toLowerCase();
    return sex === 'f' ? thread('GW', m[1], true) : sex === 'm' ? thread('GZ', m[1], true) : `M${m[1]}`;
  });
  takeEnd(/(?<![\p{L}\d])(\d+\/\d+)\s?([żzmf])(?![\p{L}\d])/giu, (m) => thread(/[żzf]/i.test(m[2]) ? 'GW' : 'GZ', m[1], false));
  takeEnd(/(?<![\p{L}\d])([żm])\s?(\d+\/\d+)(?![\d/])/giu, (m) => thread(/ż/i.test(m[1]) ? 'GW' : 'GZ', m[2], false));
  // goły rozmiar bez typu gwintu (np. „GW3/8-1/4”) — zostaje, ale prosimy o sprawdzenie
  const typedEnds = ends.length;
  takeEnd(/(?<![\p{L}\d/.,])(\d{1,2}\/\d{1,2})(?![\p{L}\d/])/gu, (m) => {
    if (typedEnds) notes.push(`przyłącze ${m[1]} bez typu gwintu`);
    return `${m[1]}"`;
  });
  ends.sort((a, b) => a.at - b.at);

  // cechy, materiał, zastosowanie, kolor
  const features: string[] = [];
  for (const f of FEATURES) t = t.replace(f.re, (m) => (features.includes(f.key) || features.push(f.key), hole(m)));
  let material = '';
  for (const mt of MATERIALS) t = t.replace(mt.re, (m) => (material || (material = mt.key), hole(m)));
  const uses: string[] = [];
  for (const u of USES) t = t.replace(u.re, (m) => (uses.includes(u.text) || uses.push(u.text), hole(m)));
  const colours: string[] = [];
  for (const c of COLOURS) t = t.replace(c.re, (m) => (colours.includes(c.key) || colours.push(c.key), hole(m)));
  const nutRe = rx('(<b>z\\s+)?<b>nakr[eę]tk<w>');
  const withNut = nutRe.test(t);
  t = t.replace(nutRe, hole);

  // reszta: model i numery zostają w nazwie, zwykłe słowa opisu idą za myślnikiem
  const rawLeft = t.split(/\s+/).filter(Boolean);
  // bezwymiarowa liczba przy lancy to długość w mm (ostatnia taka liczba; „365+” to model)
  if (head.name === 'Lanca' && !dims.some((d) => d.endsWith('mm'))) {
    let i = -1;
    rawLeft.forEach((w, k) => /^\d{3,4}$/.test(w) && Number(w) >= 200 && Number(w) <= 2500 && (i = k));
    if (i >= 0) {
      dims.push(`${rawLeft[i]}mm`);
      notes.push(`długość ${rawLeft[i]} przyjęto jako ${rawLeft[i]}mm`);
      rawLeft.splice(i, 1);
    }
  }
  const model: string[] = [];
  const prose: string[] = [];
  let pending: string[] = [];
  for (const raw of rawLeft) {
    const w = raw.replace(/^[-–/,.+()]+|[-–/,.+()]+$/g, '');
    if (!w) continue;
    if (FUNCTION_WORDS.has(fold(w))) {
      pending.push(w.toLowerCase());
      continue;
    }
    const phrase = [...pending, cleanWord(w)].join(' ');
    pending = [];
    const plain = !/\d/.test(w) && w === w.toLowerCase() && w.length > 1;
    (plain ? prose : model).push(phrase);
  }
  if (pending.length) prose.push(pending.join(' '));
  const unknownWords = [...model, ...prose].map((p) => p.split(' ').pop() ?? '').filter((w) => !/\d/.test(w) && w.replace(/[^\p{L}]/gu, '').length >= 4);

  // wymiary w stałej kolejności: przekrój, średnica, ciśnienie, długość
  const dimRank = (d: string) => (/^\d+x\d+$/.test(d) ? 0 : /^(Ø|DN)/.test(d) ? 1 : /bar$/.test(d) ? 2 : 3);
  dims.sort((a, b) => dimRank(a) - dimRank(b));
  const parts = [
    head.name,
    ...features.map((f) => adj(f, head.g)),
    ...(material ? [adj(material, head.g)] : []),
    ...uses,
    ...model,
    ...(ends.length ? [ends.map((e) => e.text).join(CONNECTOR)] : []),
    ...(withNut ? ['z nakrętką'] : []),
    ...dims,
    ...colours.map((c) => adj(c, head.g)),
  ];
  let name = [prefix, ...parts].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  const tail = [prose.join(' '), codes.join(' ')].filter(Boolean).join(' ');
  if (tail) name += ` - ${tail}`;
  if (name.length > TECH_NAME_MAX) notes.push(`${name.length} znaków (limit ${TECH_NAME_MAX})`);
  const risky = unknownWords.length > 3 || notes.some((n) => n.startsWith('podejrzany'));
  return { name, family: head.name, confidence: risky ? 'do sprawdzenia' : 'pewna', notes, unknown: unknownWords };
}

/** Klucz porównawczy do wykrywania dubli po ujednoliceniu (bez kolejności końców przyłącza). */
export function nameDuplicateKey(name: string): string {
  const [main, code] = name.split(' - ');
  const sorted = main.replace(/((?:G[ZW] M?[\d/]+|M\d+)(?: × (?:G[ZW] M?[\d/]+|M\d+))+)/g, (m) => m.split(CONNECTOR).sort().join(CONNECTOR));
  return fold(`${sorted}${code ? ` - ${code}` : ''}`).replace(/\s+/g, ' ');
}
