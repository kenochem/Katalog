import type { Product } from '../types';
import { attrValuesOf, attributesFor, hasAttrValue, type AttrType, type AttrValue, type AttributeDef } from './attributes';
import type { MaterialFact } from './categoryEngine';
import { fold } from './partsText';
import { technicalFacts } from './technicalNames';
import type { ProductProfile } from './productProfile';

/**
 * Uzupełnianie atrybutów produktów (parametrów z panelu atrybutów) wiedzą, którą silnik ma o produkcie:
 * z karty produktu, opisu i nazwy. Silnik rozumie atrybuty po nazwie (pH, gęstość, forma…) i wpisuje wartość
 * tylko tam, gdzie atrybut jest pusty, a wartość da się uczciwie dopasować do typu atrybutu i jego listy opcji.
 */
export type ExtractorId = 'ph' | 'gestosc' | 'trwalosc' | 'pojemnosc' | 'forma' | 'koncentracja' | 'dozowanie' | 'odbiorca' | 'haccp' | 'ecolabel' | 'zapach' | 'waga' | 'sztuki' | 'kolor' | 'material' | 'przylacze' | 'cisnienie';

export interface ExtractorInfo {
  id: ExtractorId;
  title: string;
  /** Rozpoznanie atrybutu po jego nazwie i kluczu (po znormalizowaniu). */
  match: RegExp;
  /** Propozycja definicji, gdy panel atrybutów jeszcze takiego nie ma. */
  create: { label: string; type: AttrType; unit: string; options?: string[] };
}

export const EXTRACTORS: ExtractorInfo[] = [
  { id: 'ph', title: 'pH', match: /(^|\W|_)ph($|\W|_)/, create: { label: 'pH', type: 'number', unit: '' } },
  { id: 'gestosc', title: 'Gęstość', match: /gestosc/, create: { label: 'Gęstość', type: 'number', unit: 'g/ml' } },
  { id: 'trwalosc', title: 'Termin trwałości', match: /trwalosc|termin waznosci|okres waznosci|przydatnosc/, create: { label: 'Termin trwałości', type: 'number', unit: 'miesięcy' } },
  { id: 'pojemnosc', title: 'Pojemność opakowania', match: /pojemnosc|objetosc/, create: { label: 'Pojemność opakowania', type: 'number', unit: 'L' } },
  { id: 'forma', title: 'Forma produktu', match: /(^|\W|_)forma($|\W|_)|postac|konsystencja/, create: { label: 'Forma produktu', type: 'select', unit: '', options: ['Płyn', 'Żel', 'Proszek', 'Pianka', 'Spray', 'Tabletki', 'Kostki', 'Pasta', 'Granulat', 'Mleczko', 'Chusteczki', 'Wosk', 'Olejek'] } },
  { id: 'koncentracja', title: 'Koncentracja', match: /koncentrat|gotowy|stezenie/, create: { label: 'Koncentracja', type: 'select', unit: '', options: ['Koncentrat', 'Gotowy do użycia'] } },
  { id: 'dozowanie', title: 'Dozowanie', match: /dozowanie|rozcienczenie/, create: { label: 'Dozowanie', type: 'text', unit: '' } },
  { id: 'odbiorca', title: 'Odbiorca', match: /odbiorca|segment|uzytkownik|grupa docelowa/, create: { label: 'Odbiorca', type: 'select', unit: '', options: ['Profesjonalny', 'Domowy'] } },
  { id: 'haccp', title: 'Certyfikat HACCP', match: /haccp/, create: { label: 'HACCP', type: 'bool', unit: '' } },
  { id: 'ecolabel', title: 'EU Ecolabel', match: /ecolabel|ekoetykiet/, create: { label: 'EU Ecolabel', type: 'bool', unit: '' } },
  { id: 'waga', title: 'Masa netto', match: /(^|\W|_)(masa|waga)($|\W|_)/, create: { label: 'Masa netto', type: 'number', unit: 'kg' } },
  { id: 'sztuki', title: 'Liczba sztuk w opakowaniu', match: /sztuk|(^|\W|_)szt($|\W|_)|ilosc w opakowaniu/, create: { label: 'Liczba sztuk w opakowaniu', type: 'number', unit: 'szt.' } },
  { id: 'kolor', title: 'Kolor', match: /(^|\W|_)kolor|barwa/, create: { label: 'Kolor', type: 'text', unit: '' } },
  { id: 'material', title: 'Materiał', match: /material|tworzywo/, create: { label: 'Materiał', type: 'text', unit: '' } },
  { id: 'przylacze', title: 'Przyłącza', match: /przylacz|gwint/, create: { label: 'Przyłącza', type: 'text', unit: '' } },
  { id: 'cisnienie', title: 'Ciśnienie robocze', match: /cisnienie/, create: { label: 'Ciśnienie robocze', type: 'number', unit: 'bar' } },
  { id: 'zapach', title: 'Zapach', match: /zapach|aromat/, create: { label: 'Zapach', type: 'text', unit: '' } },
];

