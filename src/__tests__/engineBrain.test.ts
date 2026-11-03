import { describe, expect, it } from 'vitest';
import { buildInsights } from '../lib/engineInsights';
import { descFamilyKey, findMissingDescriptions, parseDescriptionsCsv, volumeOf } from '../lib/engineDescriptions';
import { checkAllDescriptions, checkDescription } from '../lib/descriptionChecks';
import { buildProfile, knowledgeCoverage } from '../lib/productProfile';
import { buildIndustryModel, formatIndustries, parseIndustries } from '../lib/industryModel';
import type { EngineSummary } from '../lib/categoryEngineReport';
import type { Product } from '../types';

const summary = (p: Partial<EngineSummary> = {}): EngineSummary => ({ total: 100, confirmed: 80, changes: [], review: [], research: [], hide: [], flagged: [], ...p });
const row = (id: string) => ({ id }) as never;
const prod = (id: string, name: string, extra: Partial<Product> = {}): Product => ({ id, sku: id.toUpperCase(), name, manufacturer: 'TENZI', category: 'Mycie', description: '', ...extra }) as Product;
const LONG = 'Skoncentrowany płyn do mycia powierzchni w kuchni i łazience. Usuwa tłuszcz, osady i zabrudzenia. Stosować rozcieńczony zgodnie z instrukcją na etykiecie, nie mieszać z innymi środkami. Produkt do użytku profesjonalnego. ';

describe('komunikaty silnika', () => {
  it('audyt ze znalezionymi błędami proponuje poprawkę', () => {
    const ins = buildInsights({ scope: 'audyt', summary: summary({ changes: [row('a'), row('b')] }), health: null, totals: { products: 100, categorized: 100 }, descriptions: null, researchWithDocs: 0 });
    expect(ins[0]).toMatchObject({ tone: 'bad', action: { kind: 'apply' } });
    expect(ins[0].title).toContain('2 produktów');
  });
  it('czysty audyt nie wymyśla problemów', () => {
    const ins = buildInsights({ scope: 'audyt', summary: summary(), health: null, totals: { products: 100, categorized: 100 }, descriptions: null, researchWithDocs: 0 });
    expect(ins.map((i) => i.id)).toEqual(['audit-ok', 'coverage']);
  });
  it('opisy: komunikat dotyczy braków i uwag, nie generowania', () => {
    const ins = buildInsights({ scope: 'uzupelnij', summary: summary({ research: [row('a'), row('b')] }), health: null, totals: { products: 100, categorized: 90 }, descriptions: { missing: 5, issues: 2 }, researchWithDocs: 1 });
    expect(ins.find((i) => i.id === 'research')!.text).toContain('1 z nich ma już wgrane materiały');
    const d = ins.find((i) => i.id === 'descriptions')!;
    expect(d.action).toMatchObject({ kind: 'tab', target: 'opisy' });
    expect(d.text).not.toMatch(/szkic/i);
  });
});

describe('opisy: przyjmowanie i kontrola', () => {
  it('znajduje produkty bez pełnego opisu', () => {
    const c = findMissingDescriptions([prod('a', 'A 1L'), prod('b', 'B 1L')], new Map([['a', LONG + LONG], ['b', 'krótko']]));
    expect(c.map((x) => x.product.id)).toEqual(['b']);
  });
  it('rozpoznaje pojemność i rodzinę produktu', () => {
    expect(volumeOf('TENZI Brudex 5L - płyn')).toBe('5 L');
    expect(descFamilyKey(prod('a', 'TENZI Brudex 5L - płyn'))).toBe(descFamilyKey(prod('b', 'TENZI Brudex 1L - inny dopisek')));
  });
  it('wczytuje opisy z CSV', () => {
    const r = parseDescriptionsCsv('SKU;Opis;Krótki opis\r\nabc1;"Pierwszy akapit.\n\nDrugi akapit.";Krótko\r\nxyz;;pusty\r\n');
    expect(r).toHaveLength(1);
    expect(r[0].description).toBe('<p>Pierwszy akapit.</p><p>Drugi akapit.</p>');
  });
  const ctx = (name: string, description: string, extra: Record<string, unknown> = {}) => ({ product: prod('p1', name), description, category: 'Mycie powierzchni', makers: ['TENZI', 'SONAX', 'K2'], ...extra });
  it('poprawny opis przechodzi bez uwag', () => {
    expect(checkDescription(ctx('TENZI Brudex 5L', `<p>${LONG}</p>`))).toEqual([]);
  });
  it('wykrywa tekst zastępczy, niedozwolony HTML i pusty opis', () => {
    expect(checkDescription(ctx('X 1L', '')).map((i) => i.code)).toEqual(['pusty']);
    expect(checkDescription(ctx('X 1L', `<p>${LONG}</p><p>Do uzupełnienia</p>`)).some((i) => i.code === 'szablon' && i.level === 'error')).toBe(true);
    expect(checkDescription(ctx('X 1L', `<p>${LONG}</p><script>alert(1)</script>`)).some((i) => i.code === 'html' && i.level === 'error')).toBe(true);
  });
  it('wykrywa inną pojemność, cudzą markę i deklarację biobójczą', () => {
    const issues = checkDescription(ctx('TENZI Brudex 1L', `<p>${LONG} Opakowanie 5 L. Lepszy niż Sonax. Dezynfekuje powierzchnie i działa bakteriobójczo.</p>`));
    const codes = issues.map((i) => i.code);
    expect(codes).toContain('pojemnosc');
    expect(codes).toContain('marka');
    expect(codes).toContain('biobojcze');
  });
  it('500 ml i 0,5 L to ta sama pojemność', () => {
    expect(checkDescription(ctx('Płyn 0,5L', `<p>${LONG} Butelka 500 ml.</p>`)).some((i) => i.code === 'pojemnosc')).toBe(false);
  });
  it('identyczny opis u różnych produktów jest zgłaszany, ale u opakowań tego samego produktu nie', () => {
    const a = prod('a', 'TENZI Brudex 5L');
    const b = prod('b', 'TENZI Brudex 1L');
    const c = prod('c', 'TENZI Inny Produkt 1L');
    const d = new Map([['a', LONG], ['b', LONG], ['c', LONG]]);
    const rows = checkAllDescriptions([a, b, c], d, {}, () => 'Mycie powierzchni');
    const dup = rows.filter((r) => r.issues.some((i) => i.code === 'duplikat')).map((r) => r.product.id);
    expect(dup.sort()).toEqual(['a', 'b', 'c']);
    const family = checkAllDescriptions([a, b], new Map([['a', LONG], ['b', LONG]]), {}, () => 'Mycie powierzchni');
    expect(family.some((r) => r.issues.some((i) => i.code === 'duplikat'))).toBe(false);
  });
});

