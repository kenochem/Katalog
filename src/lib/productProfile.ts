import type { Product } from '../types';
import { functionLeaves, type MaterialFact } from './categoryEngine';
import { descFamilyKey, MIN_DESCRIPTION, plainText, volumeOf } from './engineDescriptions';
import { fold } from './partsText';

/**
 * Profil produktu: wszystko, co silnik rozumie o produkcie, z podaniem źródła każdej informacji
 * (nazwa, opis, karta produktu), plus luki w wiedzy i sprzeczności między źródłami.
 */
export interface Known<T = string> {
  value: T;
  source: 'nazwa' | 'opis' | 'karta' | 'kategoria';
}

export interface ProductProfile {
  volume: Known | null;
  forms: Known[];
  concentration: Known | null;
  dilution: Known | null;
  ph: Known | null;
  audience: Known<'profesjonalny' | 'domowy'> | null;
  certificates: Known[];
  claims: Known[];
  /** Do czego służy według tekstu (nazwa + opis + karta): kategorie z wagą. */
  uses: { leaf: string; score: number }[];
  family: { size: number; volumes: string[] };
  gaps: string[];
  conflicts: string[];
}

export interface ProfileContext {
  /** Pełny opis (HTML lub tekst). */
  description: string;
  /** Kategoria (liść) i dział główny drzewa. */
  category: string;
  department: string;
  fact?: MaterialFact;
  siblings: Product[];
  hasMaterials: boolean;
}

type Source = Known['source'];

const FORMS: [string, RegExp][] = [
  ['płyn', /\bplyn\w*|\bciecz\b/],
  ['żel', /\bzel\w*/],
  ['proszek', /\bproszek|\bproszki/],
  ['pianka / piana', /\bpianka|\bpiana\b|\bpiany\b/],
  ['spray', /\bspray|\brozpylacz/],
  ['tabletki', /\btabletk/],
  ['kostki', /\bkostk/],
  ['pasta', /\bpast[aęy]\b/],
  ['granulat', /\bgranulat/],
  ['mleczko', /\bmleczk/],
  ['chusteczki', /\bchusteczk/],
  ['wosk', /\bwosk/],
  ['olejek', /\bolejek|\bolejki/],
];

const CERTS: [string, RegExp][] = [
  ['HACCP', /\bhaccp\b/],
  ['EU Ecolabel', /ecolabel|eco-?label|ekoetykiet/],
  ['pozwolenie biobójcze', /pozwolenie na obr[oó]t|produkt biob[oó]jczy|pozwolenie.*biob/],
  ['atest PZH', /\bpzh\b|atest/],
  ['badanie dermatologiczne', /dermatolog/],
];

const CLAIMS: [string, RegExp][] = [
  ['ekologiczny / biodegradowalny', /ekologiczn|biodegradowaln|\beco\b/],
  ['bez zapachu', /bez zapachu|bezzapachow/],
  ['bez fosforanów', /bez fosforan/],
  ['bez chloru', /bez chloru/],
  ['hipoalergiczny', /hipoalergiczn/],
  ['skoncentrowany', /skoncentrowan|koncentrat/],
  ['gotowy do użycia', /gotowy do (u[zż]ycia|stosowania)|ready to use/],
];

const phOf = (text: string) => text.match(/\bpH\b[^0-9\n]{0,40}(\d{1,2}(?:[.,]\d+)?(?:\s?[-–]\s?\d{1,2}(?:[.,]\d+)?)?)/i)?.[1]?.replace(',', '.');

