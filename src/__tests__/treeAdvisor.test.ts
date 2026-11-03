import { describe, expect, it } from 'vitest';
import { adviseTree, type AdvisorNode, type AdvisorRow } from '../lib/treeAdvisor';

const key = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

function node(name: string, parent: string | null, leaf: boolean, depth: number, path?: string): AdvisorNode {
  return { name, parent, isLeaf: leaf, depth, path: path ?? (parent ? `${parent} › ${name}` : name), fromShop: true };
}

function build(spec: { nodes: AdvisorNode[]; products: Record<string, string[]> }) {
  const rows: AdvisorRow[] = [];
  const currentIds = new Map<string, string[]>();
  let n = 0;
  for (const [cat, names] of Object.entries(spec.products)) {
    for (const name of names) {
      const id = `p${n++}`;
      rows.push({ id, name, maker: 'Kenotk', from: cat, to: null, status: 'pewne', alternatives: [] });
      currentIds.set(key(cat), [...(currentIds.get(key(cat)) ?? []), id]);
    }
  }
  return adviseTree({ nodes: spec.nodes, rows, currentIds });
}

const many = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => `${prefix} ${i + 1}`);
const kinds = (r: ReturnType<typeof build>) => r.proposals.map((p) => p.action.kind);

describe('doradca drzewa kategorii', () => {
  const dept = node('Auto', null, false, 0);
  const group = node('Mycie', 'Auto', false, 1);

  it('proponuje usunięcie pustej kategorii i scalenie drobnicy', () => {
    const r = build({
      nodes: [dept, group, node('Szampony', 'Mycie', true, 2), node('Gąbki', 'Mycie', true, 2), node('Rękawice', 'Mycie', true, 2)],
      products: { Szampony: many('Szampon Kenotk', 12), Gąbki: ['Gąbka do mycia'] },
    });
    const remove = r.proposals.find((p) => p.action.kind === 'remove');
    expect(remove && remove.action.kind === 'remove' && remove.action.name).toBe('Rękawice');
    const merge = r.proposals.find((p) => p.action.kind === 'merge');
    expect(merge && merge.action.kind === 'merge' && merge.action.name).toBe('Gąbki');
    expect(merge && merge.action.kind === 'merge' && merge.action.into).toBe('Szampony');
  });

  it('nie usuwa kategorii, do której silnik właśnie kieruje produkty', () => {
    const nodes = [dept, group, node('Szampony', 'Mycie', true, 2), node('Woski', 'Mycie', true, 2)];
    const rows: AdvisorRow[] = many('Wosk Kenotk', 6).map((name, i) => ({ id: `w${i}`, name, maker: 'Kenotk', from: 'Szampony', to: 'Woski', status: 'pewne', alternatives: [] }));
    const r = adviseTree({ nodes, rows, currentIds: new Map([['szampony', rows.map((x) => x.id)]]) });
    expect(r.proposals.some((p) => p.action.kind === 'remove')).toBe(false);
  });

  it('dubel w nazwach to scalenie, a „ogólna obok szczegółowej” tylko uwaga', () => {
    const r = build({
      nodes: [dept, group, node('Pasty polerskie', 'Mycie', true, 2), node('Polerskie pasty', 'Mycie', true, 2), node('Dysze', 'Mycie', true, 2), node('Dysze obrotowe', 'Mycie', true, 2)],
      products: { 'Pasty polerskie': many('Pasta Kenotk', 10), 'Polerskie pasty': many('Pasta inna', 4), Dysze: many('Dysza płaska', 10), 'Dysze obrotowe': many('Dysza obrotowa', 8) },
    });
    const merge = r.proposals.filter((p) => p.action.kind === 'merge');
    expect(merge).toHaveLength(1);
    expect(merge[0].action.kind === 'merge' && merge[0].action.name).toBe('Polerskie pasty');
    expect(r.proposals.some((p) => p.action.kind === 'note' && p.title.includes('Dysze') && p.title.includes('Dysze obrotowe'))).toBe(true);
  });

  it('„Odkurzacze” i „Akcesoria do odkurzaczy” nie są scalane automatycznie', () => {
    const r = build({
      nodes: [dept, group, node('Odkurzacze', 'Mycie', true, 2), node('Akcesoria do odkurzaczy', 'Mycie', true, 2)],
      products: { Odkurzacze: many('Odkurzacz Kenotk', 8), 'Akcesoria do odkurzaczy': many('Worek do odkurzacza', 9) },
    });
    expect(kinds(r)).not.toContain('merge');
  });

  it('dzieli przeładowaną kategorię wg słów z nazw produktów', () => {
    const r = build({
      nodes: [dept, group, node('Dysze', 'Mycie', true, 2)],
      products: { Dysze: [...many('Dysza obrotowa nr', 24), ...many('Dysza płaska nr', 24), ...many('Dysza inna', 2)] },
    });
    const split = r.proposals.find((p) => p.action.kind === 'split');
    expect(split).toBeTruthy();
    if (split?.action.kind === 'split') {
      expect(split.action.parent).toBe('Mycie');
      expect(split.action.parts.map((x) => x.label).sort()).toEqual(['Obrotowa', 'Płaska']);
      expect(split.action.parts.every((x) => x.ids.length >= 20 && x.samples.length === 3)).toBe(true);
    }
  });

  it('słowa ogólne i nazwa producenta nie tworzą podkategorii', () => {
    const r = build({
      nodes: [dept, group, node('Szampony', 'Mycie', true, 2)],
      products: { Szampony: [...many('Płyn Kenotk Premium', 30), ...many('Preparat Kenotk Professional', 25)] },
    });
    expect(kinds(r)).not.toContain('split');
  });

  it('szuflada „Inne” dostaje uwagę z liczbą produktów do przeniesienia', () => {
    const nodes = [dept, group, node('Inne', 'Mycie', true, 2), node('Szampony', 'Mycie', true, 2)];
    const names = many('Coś Kenotk', 20);
    const rows: AdvisorRow[] = names.map((name, i) => ({ id: `i${i}`, name, maker: 'Kenotk', from: 'Inne', to: i < 12 ? 'Szampony' : null, status: i < 12 ? 'pewne' : 'do sprawdzenia', alternatives: [] }));
    const r = adviseTree({ nodes, rows, currentIds: new Map([['inne', rows.map((x) => x.id)]]) });
    const dump = r.proposals.find((p) => p.id.startsWith('note:dump'));
    expect(dump?.tone).toBe('bad');
    expect(dump?.reason).toContain('12');
    expect(r.stats.dumpShare).toBe(1);
  });

  it('grupa z jedną podkategorią do spłaszczenia, szeroki dział do pogrupowania', () => {
    const others = ['Woski', 'Gumy', 'Chrom', 'Lakiery', 'Felgi', 'Szyby', 'Opony', 'Zapachy', 'Skóra', 'Plastiki', 'Silniki'];
    const wide = Array.from({ length: 15 }, (_, i) => node(i < 4 ? `Szczotki ${['do felg', 'do wnętrz', 'do kół', 'do opon'][i]}` : others[i - 4], 'Auto', true, 1));
    const r = build({ nodes: [dept, node('Samotna', 'Auto', false, 1), node('Jedyna', 'Samotna', true, 2), ...wide], products: {} });
    const flatten = r.proposals.find((p) => p.action.kind === 'flatten');
    expect(flatten?.action.kind === 'flatten' && flatten.action.child).toBe('Jedyna');
    const regroup = r.proposals.find((p) => p.action.kind === 'regroup');
    expect(regroup?.action.kind === 'regroup' && regroup.action.leaves).toHaveLength(4);
  });

  it('usterki zapisu nazwy to propozycja zmiany nazwy', () => {
    const r = build({ nodes: [dept, group, node('szampony.', 'Mycie', true, 2)], products: { 'szampony.': many('Szampon Kenotk', 5) } });
    const rename = r.proposals.find((p) => p.action.kind === 'rename');
    expect(rename?.action.kind === 'rename' && rename.action.to).toBe('Szampony');
  });

  it('statystyki liczą kategorie w sam raz, drobnicę i puste', () => {
    const r = build({
      nodes: [dept, group, node('A', 'Mycie', true, 2), node('B', 'Mycie', true, 2), node('C', 'Mycie', true, 2)],
      products: { A: many('Produkt Kenotk', 10), B: ['jeden'] },
    });
    expect(r.stats).toMatchObject({ leaves: 3, healthy: 1, tiny: 1, empty: 1, overloaded: 0 });
  });
});
