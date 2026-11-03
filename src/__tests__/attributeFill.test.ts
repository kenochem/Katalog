import { describe, expect, it } from 'vitest';
import type { AttributeDef } from '../lib/attributes';
import { extractorFor, knowledgeOf, missingAttributes, pickOption, proposeAttributes, valueFor } from '../lib/attributeFill';
import { buildProfile } from '../lib/productProfile';
import { extractFact, mergeFacts, validPh } from '../lib/materialFacts';
import type { Product } from '../types';

const def = (label: string, type: AttributeDef['type'], extra: Partial<AttributeDef> = {}): AttributeDef => ({ key: label.toLowerCase().replace(/[^a-z]+/g, '_'), label, type, unit: '', options: [], categories: [], required: false, sort: 0, ...extra });
const prod = (id: string, name: string, extra: Partial<Product> = {}): Product => ({ id, sku: id.toUpperCase(), name, manufacturer: 'ECO SHINE', category: 'Mycie', description: '', ...extra }) as Product;

const TDS = `SMART FOAM
Wielozadaniowa aktywna pianka czyszcząca i odtłuszczająca do wszystkich rodzajów powierzchni.
Preparat gotowy do użycia. Pozostawia świeży cytrynowy zapach.

Zastosowanie: Wielozadaniowa, silnie działająca pianka do czyszczenia i odtłuszczania wszystkich rodzajów powierzchni.
Sposób użycia i dozowania: Równomiernie rozpylić na zabrudzoną powierzchnię.
Dane techniczne: Termin trwałości: 24 miesiące. Gęstość: 1,0 – 1,1 g/ml. pH koncentratu: ok. 10.
Dostępne opakowania: butelka 1 litr.
`;

describe('wyciąganie danych technicznych z karty', () => {
  it('czyta pH, gęstość, termin trwałości i zapach', () => {
    const f = extractFact(TDS, 'x.pdf')!.fact;
    expect(f).toMatchObject({ ph: '10', density: '1,0 – 1,1', shelfLife: 24, fragrance: 'cytrynowy' });
  });
  it('pH spoza skali 0–14 jest odrzucane', () => {
    expect(validPh('12-13')).toBe('12-13');
    expect(validPh('40-60')).toBeUndefined();
  });
  it('łączenie kart zachowuje dane techniczne', () => {
    const m = mergeFacts([{ kind: 'tds', fact: extractFact(TDS, 'x.pdf')!.fact, file: 'x.pdf' }])!;
    expect(m.shelfLife).toBe(24);
  });
});

describe('rozumienie atrybutów z panelu', () => {
  it('rozpoznaje atrybut po nazwie, bez mylenia „informacji” z „formą”', () => {
    expect(extractorFor(def('pH', 'number'))?.id).toBe('ph');
    expect(extractorFor(def('Termin trwałości', 'number'))?.id).toBe('trwalosc');
    expect(extractorFor(def('Forma produktu', 'select'))?.id).toBe('forma');
    expect(extractorFor(def('Dodatkowe informacje', 'text'))).toBeNull();
    expect(extractorFor(def('Branża', 'select'))).toBeNull();
  });
  it('wskazuje, jakich atrybutów brakuje w panelu', () => {
    const missing = missingAttributes([def('pH', 'number'), def('Gęstość', 'number')]).map((m) => m.id);
    expect(missing).not.toContain('ph');
    expect(missing).not.toContain('gestosc');
    expect(missing).toContain('forma');
  });
  it('dopasowuje wartość do opcji atrybutu i niczego nie wymyśla', () => {
    expect(pickOption(['Płyn', 'Pianka', 'Żel'], ['pian'])).toBe('Pianka');
    expect(pickOption(['Płyn', 'Żel'], ['pian'])).toBeNull();
  });
  const k = (p: Product, desc = '') =>
    knowledgeOf(
      p,
      buildProfile(p, { description: desc, category: 'Mycie', department: 'Chemia profesjonalna', fact: mergeFacts([{ kind: 'tds', fact: extractFact(TDS, 'x.pdf')!.fact, file: 'SMART FOAM.pdf' }])!, siblings: [], hasMaterials: true }),
      mergeFacts([{ kind: 'tds', fact: extractFact(TDS, 'x.pdf')!.fact, file: 'SMART FOAM.pdf' }])!,
    );
  const smart = prod('eco30', 'Eco Shine SMART FOAM 1L - pianka odtłuszczająca APC');
  it('Smart Foam: pH 10, gęstość 1,05, trwałość 24 mies., forma „Pianka”, zapach cytrynowy', () => {
    const know = k(smart);
    expect(valueFor(def('pH', 'number'), 'ph', know)?.value).toBe(10);
    expect(valueFor(def('Gęstość', 'number', { unit: 'g/ml' }), 'gestosc', know)?.value).toBe(1.05);
    expect(valueFor(def('Termin trwałości', 'number', { unit: 'miesięcy' }), 'trwalosc', know)?.value).toBe(24);
    expect(valueFor(def('Forma produktu', 'select', { options: ['Płyn', 'Pianka', 'Żel'] }), 'forma', know)?.value).toBe('Pianka');
    expect(valueFor(def('Zapach', 'text'), 'zapach', know)?.value).toBe('cytrynowy');
    expect(valueFor(def('Pojemność', 'number', { unit: 'L' }), 'pojemnosc', know)?.value).toBe(1);
    expect(valueFor(def('Koncentracja', 'select', { options: ['Koncentrat', 'Gotowy do użycia'] }), 'koncentracja', know)?.value).toBe('Gotowy do użycia');
  });
  it('uzupełnia tylko puste atrybuty, a różnice zgłasza osobno', () => {
    const empty = prod('a1', 'Eco Shine SMART FOAM 1L');
    const filledSame = prod('a2', 'Eco Shine SMART FOAM 5L', { meta: { attrs: { ph: 10 } } } as Partial<Product>);
    const filledDiff = prod('a3', 'Eco Shine SMART FOAM 10L', { meta: { attrs: { ph: 7 } } } as Partial<Product>);
    const out = proposeAttributes([empty, filledSame, filledDiff], [def('pH', 'number')], (p) => k(p));
    expect(out.map((o) => [o.product.id, o.existing ?? null, o.value])).toEqual([
      ['a1', null, 10],
      ['a3', 7, 10],
    ]);
  });
});
