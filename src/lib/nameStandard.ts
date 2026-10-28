import type { Product } from '../types';
import { manufacturerOptions } from './waproManufacturers';

/**
 * Standard nazw produktów w katalogu:
 *
 *   PRODUCENT Nazwa własna Pojemność - krótki opis
 *
 * Całość mieści się w 60 znakach (celujemy w ~50). Pojemność pomijamy tam, gdzie nie ma sensu (akcesoria,
 * części), a opis jest opcjonalny. Moduł wykrywa odstępstwa i proponuje poprawioną nazwę.
 */
export const NAME_MAX = 60;
export const NAME_IDEAL = 50;

export type NameIssueKind =
  | 'tooLong'
  | 'noBrand'
  | 'brandCase'
  | 'brandOther'
  | 'brandDup'
  | 'noCapacity'
  | 'capacityFormat'
  | 'capacityPlace'
  | 'separator'
  | 'spaces'
  | 'allCaps'
  | 'tooShort';

export interface NameIssueDef {
  label: string;
  hint: string;
  tone: 'danger' | 'warn' | 'info';
}

export const NAME_ISSUES: Record<NameIssueKind, NameIssueDef> = {
  tooLong: { label: 'Za długa', hint: `Powyżej ${NAME_MAX} znaków`, tone: 'danger' },
  noBrand: { label: 'Brak producenta na początku', hint: 'Nazwa powinna zaczynać się od producenta', tone: 'warn' },
  brandCase: { label: 'Zapis producenta', hint: 'Producent zapisany inaczej niż w pozostałych produktach marki', tone: 'info' },
  brandOther: { label: 'Inna marka w nazwie', hint: 'Nazwa zaczyna się od innej marki niż pole „producent”', tone: 'warn' },
  brandDup: { label: 'Powtórzony producent', hint: 'Marka występuje w nazwie dwa razy z rzędu', tone: 'info' },
  noCapacity: { label: 'Brak pojemności', hint: 'Dla chemii warto podać pojemność lub wagę', tone: 'info' },
  capacityFormat: { label: 'Zapis pojemności', hint: 'Pojemność w formacie 5L, 750ml, 20kg (bez spacji)', tone: 'info' },
  capacityPlace: { label: 'Pojemność nie na miejscu', hint: 'Pojemność powinna stać przed myślnikiem i opisem', tone: 'info' },
  separator: { label: 'Separator', hint: 'Opis oddzielamy znakiem „ - ” (spacja, myślnik, spacja)', tone: 'info' },
  spaces: { label: 'Spacje', hint: 'Zbędne lub podwójne spacje', tone: 'info' },
  allCaps: { label: 'Same wielkie litery', hint: 'Nazwa pisana wersalikami', tone: 'info' },
  tooShort: { label: 'Zbyt krótka', hint: 'Bardzo krótka nazwa — dodaj markę, rodzaj lub opis', tone: 'info' },
};

export const NAME_ISSUE_KINDS = Object.keys(NAME_ISSUES) as NameIssueKind[];

/** Pola „producent” będące grupami/katalogami, a nie markami. */
const NON_BRAND = new Set(
  ['akcesoria do myjni', 'akcesoria do sprzatania', 'detailing', 'inni producenci', 'dyfuzor elektryczny', 'inne', 'brak', 'wlasne', 'wapro', 'marka niezdefiniowana', 'usluga'],
);

/** Kategorie, w których pojemność zwykle nie ma sensu (akcesoria, części, osprzęt). */
const NO_CAPACITY_CATEGORY =
  /dysz|węż|wez|lanc|adapter|zawor|zawór|szczotk|pistolet|szybkoz|końców|koncow|mop|mikrofib|części|czesci|gąbk|gabk|miotł|miotl|papier|akcesori|rękawic|reka|wiadr|kosz|worek|ścierk|sciera|zgarniacz|pompk|manometr|filtr|uszczelk|tłocz|tloc|obudow|śrub|srub|złącz|zlacz|trójnik|trojnik|redukc|nakręt|nakret|opryskiw|myjk|odkurzacz|dozownik|rozpylacz|butelk|pojemnik|sprzęt|sprzet|usług|uslug|transport/i;

const CAPACITY_RE = /(?<![\d,./xX×])(\d+(?:[.,]\d+)?)\s*(ml|ltr|litr(?:ów|y)?|kg|gr|g|l)(?![\p{L}\d])/giu;

export function normalizeUnit(unit: string): string {
  const u = unit.toLowerCase();
  if (u === 'l' || u === 'ltr' || u.startsWith('litr')) return 'L';
  if (u === 'gr') return 'g';
  return u;
}

