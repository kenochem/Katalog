import { describe, expect, it } from 'vitest';
import { categoryKey, findLooseCategories, flattenCategories, mainCategoryRoots } from '../lib/categoryRegistry';
import { MANUAL_ASSIGNMENTS } from '../data/manualAssignments';
import { REVIEWED_ASSIGNMENTS } from '../data/reviewedAssignments';
import { classifyByName, REMAP_REMOVED, TAXONOMY_GROUPS, taxonomyLeafFor } from '../lib/partsTaxonomy';

describe('układ części technicznych', () => {
  const flat = flattenCategories();
  const leaves = new Map(flat.filter((c) => c.isLeaf).map((c) => [categoryKey(c.name), c]));

  it('zachowuje 7 działów i 3 poziomy, a nazwy kategorii są unikalne', () => {
    expect(mainCategoryRoots()).toHaveLength(7);
    expect(findLooseCategories()).toEqual([]);
    expect(Math.max(...flat.map((c) => c.depth))).toBe(2);
    expect(new Set(flat.map((c) => categoryKey(c.name))).size).toBe(flat.length);
  });

  it('zawiera nowe grupy i nie zawiera wycofanych kategorii', () => {
    for (const g of TAXONOMY_GROUPS) for (const l of g.leaves) expect(leaves.has(categoryKey(l)), l).toBe(true);
    const names = flat.map((c) => c.name);
    expect(names).not.toContain('Części do myjek');
    expect(names).not.toContain('Dysze do myjek');
  });

  it('każda kategoria docelowa z reguł i przeniesień istnieje w drzewie', () => {
    const samples: [string, string][] = [
      ['NYPEL MOSIĄDZ GZ3/8-GZ1/4', 'HYD000175'],
      ['WĄŻ KANALIZACJA 6 x 1 200 bar 30m', 'HYD000995'],
      ['Zawór by pas Comet', 'HYD001023'],
      ['Rurka kontrolna do płynu 50L do zbiornika chemii', 'HYD000823'],
      ['Kwazar POMPKA ORION ALKALINE', 'KWAZ0060'],
      ['SSAWKA SZCZELINOWA DN58', 'HYD000068'],
      ['Żarówka H7 55w', 'INNE0574'],
    ];
    for (const [n, s] of samples) {
      const leaf = classifyByName(n, s);
      expect(leaf, n).not.toBeNull();
      expect(leaves.has(categoryKey(leaf!)), `${n} → ${leaf}`).toBe(true);
    }
    for (const v of Object.values(REMAP_REMOVED)) expect(leaves.has(categoryKey(v)), v).toBe(true);
  });

  it('rozpoznaje części niezależnie od starej kategorii, ale nie rusza chemii', () => {
    expect(classifyByName('NYPEL MOSIĄDZ GZ3/8-GZ1/4', 'HYD000175')).toBe('Nyple');
    expect(classifyByName('Rurka kontrolna do płynu 50L do zbiornika chemii', 'HYD000823')).toBe('Rurki i ssaki chemii');
    expect(classifyByName('Komplet naprawczy By-Pas VRT3', 'HYD000849')).toBe('Komplety naprawcze');
    expect(classifyByName('TENZI TRUCK CLEAN 5L - Silna aktywna piana do mycia ciężarówek', 'TEN000095')).toBe('Mycie pojazdów ciężarowych');
    expect(classifyByName('Glinka do lakieru 160g', 'MOJ0001')).toBe('Glinki i przygotowanie lakieru');
    expect(classifyByName('Fresso Pędzel Detailing Brush No.16', 'INNE0583')).toBe('Pędzle i aplikatory detailingowe');
    expect(classifyByName('K2 DURABIT- Środek do konserwacji podwozia 1 L (pod pędzel)', 'K2000027')).toBeNull();
    expect(classifyByName('Płyn do WC z zaworkiem 750ml', 'DAF000001')).toBeNull();
    expect(classifyByName('Rękawica Fresso do mycia samochodów', 'INNE0345')).toBe('Gąbki i zmywaki');
    expect(classifyByName('RĘKAWICE NITRYLOWE A100', 'INNE0094')).toBe('Rękawiczki');
  });

  it('bez reguły produkt ze starej kategorii trafia do jej następcy', () => {
    expect(taxonomyLeafFor('Dziwna część', 'HYD1', 'Dysze do myjek')).toBe('Dysze');
    expect(taxonomyLeafFor('Dziwna część', 'HYD1', 'Mopy i stelaże')).toBeNull();
  });
});

describe('symetria menu', () => {
  it('każdy dział ma od 4 do 8 podkategorii', () => {
    const flat = flattenCategories();
    for (const root of mainCategoryRoots()) {
      const groups = flat.filter((c) => c.depth === 1 && c.path.startsWith(`${root} › `));
      expect(groups.length, root).toBeGreaterThanOrEqual(4);
      expect(groups.length, root).toBeLessThanOrEqual(8);
    }
  });

  it('każda podkategoria ma co najmniej jedną kategorię', () => {
    for (const c of flattenCategories().filter((x) => x.depth === 1)) expect(c.isLeaf, c.path).toBe(false);
  });
});

describe('ręczne przypisania', () => {
  it('każda kategoria docelowa istnieje w drzewie jako liść', () => {
    const leaves = new Set(flattenCategories().filter((c) => c.isLeaf).map((c) => categoryKey(c.name)));
    for (const [sku, leaf] of Object.entries({ ...MANUAL_ASSIGNMENTS, ...REVIEWED_ASSIGNMENTS })) expect(leaves.has(categoryKey(leaf)), `${sku} → ${leaf}`).toBe(true);
  });

  it('mają pierwszeństwo przed regułami nazw', () => {
    expect(taxonomyLeafFor('Cokolwiek', 'KAR000003', 'Do decyzji')).toBe('Uzdatnianie wody');
  });
});