/** Który wyciągacz rozumie dany atrybut z panelu (po nazwie i kluczu) — albo null, gdy silnik go nie rozumie. */
export function extractorFor(def: Pick<AttributeDef, 'key' | 'label'>): ExtractorInfo | null {
  const t = fold(`${def.label} ${def.key}`);
  return EXTRACTORS.find((e) => e.match.test(t)) ?? null;
}

/** Wyciągacze, dla których w panelu nie ma jeszcze żadnego atrybutu. */
export function missingAttributes(defs: Pick<AttributeDef, 'key' | 'label'>[]): ExtractorInfo[] {
  const have = new Set(defs.map((d) => extractorFor(d)?.id).filter(Boolean));
  return EXTRACTORS.filter((e) => !have.has(e.id));
}

export interface AttrKnowledge {
  ph?: string;
  density?: string;
  shelfLife?: number;
  /** Objętość (płyny): tylko litry i mililitry. */
  volume?: { n: number; unit: 'L' | 'ml'; derived?: boolean };
  /** Masa netto: kilogramy i gramy. */
  mass?: { n: number; unit: 'kg' | 'g'; derived?: boolean };
  pieces?: number;
  colour?: string;
  material?: string;
  threads?: string;
  pressure?: number;
  form?: { label: string; source: string };
  concentration?: { label: 'Koncentrat' | 'Gotowy do użycia'; source: string };
  dilution?: { value: string; source: string };
  audience?: 'Profesjonalny' | 'Domowy';
  haccp?: boolean;
  ecolabel?: boolean;
  fragrance?: string;
  /** Skąd pochodzą dane liczbowe z karty. */
  cardFile?: string;
}

const SOURCE_RANK: Record<string, number> = { nazwa: 0, karta: 1, opis: 2, kategoria: 3 };

export function knowledgeOf(p: Product, profile: ProductProfile, fact?: MaterialFact): AttrKnowledge {
  const k: AttrKnowledge = {};
  const cardFile = fact?.files[0];
  if (profile.ph) {
    k.ph = profile.ph.value;
    if (profile.ph.source === 'karta') k.cardFile = cardFile;
  }
  if (fact?.density) k.density = fact.density;
  if (fact?.shelfLife) k.shelfLife = fact.shelfLife;
  if (fact?.fragrance) k.fragrance = fact.fragrance;
  if (fact && (fact.density || fact.shelfLife || fact.fragrance)) k.cardFile = cardFile;
  if (profile.volume) {
    const m = profile.volume.value.match(/^([\d.]+) (L|ml|kg|g)$/);
    if (m) {
      const n = parseFloat(m[1]);
      if (m[2] === 'L' || m[2] === 'ml') k.volume = { n, unit: m[2] };
      else if (m[2] === 'kg' || n >= 50) k.mass = { n, unit: m[2] as 'kg' | 'g' }; // małe gramy to zwykle gramatura (np. papier 25g), nie masa netto
    }
  }
  // płyn sprzedawany na wagę (albo odwrotnie): przy znanej gęstości drugą wielkość da się policzyć
  const rho = k.density ? mean(k.density, 3) : null;
  if (rho && rho > 0.2 && rho < 3) {
    if (k.mass && !k.volume) k.volume = { n: round3((k.mass.unit === 'g' ? k.mass.n / 1000 : k.mass.n) / rho), unit: 'L', derived: true };
    else if (k.volume && !k.mass) k.mass = { n: round3((k.volume.unit === 'ml' ? k.volume.n / 1000 : k.volume.n) * rho), unit: 'kg', derived: true };
  }
  const label = p.displayName || p.name || '';
  const pcs = label.match(/(?<![\d.,])(\d{1,4})\s?(?:szt|sztuk)\b/i);
  if (pcs) k.pieces = Number(pcs[1]);
  const tech = technicalFacts(label, p.manufacturer || null);
  if (tech) {
    k.material = tech.material;
    k.colour = tech.colour;
    k.threads = tech.threads;
    k.pressure = tech.pressure;
  }
  const form = [...profile.forms].sort((a, b) => SOURCE_RANK[a.source] - SOURCE_RANK[b.source])[0];
  if (form) k.form = { label: form.value, source: form.source };
  if (profile.concentration) k.concentration = { label: profile.concentration.value === 'koncentrat' ? 'Koncentrat' : 'Gotowy do użycia', source: profile.concentration.source };
  if (profile.dilution) k.dilution = { value: profile.dilution.value, source: profile.dilution.source };
  if (profile.audience) k.audience = profile.audience.value === 'domowy' ? 'Domowy' : 'Profesjonalny';
  if (profile.certificates.some((c) => c.value === 'HACCP')) k.haccp = true;
  if (profile.certificates.some((c) => c.value === 'EU Ecolabel')) k.ecolabel = true;
  return k;
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

const FORM_KEYWORDS: Record<string, string[]> = {
  płyn: ['plyn', 'ciecz'],
  żel: ['zel'],
  proszek: ['proszek'],
  'pianka / piana': ['pian'],
  spray: ['spray', 'rozpyl'],
  tabletki: ['tabletk'],
  kostki: ['kostk'],
  pasta: ['past'],
  granulat: ['granulat'],
  mleczko: ['mleczk'],
  chusteczki: ['chusteczk'],
  wosk: ['wosk'],
  olejek: ['olejek', 'olejk'],
};

/** Dopasowuje wartość do listy opcji atrybutu; nie wymyśla nowych opcji. */
export function pickOption(options: string[], candidates: string[]): string | null {
  const opts = options.map((o) => ({ o, f: fold(o) }));
  for (const c of candidates.map(fold)) {
    const hit = opts.find((x) => x.f === c) ?? opts.find((x) => x.f.includes(c) || (c.length >= 4 && c.includes(x.f) && x.f.length >= 3));
    if (hit) return hit.o;
  }
  return null;
}

/** Średnia z zakresu zapisanego w karcie („12–13” → 12,5); `digits` — liczba miejsc po przecinku. */
const mean = (s: string, digits = 1): number | null => {
  const nums = s.replace(/,/g, '.').match(/\d+(?:\.\d+)?/g)?.map(Number);
  if (!nums?.length) return null;
  const f = 10 ** digits;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * f) / f;
};

