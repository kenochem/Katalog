import { describe, expect, it } from 'vitest';
import type { Product } from '../types';
import { allGroups, draftGroupData, draftGroupPatch, findPartFamilies, groupableProducts } from '../lib/groupBuilder';

const p = (sku: string, displayName: string, extra: Partial<Product> = {}): Product =>
  ({ id: sku, sku, name: displayName, displayName, manufacturer: 'HYDROFLEX', category: 'Dysze', stock: 1, ean: '', ...extra }) as unknown as Product;

const nz = (sku: string, code: string, extra: Partial<Product> = {}) =>
  p(sku, `Dysza 1/4 ${code} - Lechler stal nierdzewna karcher HD HDS`, extra);

describe('dowolne grupy produktów (dysze, części)', () => {
  it('znajduje rodzinę części różniących się kodem na końcu nazwy (od 3 wariantów)', () => {
    const list = [
      nz('N1', '25-055', { imageUrl: 'https://img.example.com/n1.jpg', hasImage: true }),
      nz('N2', '25-040'),
      nz('N3', '15-060'),
      p('X1', 'Dysza 1/8 25-020'),
    ];
    const fam = findPartFamilies(list);
    expect(fam).toHaveLength(1);
    expect(fam[0].name).toBe('Dysza 1/4 - Lechler stal nierdzewna karcher HD HDS');
    expect(fam[0].members.map((m) => m.capText)).toEqual(['15-060', '25-040', '25-055']);
    expect(fam[0].primary.product.sku).toBe('N1');
  });

  it('pomija rodziny za małe i produkty już zgrupowane', () => {
    expect(findPartFamilies([nz('A1', '25-055'), nz('A2', '25-040')])).toHaveLength(0);
    const group = p('GROUP-X', 'Dysza 1/4', { isGroup: true, variants: [{ sku: 'B1' }] as never });
    expect(findPartFamilies([group, nz('B1', '25-055'), nz('B2', '25-040'), nz('B3', '15-060')])).toHaveLength(0);
  });

  it('draft grupy: warianty posortowane naturalnie, wariant główny daje cenę i kategorię', () => {
    const a = p('S1', 'Nypel 10', { category: 'Nyple', manufacturer: 'M', priceSaleGross: 5 });
    const b = p('S2', 'Nypel 2', { category: 'Nyple', manufacturer: 'M', priceSaleGross: 3 });
    const data = draftGroupData({ name: 'Nypel', members: [a, b], primarySku: 'S2' }, 'GROUP-NYPEL');
    expect(data.variants?.map((v) => v.sku)).toEqual(['S2', 'S1']);
    expect(data.priceSaleGross).toBe(3);
    expect(data.meta?.groupPrimarySku).toBe('S2');
    const patch = draftGroupPatch({ ...p('GROUP-NYPEL', 'Nypel'), isGroup: true, category: 'Nyple' } as Product, { name: 'Nypel nowy', members: [a], primarySku: 'S1' });
    expect(patch.displayName).toBe('Nypel nowy');
    expect(patch.variants).toHaveLength(1);
    expect(patch.meta?.groupPrimarySku).toBe('S1');
  });

  it('do grupy można dodać tylko produkty niezgrupowane (edytowana grupa nie blokuje własnych wariantów)', () => {
    const g = { ...p('GROUP-1', 'G'), id: 'g1', isGroup: true, variants: [{ sku: 'V1' }] } as unknown as Product;
    const v1 = p('V1', 'Wariant 1');
    const free = p('F1', 'Wolny');
    expect(groupableProducts([g, v1, free]).map((x) => x.sku)).toEqual(['F1']);
    expect(groupableProducts([g, v1, free], 'g1').map((x) => x.sku)).toEqual(['V1', 'F1']);
    expect(allGroups([g, v1, free])).toHaveLength(1);
  });
});