describe('profil produktu', () => {
  const p = prod('p1', 'TENZI Brudex 5L - płyn odtłuszczający', { ean: '' } as Partial<Product>);
  it('wyciąga pojemność, formę, dozowanie i pH wraz ze źródłem', () => {
    const pr = buildProfile(p, {
      description: '<p>Koncentrat odtłuszczający. Dozowanie 1:10 do 1:50. Certyfikat HACCP. pH koncentratu 12.</p>',
      category: 'Mycie powierzchni',
      department: 'Chemia profesjonalna',
      siblings: [p, prod('p2', 'TENZI Brudex 1L')],
      hasMaterials: false,
    });
    expect(pr.volume).toEqual({ value: '5 L', source: 'nazwa' });
    expect(pr.forms.find((f) => f.value === 'płyn')?.source).toBe('nazwa');
    expect(pr.dilution?.value).toBe('1:10 – 1:50');
    expect(pr.ph).toEqual({ value: '12', source: 'opis' });
    expect(pr.certificates.map((c) => c.value)).toContain('HACCP');
    expect(pr.audience?.value).toBe('profesjonalny');
    expect(pr.family).toEqual({ size: 2, volumes: ['5 L', '1 L'] });
    expect(pr.gaps).toEqual(expect.arrayContaining(['brak EAN', 'brak materiałów (karty, ulotki)']));
  });
  it('zgłasza sprzeczność pH między opisem a kartą', () => {
    const pr = buildProfile(p, { description: '<p>pH 12</p>', category: '', department: '', fact: { use: 'x', ph: '5', files: ['k.pdf'] }, siblings: [], hasMaterials: true });
    expect(pr.conflicts.some((c) => c.includes('pH'))).toBe(true);
  });
  it('liczy pokrycie wiedzy', () => {
    const pr = buildProfile(p, { description: LONG, category: 'Mycie', department: 'Chemia', siblings: [], hasMaterials: true });
    const cov = knowledgeCoverage([pr]);
    expect(cov.find((c) => c.label === 'Pojemność')).toMatchObject({ count: 1, total: 1 });
    expect(cov.find((c) => c.label === 'EAN')).toMatchObject({ count: 0 });
  });
});

describe('branże', () => {
  it('rozpoznaje opcje zawierające przecinek i zachowuje kolejność zapisu', () => {
    const v = 'Firmy sprzątające, Biura, Szkoły, przedszkola i żłobki';
    expect(parseIndustries(v)).toEqual(['Firmy sprzątające', 'Biura', 'Szkoły, przedszkola i żłobki']);
    expect(formatIndustries(['Szkoły, przedszkola i żłobki', 'Biura'])).toBe('Biura, Szkoły, przedszkola i żłobki');
  });
  it('proponuje branże oznaczone w większości produktów kategorii i nie rusza już oznaczonych', () => {
    const labelled = [1, 2, 3, 4, 5].map((i) => prod(`l${i}`, `Środek ${i}`, { meta: { attrs: { branza: 'Hotele i pensjonaty' } } } as Partial<Product>));
    const empty = prod('e1', 'Nowy środek');
    const done = prod('d1', 'Gotowy', { meta: { attrs: { branza: 'Biura' } } } as Partial<Product>);
    const model = buildIndustryModel([...labelled, empty, done], () => 'Łazienki');
    expect(model.labelled).toBe(6);
    const s = model.suggest(empty, 'Nowy środek');
    expect(s?.value).toBe('Hotele i pensjonaty');
    expect(s?.options[0].why).toContain('5 z 6');
    expect(model.suggest(done, 'Gotowy')).toBeNull();
  });
  it('bez wystarczających danych w kategorii milczy, a jednoznaczne słowo daje podpowiedź', () => {
    const model = buildIndustryModel([prod('a', 'A')], () => 'Rzadka');
    expect(model.suggest(prod('b', 'B'), 'środek do czyszczenia')).toBeNull();
    expect(model.suggest(prod('c', 'C'), 'Do użytku w szpitalach i przychodniach')?.value).toBe('Placówki medyczne');
  });
});
