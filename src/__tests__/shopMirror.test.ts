import { describe, expect, it } from 'vitest';
import type { Product } from '../types';
import { flattenCategories } from '../lib/categoryRegistry';
import { bestShopCategory, industriesCsv, planMirror, redirectsCsv, shopCategoryIndex, structureChanges, wooCategoriesCsv } from '../lib/shopMirror';

const idx = shopCategoryIndex();
const leaf = [...idx.values()].find((c) => c.isLeaf && c.depth === 2 && !c.retired)!;
const industry = [...idx.values()].find((c) => c.industry)!;
const mk = (sku: string, o: Partial<Product> = {}) => ({ id: sku, sku, name: sku, displayName: sku, category: '', manufacturer: '', ean: '', imageUrl: '', description: '', hasImage: false, stock: 0, catalog: 'shop', ...o }) as unknown as Product;

describe('lustro sklepu', () => {
  it('drzewo sklepu ma 3 poziomy, a kategoria główna produktu to najgłębsza', () => {
    expect(Math.max(...[...idx.values()].map((c) => c.depth))).toBe(2);
    const chain = [leaf.id, leaf.parent];
    expect(bestShopCategory(chain)?.id).toBe(leaf.id);
    expect(bestShopCategory([])).toBeNull();
  });

  it('kategorie „dla branż” i „Zestawy” są wycofane z drzewa katalogu, ale znane z lustra sklepu', () => {
    const names = flattenCategories().map((c) => c.name.toLowerCase());
    expect(names.some((n) => n.includes('dla obiektów i branż') || n.startsWith('zestaw'))).toBe(false);
    expect([...idx.values()].some((c) => c.retired)).toBe(true);
    expect(industry.retired).toBe(true);
    expect(bestShopCategory([industry.id])).toBeNull();
    expect(bestShopCategory([industry.id, leaf.id])?.id).toBe(leaf.id);
  });

  it('plan: różna kategoria trafia do zmian, zgodna nie, brak w sklepie jest liczony osobno', () => {
    const file = { fetchedAt: '', source: '', skus: { A1: [leaf.id], B2: [leaf.id], C3: [leaf.id] } };
    const same = mk('B2', { category: leaf.name, meta: { shopCategoryPath: leaf.path } as Product['meta'] });
    const plan = planMirror([mk('A1'), same, mk('Z9')], file);
    expect(plan.changes.map((c) => c.sku)).toEqual(['A1']);
    expect(plan.cleanup).toEqual([]);
    expect(plan.notInShop).toBe(1);
    expect(plan.shopOnly).toBe(1);
  });

  it('produkt z poprawną kategorią, ale siedzący w kategorii branżowej, trafia do sprzątania i zachowuje branżę', () => {
    const file = { fetchedAt: '', source: '', skus: { B2: [leaf.id, industry.id] } };
    const same = mk('B2', { category: leaf.name, meta: { shopCategoryPath: leaf.path } as Product['meta'] });
    const plan = planMirror([same], file);
    expect(plan.changes).toEqual([]);
    expect(plan.cleanup.map((c) => c.sku)).toEqual(['B2']);
    expect(plan.cleanup[0].industries).toEqual([industry.industry]);
    expect(industriesCsv(plan.cleanup)).toContain(industry.industry);
    // eksport zdejmuje kategorię branżową i zostawia kategorię produktu
    const csv = wooCategoriesCsv(plan.cleanup);
    expect(csv).not.toContain(industry.name);
    expect(csv).toContain(leaf.name);
  });

  it('zmiany drzewa wskazują wycofane kategorie do usunięcia w sklepie, a przekierowania mają cel', () => {
    const removed = structureChanges().filter((c) => c.kind === 'usunięta');
    expect(removed.some((c) => c.name === industry.name)).toBe(true);
    expect(redirectsCsv()).toContain(industry.slug);
  });

  it('eksport do WooCommerce pomija produkty bez kategorii i zachowuje pozostałe kategorie sklepu', () => {
    const item = (catalog: string, catalogPath: string) => ({ id: 'x', sku: 'S1', name: 'n', catalog, catalogPath, shop: leaf.name, shopPath: leaf.path, shopCatId: leaf.id, shopIds: [leaf.id], industries: [] });
    const csv = wooCategoriesCsv([item('Do decyzji', 'Do decyzji'), item('Nowa', `${leaf.path.split(' › ')[0]} › Nowa`)]);
    expect(csv).not.toContain('Do decyzji');
    expect(csv).toContain('S1');
    expect(csv).toContain(' > Nowa');
  });
});