export interface FilledValue {
  value: AttrValue;
  source: string;
}

/** Wartość atrybutu wg wiedzy o produkcie albo null, gdy silnik jej nie zna lub nie da się jej dopasować do typu/opcji atrybutu. */
export function valueFor(def: AttributeDef, id: ExtractorId, k: AttrKnowledge): FilledValue | null {
  const card = k.cardFile ? `karta: ${k.cardFile}` : 'karta produktu';
  switch (id) {
    case 'ph': {
      if (!k.ph) return null;
      if (def.type === 'number') {
        const n = mean(k.ph);
        return n == null ? null : { value: n, source: card };
      }
      return def.type === 'text' ? { value: k.ph, source: card } : null;
    }
    case 'gestosc': {
      if (!k.density) return null;
      if (def.type === 'number') {
        const n = mean(k.density, 3);
        return n == null ? null : { value: n, source: card };
      }
      return def.type === 'text' ? { value: k.density, source: card } : null;
    }
    case 'trwalosc': {
      if (!k.shelfLife) return null;
      if (def.type === 'number') return { value: /lat|rok/i.test(def.unit) ? Math.round((k.shelfLife / 12) * 10) / 10 : k.shelfLife, source: card };
      return def.type === 'text' ? { value: `${k.shelfLife} miesięcy`, source: card } : null;
    }
    case 'pojemnosc': {
      if (!k.volume) return null;
      const u = def.unit.trim().toLowerCase();
      const liters = k.volume.unit === 'ml' ? k.volume.n / 1000 : k.volume.n;
      const source = k.volume.derived ? 'wyliczone z wagi i gęstości' : 'nazwa produktu';
      if (def.type === 'number') return { value: round3(u === 'ml' ? liters * 1000 : liters), source };
      return def.type === 'text' ? { value: `${round3(k.volume.n)} ${k.volume.unit}`, source } : null;
    }
    case 'waga': {
      if (!k.mass) return null;
      const kg = k.mass.unit === 'g' ? k.mass.n / 1000 : k.mass.n;
      const source = k.mass.derived ? 'wyliczone z pojemności i gęstości' : 'nazwa produktu';
      if (def.type === 'number') return { value: round3(def.unit.trim().toLowerCase() === 'g' ? kg * 1000 : kg), source };
      return def.type === 'text' ? { value: `${round3(k.mass.n)} ${k.mass.unit}`, source } : null;
    }
    case 'sztuki':
      if (!k.pieces) return null;
      return def.type === 'number' ? { value: k.pieces, source: 'nazwa produktu' } : def.type === 'text' ? { value: `${k.pieces} szt.`, source: 'nazwa produktu' } : null;
    case 'kolor':
    case 'material': {
      const v = id === 'kolor' ? k.colour : k.material;
      if (!v) return null;
      if (def.type === 'select') {
        const opt = pickOption(def.options, [v]);
        return opt ? { value: opt, source: 'nazwa produktu' } : null;
      }
      return def.type === 'text' ? { value: v, source: 'nazwa produktu' } : null;
    }
    case 'przylacze':
      return k.threads && def.type === 'text' ? { value: k.threads, source: 'nazwa produktu' } : null;
    case 'cisnienie':
      if (!k.pressure) return null;
      return def.type === 'number' ? { value: k.pressure, source: 'nazwa produktu' } : def.type === 'text' ? { value: `${k.pressure} bar`, source: 'nazwa produktu' } : null;
    case 'forma': {
      if (!k.form) return null;
      if (def.type === 'select') {
        const opt = pickOption(def.options, FORM_KEYWORDS[k.form.label] ?? [k.form.label]);
        return opt ? { value: opt, source: k.form.source } : null;
      }
      return def.type === 'text' ? { value: k.form.label, source: k.form.source } : null;
    }
    case 'koncentracja': {
      if (!k.concentration) return null;
      if (def.type === 'select') {
        const opt = pickOption(def.options, k.concentration.label === 'Koncentrat' ? ['koncentrat', 'skoncentrowany'] : ['gotowy', 'rtu']);
        return opt ? { value: opt, source: k.concentration.source } : null;
      }
      if (def.type === 'bool') return { value: k.concentration.label === 'Koncentrat', source: k.concentration.source };
      return def.type === 'text' ? { value: k.concentration.label, source: k.concentration.source } : null;
    }
    case 'dozowanie':
      return k.dilution && def.type === 'text' ? { value: k.dilution.value, source: k.dilution.source } : null;
    case 'odbiorca': {
      if (!k.audience || def.type !== 'select') return null;
      const opt = pickOption(def.options, k.audience === 'Domowy' ? ['domow', 'konsument', 'dom'] : ['profesjonaln', 'zawodow', 'prof']);
      return opt ? { value: opt, source: 'kategoria produktu' } : null;
    }
    case 'haccp':
      return k.haccp && def.type === 'bool' ? { value: true, source: 'karta / opis produktu' } : null;
    case 'ecolabel':
      return k.ecolabel && def.type === 'bool' ? { value: true, source: 'karta / opis produktu' } : null;
    case 'zapach':
      return k.fragrance && def.type === 'text' ? { value: k.fragrance, source: card } : null;
  }
}

