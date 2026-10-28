import { describe, expect, it } from 'vitest';
import type { Product } from '../types';
import { buildGroupData, findVariantFamilies, groupSkuFor, pickPrimary, stripCapacity, withPrimary } from '../lib/variantGroups';

const p = (sku: string, displayName: string, extra: Partial<Product> = {}): Product =>
  ({ id: sku, sku, name: displayName, displayName, manufacturer: 'KALA', category: 'Olejki', stock: 1, ean: '', ...extra }) as unknown as Product;

describe('grupy wariantów po pojemności', () => {
  it('usuwa pojemność z nazwy', () => {
    expect(stripCapacity('Kala Chanti Cashmere 500ml - olejek zapachowy')).toBe('Kala Chanti Cashmere - olejek zapachowy');
    expect(stripCapacity('Olejek Zapachowy Do Dyfuzora - Amber 100ml')).toBe('Olejek Zapachowy Do Dyfuzora - Amber');
    expect(stripCapacity('Aroma Patyczki 100ml - Babka')).toBe('Aroma Patyczki - Babka');
  });

  it('grupuje ten sam zapach w różnych pojemnościach, a wariantem głównym jest 500 ml', () => {
    const list = [
      p('K1', 'Kala Chanti Cashmere 100ml - olejek zapachowy', { imageUrl: 'https://img.example.com/a.jpg', hasImage: true }),
      p('K2', 'Kala Chanti Cashmere 500ml - olejek zapachowy', { imageUrl: 'https://img.example.com/b.jpg', hasImage: true }),
      p('K3', 'Kala Chanti Cashmere 1 kg - olejek zapachowy', { imageUrl: 'https://img.example.com/c.jpg', hasImage: true }),
      p('K4', 'Kala Chanti Delice 100ml - olejek zapachowy'),
    ];
    const { families } = findVariantFamilies(list);
    expect(families).toHaveLength(1);
    const f = families[0];
    expect(f.members.map((m) => m.product.sku)).toEqual(['K1', 'K2', 'K3']);
    expect(f.primary.product.sku).toBe('K2');
    expect(f.imageUrl).toBe('https://img.example.com/b.jpg');
    const data = buildGroupData(f, 'GROUP-X');
    expect(data.variants?.map((v) => v.sku)).toEqual(['K1', 'K2', 'K3']);
    expect(data.meta?.groupPrimarySku).toBe('K2');
    expect(data.stock).toBe(3);
  });

  it('bez zdjęcia 500 ml bierze zdjęcie innego wariantu i pozwala zmienić główny', () => {
    const list = [p('K1', 'Kala X Y Z 100ml - olejek', { imageUrl: 'https://img.example.com/a.jpg', hasImage: true }), p('K2', 'Kala X Y Z 500ml - olejek')];
    const f = findVariantFamilies(list).families[0];
    expect(f.imageFromPrimary).toBe(false);
    expect(f.imageUrl).toBe('https://img.example.com/a.jpg');
    expect(withPrimary(f, 'K1').imageFromPrimary).toBe(true);
  });

  it('pomija produkty już będące wariantami grupy i duplikaty pojemności', () => {
    const group = p('GROUP-A', 'Kala X Y Z - olejek', { isGroup: true, variants: [{ sku: 'K1', name: 'a' }] as never });
    const list = [group, p('K1', 'Kala X Y Z 100ml - olejek'), p('K2', 'Kala X Y Z 500ml - olejek')];
    expect(findVariantFamilies(list).families).toHaveLength(0);
    const dup = [p('D1', 'Kala Q W E R 100ml - olejek'), p('D2', 'Kala Q W E R 100ml - olejek')];
    expect(findVariantFamilies(dup)).toMatchObject({ families: [], skippedDuplicates: 1 });
  });

  it('SKU grupy jest unikalny', () => {
    const taken = new Set<string>();
    expect(groupSkuFor('Kala Chanti Cashmere - olejek', taken)).toBe('GROUP-KALA-CHANTI-CASHMERE-OLEJEK');
    expect(groupSkuFor('Kala Chanti Cashmere - olejek', taken)).toBe('GROUP-KALA-CHANTI-CASHMERE-OLEJEK-2');
    expect(pickPrimary([{ amount: 100 }, { amount: 300 }, { amount: 1000 }] as never).amount).toBe(300);
  });
});
