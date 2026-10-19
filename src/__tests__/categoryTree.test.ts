import { describe, expect, it } from 'vitest';
import { buildEffectiveTree, walkShopLeaves, type ShopCategoryTreeFile } from '../lib/shopCategoryTree';

const node = (id: number, name: string, children: ShopCategoryTreeFile['roots'] = []) => ({
  id,
  name,
  slug: name.toLowerCase(),
  parent: 0,
  count: 0,
  children,
});

const base: ShopCategoryTreeFile = {
  fetchedAt: 'x',
  roots: [node(1, 'Samochód', [node(2, 'Mycie'), node(3, 'Felgi')]), node(4, 'Dom', [node(5, 'Łazienka')])],
};

const leaves = (t: ShopCategoryTreeFile) => walkShopLeaves(t.roots).map((l) => l.label);

describe('drzewo kategorii z nakładką z bazy', () => {
  it('bez zmian zwraca drzewo bazowe', () => {
    expect(leaves(buildEffectiveTree(base, []))).toEqual(['Mycie', 'Felgi', 'Łazienka']);
  });

  it('własna kategoria pod istniejącą grupą jest dostępna do wyboru', () => {
    const t = buildEffectiveTree(base, [{ name: 'Woski specjalne', parent: 'Samochód', source: 'custom', removed: false }]);
    expect(leaves(t)).toContain('Woski specjalne');
    expect(t.roots[0].children.map((c) => c.name)).toContain('Woski specjalne');
  });

  it('własna kategoria główna trafia na poziom korzeni', () => {
    const t = buildEffectiveTree(base, [{ name: 'Nowa', parent: null, source: 'custom', removed: false }]);
    expect(t.roots.map((r) => r.name)).toContain('Nowa');
    expect(leaves(t)).toContain('Nowa');
  });

  it('podkategoria własnej kategorii (rodzic dodany później) też się układa', () => {
    const t = buildEffectiveTree(base, [
      { name: 'Dziecko', parent: 'Rodzic', source: 'custom', removed: false },
      { name: 'Rodzic', parent: 'Dom', source: 'custom', removed: false },
    ]);
    const dom = t.roots.find((r) => r.name === 'Dom')!;
    const rodzic = dom.children.find((c) => c.name === 'Rodzic')!;
    expect(rodzic.children.map((c) => c.name)).toEqual(['Dziecko']);
    expect(leaves(t)).toContain('Dziecko');
    expect(leaves(t)).not.toContain('Rodzic');
  });

  it('usunięta kategoria ze sklepu znika, a przeniesiona zmienia rodzica', () => {
    const t = buildEffectiveTree(base, [
      { name: 'Felgi', parent: null, source: 'shop', removed: true },
      { name: 'Łazienka', parent: 'Samochód', source: 'shop', removed: false },
    ]);
    expect(leaves(t)).not.toContain('Felgi');
    expect(t.roots.find((r) => r.name === 'Samochód')!.children.map((c) => c.name)).toContain('Łazienka');
  });

  it('nie modyfikuje drzewa bazowego', () => {
    buildEffectiveTree(base, [{ name: 'X', parent: 'Dom', source: 'custom', removed: false }]);
    expect(leaves(base)).toEqual(['Mycie', 'Felgi', 'Łazienka']);
  });
});