export interface AttrProposal {
  product: Product;
  def: AttributeDef;
  value: AttrValue;
  source: string;
  /** Atrybut jest już wypełniony inną wartością — to uwaga o niespójności, nie propozycja zapisu. */
  existing?: AttrValue;
}

const same = (a: AttrValue, b: AttrValue) => String(a).trim().toLowerCase() === String(b).trim().toLowerCase();

/** Propozycje wartości atrybutów dla produktów: puste pola do uzupełnienia oraz różnice względem wartości już zapisanych. */
export function proposeAttributes(products: Product[], defs: AttributeDef[], knowledge: (p: Product) => AttrKnowledge): AttrProposal[] {
  const out: AttrProposal[] = [];
  const known = defs.map((def) => ({ def, ex: extractorFor(def) })).filter((x): x is { def: AttributeDef; ex: ExtractorInfo } => !!x.ex);
  if (!known.length) return out;
  for (const p of products) {
    if (p.isGroup) continue;
    const have = attrValuesOf(p);
    const scoped = new Set(attributesFor(p, known.map((k) => k.def)).map((d) => d.key));
    let k: AttrKnowledge | null = null;
    for (const { def, ex } of known) {
      if (!scoped.has(def.key)) continue;
      k ??= knowledge(p);
      const v = valueFor(def, ex.id, k);
      if (!v) continue;
      if (!hasAttrValue(have[def.key])) out.push({ product: p, def, value: v.value, source: v.source });
      else if (!same(have[def.key], v.value)) out.push({ product: p, def, value: v.value, source: v.source, existing: have[def.key] });
    }
  }
  return out;
}
