import { describe, expect, it } from 'vitest';
import { buildEngine, type EngineProduct } from '../lib/categoryEngine';
import { deriveMemory, type MemoryEntry } from '../lib/engineMemory';
import { extractFact, mergeFacts } from '../lib/materialFacts';
import { flattenCategories } from '../lib/categoryRegistry';

const leaves = new Set(flattenCategories().filter((c) => c.isLeaf).map((c) => c.name));
const mk = (sku: string, name: string, extra: Partial<EngineProduct> = {}): EngineProduct => ({ sku, name, maker: 'TEST', desc: '', short: '', usage: '', comp: '', category: '', ...extra });
const entry = (e: Partial<MemoryEntry>): MemoryEntry => ({ sku: 'X1', action: 'accept', proposed: '', chosen: '', from: '', at: '2026-11-02', ...e });

describe('pamięć silnika', () => {
  it('ostatnia decyzja wygrywa, a odrzucone kategorie są zapamiętane', () => {
    const d = deriveMemory([
      entry({ sku: 'a1', action: 'change', proposed: 'Pasty BHP', chosen: 'Kremy do rąk' }),
      entry({ sku: 'a1', action: 'accept', proposed: 'Kremy do rąk', chosen: 'Kremy do rąk' }),
      entry({ sku: 'b2', action: 'dismiss', proposed: 'Pisuary i kostki WC' }),
    ]);
    expect(d.learned).toEqual({ A1: 'Kremy do rąk' });
    expect(d.rejected.A1).toEqual(['Pasty BHP']);
    expect(d.rejected.B2).toEqual(['Pisuary i kostki WC']);
    expect(d.stats).toMatchObject({ total: 3, accepted: 1, changed: 1, dismissed: 1, acceptRate: 33 });
  });
  it('zatwierdzona kategoria zachowuje się jak przypisanie ręczne', () => {
    const p = mk('ZZZ1', 'Specjalny preparat 5L', { category: 'Pasty BHP' });
    const base = buildEngine([p], { leaves }).decide(p);
    const learned = buildEngine([p], { leaves, learned: { ZZZ1: 'Kremy do rąk' } }).decide(p);
    expect(base.to).not.toBe('Kremy do rąk');
    expect(learned.to).toBe('Kremy do rąk');
    expect(learned.votes.some((v) => v.layer === 'ręczne' && v.why.includes('Ciebie'))).toBe(true);
  });
  it('odrzucona propozycja nie wraca', () => {
    const p = mk('ZZZ2', 'Eilfix Pasta BHP 5L - do zabrudzonych rąk');
    const before = buildEngine([p], { leaves }).decide(p);
    expect(before.to).toBe('Pasty BHP');
    const after = buildEngine([p], { leaves, rejected: { ZZZ2: ['Pasty BHP'] } }).decide(p);
    expect(after.to).not.toBe('Pasty BHP');
  });
});

describe('fakty z kart', () => {
  const tds = `TOILET SEPT

Chlorowy, gęsty preparat do czyszczenia i wybielania toalet, umywalek, sanitariatów.

Zastosowanie:
Doskonale nadaje się do mycia: toalet, pisuarów, wanien, brodzików, kabin prysznicowych.

Sposób użycia i dozowania:
Nanieść stężony preparat na toaletę. Odczekać 15 minut. Spłukać dużą ilością wody.

Dane techniczne:
pH koncentratu 12-13 (pH 1% roztworu ok. 10 - 11).
`;
  it('czyta kartę techniczną: zastosowanie, sposób użycia i pH', () => {
    const r = extractFact(tds, 'TOILET SEPT.pdf')!;
    expect(r.kind).toBe('tds');
    expect(r.fact.use).toContain('toalet');
    expect(r.fact.usage).toContain('Odczekać 15 minut');
    expect(r.fact.ph).toBe('12-13');
  });
  it('karta charakterystyki bez treści o zastosowaniu nie daje śmieciowego opisu', () => {
    const sds = 'Alcalu S\nKarta Charakterystyki\nzgodnie z rozporządzeniem (WE) nr 1907/2006 (REACH)\nSEKCJA 1: Identyfikacja\n1.1. Identyfikator produktu\n1.2. Istotne zidentyfikowane zastosowania\n: Zastosowanie profesjonalne\n: Zobacz instrukcję techniczną\n1.3. Dane dotyczące dostawcy\n';
    const r = extractFact(sds, 'Alcalu S.pdf')!;
    expect(r.kind).toBe('sds');
    expect(r.fact.use).toBe('');
  });
  it('łączy fakty z kilku dokumentów, karta techniczna przed kartą charakterystyki', () => {
    const merged = mergeFacts([
      { kind: 'sds', fact: { use: 'Produkt do mycia komór wędzarniczych, grilla.', ph: '13' }, file: 'sds.pdf' },
      { kind: 'tds', fact: { use: 'Odtłuszczacz do pieców i grilli w gastronomii.' }, file: 'tds.pdf' },
    ])!;
    expect(merged.use.startsWith('Odtłuszczacz')).toBe(true);
    expect(merged.ph).toBe('13');
    expect(merged.files).toEqual(['sds.pdf', 'tds.pdf']);
  });
  it('warstwa „karta” głosuje z przeznaczenia podanego w materiałach', () => {
    const p = mk('ZZZ3', 'Zagadkowy preparat 5L');
    const without = buildEngine([p], { leaves }).decide(p);
    const withFacts = buildEngine([p], { leaves, facts: { ZZZ3: { use: 'Preparat do czyszczenia i wybielania toalet, pisuarów, wanien i umywalek. Usuwa kamień i rdzę z armatury łazienkowej.', files: ['x.pdf'] } } }).decide(p);
    expect(without.votes.some((v) => v.layer === 'karta')).toBe(false);
    expect(withFacts.votes.some((v) => v.layer === 'karta')).toBe(true);
  });
});