export interface CapacityMatch {
  text: string;
  /** Zapis wg standardu, np. 5L, 750ml, 0,6L. */
  normalized: string;
  index: number;
}

export function findCapacities(name: string): CapacityMatch[] {
  const out: CapacityMatch[] = [];
  for (const m of name.matchAll(CAPACITY_RE)) {
    out.push({ text: m[0], normalized: `${m[1]}${normalizeUnit(m[2])}`, index: m.index ?? 0 });
  }
  return out;
}

const fold = (s: string) =>
  s
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/ł/g, 'l')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

export function brandKey(raw: string): string {
  return fold(raw);
}

/** Marka z pola „producent”: część przed „ - ” lub „ / ”, o ile to nie grupa. */
export function brandOf(p: Pick<Product, 'manufacturer'>): string {
  const raw = (p.manufacturer ?? '').trim();
  if (!raw) return '';
  const first = raw.split(/\s+[-–—/]\s+/)[0].trim();
  const key = fold(first);
  if (!key || NON_BRAND.has(key) || key.startsWith('akcesoria')) return '';
  return first;
}

export type BrandRule = 'auto' | 'require' | 'ignore';

export interface BrandStat {
  key: string;
  label: string;
  products: number;
  /** Ile produktów marki ma jej nazwę na początku nazwy (0–1). */
  usage: number;
  /** Czy marka jest wymagana w nazwie (wynik reguły + ustawienia). */
  required: boolean;
  rule: BrandRule;
}

export interface NameContext {
  /** Wszystkie znane marki (od najdłuższej) — do rozpoznania marki na początku nazwy. */
  brands: { key: string; label: string }[];
  /** Zapis marki dominujący w nazwach produktów. */
  form: Map<string, string>;
  /** Marki, których obecność na początku nazwy wymagamy. */
  required: Set<string>;
  stats: BrandStat[];
}

/** Marka uznawana za „używaną w nazwach”, gdy ma ją na początku co najmniej ten ułamek produktów. */
export const BRAND_USAGE_MIN = 0.2;

function startsWithBrand(name: string, key: string): boolean {
  const f = fold(name);
  return f.startsWith(key) && (f.length === key.length || !/[a-z]/.test(f[key.length]));
}

export function buildNameContext(products: Product[], rules: Record<string, BrandRule> = {}): NameContext {
  interface Acc { label: string; n: number; starts: number; forms: Map<string, number> }
  const acc = new Map<string, Acc>();
  for (const p of products) {
    if (p.isGroup) continue;
    const b = brandOf(p);
    if (!b) continue;
    const k = brandKey(b);
    const cur = acc.get(k) ?? { label: b, n: 0, starts: 0, forms: new Map<string, number>() };
    cur.n++;
    const name = (p.displayName ?? '').trim();
    if (startsWithBrand(name, k)) {
      cur.starts++;
      const written = name.slice(0, k.length);
      cur.forms.set(written, (cur.forms.get(written) ?? 0) + 1);
    }
    acc.set(k, cur);
  }
  const form = new Map<string, string>();
  const required = new Set<string>();
  const stats: BrandStat[] = [];
  const brandMap = new Map<string, string>();
  for (const [k, v] of acc) {
    let best = v.label;
    let bestN = 0;
    for (const [f, n] of v.forms) {
      if (n > bestN) {
        best = f;
        bestN = n;
      }
    }
    form.set(k, best);
    const usage = v.n ? v.starts / v.n : 0;
    const rule = rules[k] ?? 'auto';
    const isReq = rule === 'require' || (rule === 'auto' && v.n >= 3 && usage >= BRAND_USAGE_MIN);
    if (isReq) required.add(k);
    stats.push({ key: k, label: best, products: v.n, usage, required: isReq, rule });
    if (v.n >= 2) brandMap.set(k, best);
  }
  for (const m of manufacturerOptions()) {
    const k = brandKey(m);
    if (k && !NON_BRAND.has(k) && !k.startsWith('akcesoria') && !brandMap.has(k)) brandMap.set(k, form.get(k) ?? m);
  }
  stats.sort((a, b) => b.products - a.products);
  return {
    brands: [...brandMap.entries()].map(([key, label]) => ({ key, label })).sort((a, b) => b.key.length - a.key.length),
    form,
    required,
    stats,
  };
}

/** Marka, od której zaczyna się nazwa (całe słowa), jeśli którakolwiek jest znana. */
export function leadingBrand(name: string, ctx: NameContext): { key: string; label: string; length: number } | null {
  for (const b of ctx.brands) {
    if (startsWithBrand(name, b.key)) return { key: b.key, label: b.label, length: b.key.length };
  }
  return null;
}

