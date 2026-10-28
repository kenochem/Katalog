import { describe, expect, it } from 'vitest';
import type { Product } from '../types';
import { buildCategoryModel, buildManufacturerFinder, findNearDuplicates, tokens } from '../lib/assortmentAnalysis';

const p = (sku: string, name: string, extra: Partial<Product> = {}): Product =>
  ({ id: sku, sku, name, displayName: name, manufacturer: '', category: '', stock: 0, ean: '', description: '', hasImage: false, imageUrl: '', catalog: 'shop', ...extra }) as unknown as Product;

describe('analiza asortymentu', () => {
  it('tokenizuje nazwy bez liczb i jednostek', () => {
    const t = tokens(p('A', 'Szampon samochodowy 500 ml Sonax'));
    expect(t).toContain('szampon');
    expect(t).not.toContain('500');
    expect(t).not.toContain('ml');
  });

  it('wykrywa duplikaty nazw różniące się zapisem', () => {
    const d = findNearDuplicates([
      { name: 'Eco Shine', count: 5 },
      { name: 'ECOSHINE', count: 2 },
      { name: 'Sonax', count: 9 },
    ]);
    expect(d).toHaveLength(1);
    expect(d[0].names[0].name).toBe('Eco Shine');
  });

  it('podpowiada producenta po nazwie marki w nazwie produktu', () => {
    const find = buildManufacturerFinder([
      p('1', 'a', { manufacturer: 'Sonax' }),
      p('2', 'b', { manufacturer: 'Sonax' }),
    ]);
    expect(find(p('3', 'Sonax Xtreme szampon'))?.manufacturer.toLowerCase()).toBe('sonax');
    expect(find(p('4', 'Inny szampon'))).toBeNull();
  });

  it('model kategorii nie zawodzi bez danych uczących', () => {
    const m = buildCategoryModel([]);
    expect(m.suggest(p('1', 'Szampon'))).toBeNull();
  });
});