export function buildProfile(p: Product, ctx: ProfileContext): ProductProfile {
  const name = p.displayName || p.name;
  const descPlain = plainText(ctx.description);
  const meta = p.meta ?? {};
  const body = [meta.shortDescription, meta.descUsage, meta.descComposition, descPlain].filter(Boolean).join(' ');
  const card = ctx.fact ? [ctx.fact.use, ctx.fact.usage, ctx.fact.comp].filter(Boolean).join(' ') : '';
  const sources: [Source, string][] = [
    ['nazwa', fold(name)],
    ['opis', fold(body)],
    ['karta', fold(card)],
  ];

  const find = (patterns: [string, RegExp][]): Known[] => {
    const out: Known[] = [];
    for (const [label, re] of patterns) {
      const hit = sources.find(([, t]) => t && re.test(t));
      if (hit) out.push({ value: label, source: hit[0] });
    }
    return out;
  };

  const vol = volumeOf(name);
  const dilution = (() => {
    for (const [src, t] of [sources[2], sources[1]] as [Source, string][]) {
      const m = t.match(/\b(\d{1,3}\s?:\s?\d{1,4})(?:\s?(?:[-–]|do)\s?(\d{1,3}\s?:\s?\d{1,4}))?/);
      if (m) return { value: m[2] ? `${m[1].replace(/\s/g, '')} – ${m[2].replace(/\s/g, '')}` : m[1].replace(/\s/g, ''), source: src } as Known;
    }
    return null;
  })();
  const ph: Known | null = ctx.fact?.ph ? { value: ctx.fact.ph, source: 'karta' } : phOf(body) ? { value: phOf(body)!, source: 'opis' } : null;

  const concentrateHit = find([
    ['koncentrat', /koncentrat/],
    ['gotowy do użycia', /gotowy do (u[zż]ycia|stosowania)|ready to use/],
  ]);
  const litres = (() => {
    const m = vol?.match(/^([\d.]+) (L|ml|kg|g)$/);
    if (!m) return null;
    const n = parseFloat(m[1]);
    return m[2] === 'ml' || m[2] === 'g' ? n / 1000 : n;
  })();
  const consumerDept = /dom i ogr/i.test(ctx.department);
  const audience: Known<'profesjonalny' | 'domowy'> | null = ctx.department
    ? { value: consumerDept ? 'domowy' : 'profesjonalny', source: 'kategoria' }
    : litres != null
      ? { value: litres >= 5 ? 'profesjonalny' : 'domowy', source: 'nazwa' }
      : null;

  const uses = functionLeaves(fold(`${name} ${body} ${card}`))
    .map((u) => ({ leaf: u.leaf, score: Math.round(u.w * Math.min(3, u.hits) * 10) / 10 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  const siblings = ctx.siblings.filter((s) => s.id !== p.id && descFamilyKey(s) === descFamilyKey(p));
  const gaps: string[] = [];
  if (!ctx.category || ctx.category === 'Do decyzji') gaps.push('brak kategorii');
  if (descPlain.length < MIN_DESCRIPTION) gaps.push(descPlain ? `krótki opis (${descPlain.length} zn.)` : 'brak opisu');
  if (!ctx.hasMaterials) gaps.push('brak materiałów (karty, ulotki)');
  if (!p.ean) gaps.push('brak EAN');
  if (!vol) gaps.push('brak pojemności w nazwie');
  if (!ph && /plyn|zel|proszek|koncentrat/.test(fold(name + body)) && ctx.hasMaterials) gaps.push('brak pH (nie ma w kartach)');

  const conflicts: string[] = [];
  if (ctx.fact?.ph && phOf(body)) {
    const a = parseFloat(ctx.fact.ph);
    const b = parseFloat(phOf(body)!.replace(',', '.'));
    if (!Number.isNaN(a) && !Number.isNaN(b) && Math.abs(a - b) > 1.5) conflicts.push(`pH w opisie (${phOf(body)}) różni się od pH w karcie (${ctx.fact.ph})`);
  }
  const conc = new Set(concentrateHit.map((c) => c.value));
  if (conc.has('koncentrat') && conc.has('gotowy do użycia')) conflicts.push('źródła mówią jednocześnie „koncentrat” i „gotowy do użycia”');
  const top = uses[0];
  if (top && ctx.category && top.score >= 2.4 && !uses.some((u) => u.leaf === ctx.category)) conflicts.push(`tekst wskazuje „${top.leaf}”, a produkt jest w „${ctx.category}”`);

  return {
    volume: vol ? { value: vol, source: 'nazwa' } : null,
    forms: find(FORMS),
    concentration: concentrateHit[0] ?? null,
    dilution,
    ph,
    audience,
    certificates: find(CERTS),
    claims: find(CLAIMS),
    uses,
    family: { size: siblings.length + 1, volumes: [...new Set([vol, ...siblings.map((s) => volumeOf(s.displayName || s.name))].filter((v): v is string => !!v))] },
    gaps,
    conflicts,
  };
}

/** Pokrycie wiedzy w całym katalogu: ile produktów ma poszczególne informacje (do wskaźników „mózgu katalogu”). */
export function knowledgeCoverage(profiles: ProductProfile[]): { label: string; count: number; total: number }[] {
  const total = profiles.length;
  const n = (f: (p: ProductProfile) => boolean) => profiles.filter(f).length;
  return [
    { label: 'Pojemność', count: n((p) => !!p.volume), total },
    { label: 'Forma produktu', count: n((p) => p.forms.length > 0), total },
    { label: 'Koncentrat / gotowy do użycia', count: n((p) => !!p.concentration), total },
    { label: 'Dozowanie / rozcieńczenie', count: n((p) => !!p.dilution), total },
    { label: 'pH', count: n((p) => !!p.ph), total },
    { label: 'Certyfikaty', count: n((p) => p.certificates.length > 0), total },
    { label: 'Pełny opis', count: n((p) => !p.gaps.some((g) => g.startsWith('brak opisu') || g.startsWith('krótki opis'))), total },
    { label: 'Materiały (karty, ulotki)', count: n((p) => !p.gaps.includes('brak materiałów (karty, ulotki)')), total },
    { label: 'EAN', count: n((p) => !p.gaps.includes('brak EAN')), total },
  ];
}