/** Czy dla tego produktu pojemność w nazwie ma sens. */
export function capacityExpected(p: Pick<Product, 'category'>): boolean {
  return !NO_CAPACITY_CATEGORY.test(p.category || '');
}

export interface NameIssue {
  kind: NameIssueKind;
  detail?: string;
}

const SEP = ' - ';
const hasLowerLetters = (s: string) => /\p{Ll}/u.test(s);

/** Marka wymagana w nazwie tego produktu: { klucz, zapis } albo null. */
function requiredBrand(p: Product, ctx: NameContext): { key: string; label: string } | null {
  const b = brandOf(p);
  if (!b) return null;
  const key = brandKey(b);
  if (!ctx.required.has(key)) return null;
  return { key, label: ctx.form.get(key) ?? b };
}

/** Wykryte odstępstwa od standardu dla jednego produktu. */
export function checkName(p: Product, ctx: NameContext): NameIssue[] {
  const name = p.displayName ?? '';
  const out: NameIssue[] = [];
  if (!name.trim()) return out;
  const trimmed = name.trim();

  if (trimmed.length > NAME_MAX) out.push({ kind: 'tooLong', detail: `${trimmed.length} zn.` });
  if (trimmed.length < 12 || trimmed.split(/\s+/).length < 2) out.push({ kind: 'tooShort', detail: `${trimmed.length} zn.` });
  if (/\s{2,}/.test(name) || name !== trimmed) out.push({ kind: 'spaces' });

  const brand = requiredBrand(p, ctx);
  if (brand) {
    const lead = leadingBrand(trimmed, ctx);
    if (lead && lead.key === brand.key) {
      const written = trimmed.slice(0, lead.length);
      if (written !== brand.label) out.push({ kind: 'brandCase', detail: `${written} → ${brand.label}` });
      if (startsWithBrand(trimmed.slice(lead.length).trim(), brand.key)) out.push({ kind: 'brandDup' });
    } else if (lead) {
      out.push({ kind: 'brandOther', detail: `${lead.label} ≠ ${brand.label}` });
    } else {
      out.push({ kind: 'noBrand', detail: brand.label });
    }
  }

  if (/[–—]/.test(trimmed) || /\d(?:ml|l|kg|g|gr|ltr)\.\s+\p{L}/iu.test(trimmed)) out.push({ kind: 'separator' });

  const caps = findCapacities(trimmed);
  if (caps.length === 0) {
    if (capacityExpected(p)) out.push({ kind: 'noCapacity' });
  } else {
    if (caps.some((c) => c.text !== c.normalized)) out.push({ kind: 'capacityFormat', detail: caps.map((c) => `${c.text} → ${c.normalized}`).join(', ') });
    if (caps.length === 1) {
      const idx = trimmed.indexOf(SEP);
      const main = idx >= 0 ? trimmed.slice(0, idx) : trimmed;
      if (!main.trimEnd().endsWith(caps[0].text)) out.push({ kind: 'capacityPlace' });
    }
  }

  const letters = trimmed.replace(CAPACITY_RE, '').replace(/[^\p{L}]/gu, '');
  if (letters.length >= 8 && !hasLowerLetters(letters)) out.push({ kind: 'allCaps' });
  return out;
}

export interface NameSuggestion {
  name: string;
  changed: boolean;
  /** Propozycja wymaga przeglądu (skrócenie, zmiana wersalików). */
  needsReview: boolean;
  notes: string[];
}

const TRAILING_WEAK = new Set(['do', 'w', 'z', 'i', 'na', 'po', 'od', 'dla', 'za', 'o', 'u', 'ze', 'oraz', 'lub', 'a', 'e']);

/** WERSALIKI → zapis zdaniowy: pierwsze słowo z wielkiej litery, skróty i słowa z cyframi bez zmian. */
function sentenceCase(text: string): string {
  return text
    .split(' ')
    .map((w, i) => {
      if (!/\p{L}/u.test(w)) return w;
      if (/\d/.test(w)) return w;
      const letters = w.replace(/[^\p{L}]/gu, '');
      const acronym = !/[aeiouyąęóAEIOUYĄĘÓ]/.test(letters);
      if (i > 0 && acronym) return w;
      const lower = w.toLowerCase();
      return i === 0 ? lower.charAt(0).toUpperCase() + lower.slice(1) : lower;
    })
    .join(' ');
}

/** Skraca opis (część po „ - ”) do podanej długości na granicy słowa. */
function fitDescription(main: string, desc: string): string {
  const room = NAME_MAX - main.length - SEP.length;
  if (room < 8) return '';
  if (desc.length <= room) return desc;
  const words = desc.split(/\s+/);
  while (words.length > 0 && words.join(' ').length > room) words.pop();
  while (words.length > 0 && TRAILING_WEAK.has(words[words.length - 1].toLowerCase().replace(/[.,;:]+$/, ''))) words.pop();
  const cut = words.join(' ').replace(/[\s,;:.\-–]+$/, '');
  return cut.length >= 8 ? cut : '';
}

/** Proponuje nazwę zgodną ze standardem (nie zmienia sensu: porządkuje zapis, kolejność i długość). */
export function suggestName(p: Product, ctx: NameContext): NameSuggestion {
  const original = p.displayName ?? '';
  const notes: string[] = [];
  let needsReview = false;
  let s = original.replace(/\s+/g, ' ').trim();
  if (!s) return { name: original, changed: false, needsReview: false, notes };

  // separatory: długie myślniki i kropka po pojemności → „ - ”
  s = s.replace(/\s*[–—]\s*/g, SEP);
  s = s.replace(/(\d(?:ml|l|kg|g|gr|ltr))\.\s+(?=\p{L})/giu, `$1${SEP}`);

  // pojemność: jedna → przenosimy na koniec części głównej w zapisie standardowym
  const caps = findCapacities(s);
  let main: string;
  let desc: string;
  let capStr = '';
  if (caps.length === 1) {
    const c = caps[0];
    let end = c.index + c.text.length;
    if (s[end] === '.' && !/[\p{L}\d]/u.test(s[end + 1] ?? '')) end++;
    const without = (s.slice(0, c.index) + s.slice(end))
      .replace(/(\s-)(\s*-)+/g, '$1')
      .replace(/\s+-\s*$/, '')
      .replace(/^\s*-\s+/, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
    const idx = without.indexOf(SEP);
    main = (idx >= 0 ? without.slice(0, idx) : without).trim();
    desc = idx >= 0 ? without.slice(idx + SEP.length).trim() : '';
    capStr = c.normalized;
  } else {
    if (caps.length > 1) {
      for (const c of [...caps].reverse()) s = s.slice(0, c.index) + c.normalized + s.slice(c.index + c.text.length);
    }
    const idx = s.indexOf(SEP);
    main = (idx >= 0 ? s.slice(0, idx) : s).trim();
    desc = idx >= 0 ? s.slice(idx + SEP.length).trim() : '';
  }

  // producent na początku (w zapisie dominującym dla marki), bez powtórzeń
  const brand = requiredBrand(p, ctx);
  let rest = main;
  let prefix = '';
  if (brand) {
    const lead = leadingBrand(main, ctx);
    if (lead && lead.key === brand.key) {
      rest = main.slice(lead.length).trim();
      while (rest && startsWithBrand(rest, brand.key)) rest = rest.slice(brand.key.length).trim();
      prefix = brand.label;
    } else if (!lead) {
      prefix = brand.label;
      notes.push('dodano producenta');
      needsReview = true;
    }
  }
  // wersaliki: reszta nazwy (po marce) zapisana samymi wielkimi literami → zapis zdaniowy
  const letters = (rest + desc).replace(CAPACITY_RE, '').replace(/[^\p{L}]/gu, '');
  if (letters.length >= 8 && !hasLowerLetters(letters)) {
    rest = sentenceCase(rest);
    desc = desc.toLowerCase();
    needsReview = true;
    notes.push('zmieniono wersaliki');
  }
  main = [prefix, rest].filter(Boolean).join(' ');
  if (capStr) main = `${main} ${capStr}`.trim();

  let out = desc ? `${main}${SEP}${desc}` : main;
  if (out.length > NAME_MAX) {
    const cut = fitDescription(main, desc);
    out = cut ? `${main}${SEP}${cut}` : main;
    needsReview = true;
    notes.push(cut ? 'skrócono opis' : 'usunięto opis');
    if (out.length > NAME_MAX) notes.push('nadal za długa — skróć ręcznie');
  }
  out = out.replace(/\s{2,}/g, ' ').trim();
  return { name: out, changed: out !== original, needsReview, notes };
}

/** Zgodność z limitem długości (do plakietki). */
export function lengthTone(len: number): 'ok' | 'warn' | 'danger' {
  return len > NAME_MAX ? 'danger' : len > NAME_IDEAL ? 'warn' : 'ok';
}
