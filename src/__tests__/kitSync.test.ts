import { describe, expect, it } from 'vitest';
import type { Kit, Product } from '../types';
import { buildProductLookup } from '../lib/kitResolve';
import { isInBaselinker } from '../lib/kitSource';
import { blIdOfKit, buildKitSync, diffItems, itemsFromBl, kitAvailability, kitIdForBl, type BlKit } from '../lib/kitSync';

function prod(sku: string, name: string, stock = 10): Product {
  return { id: `shop-${sku}`, sku, name, displayName: name, category: 'x', manufacturer: '', ean: '', imageUrl: '', description: '', hasImage: false, stock, catalog: 'shop' } as Product;
}

const products = [prod('FRE000001', 'Freshtek Joy', 12), prod('FRE000002', 'Freshtek Paczula', 3), prod('FRE000003', 'Freshtek Wanilia', 0)];
const lookup = buildProductLookup(products);

function blKit(blId: number, comps: [number, string, number][], isBundle = true): BlKit {
  return {
    blId,
    sku: `ZEST${blId}`,
    name: `Zestaw ${blId}`,
    isBundle,
    image: '',
    components: comps.map(([id, sku, qty]) => ({ blId: id, sku, name: sku, qty, inInventory: true })),
  };
}

function localKit(blId: number, skus: [string, number][]): Kit {
  return {
    id: kitIdForBl(blId),
    name: `Zestaw ${blId}`,
    description: '',
    category: 'zestawy',
    createdAt: 0,
    items: skus.map(([sku, quantity]) => ({ productId: `shop-${sku}`, sku, name: sku, quantity })),
  };
}

describe('zestawy z BaseLinkera', () => {
  it('rozpoznaje id BaseLinkera zakodowane w id zestawu', () => {
    expect(blIdOfKit(localKit(206122132, []))).toBe(206122132);
    expect(blIdOfKit({ ...localKit(1, []), id: 'kit-123' })).toBeNull();
  });

  it('zestaw własny wysłany do BL (ma blId) jest widoczny jako zestaw w BaseLinkerze i porównywany po blId', () => {
    const own: Kit = { ...localKit(1, [['FRE000001', 1]]), id: 'kit-777', blId: 4242 };
    expect(blIdOfKit(own)).toBe(4242);
    expect(isInBaselinker(own)).toBe(true);
    expect(isInBaselinker({ ...own, blId: undefined })).toBe(false);
    const rows = buildKitSync([blKit(4242, [[10, 'FRE000001', 1]])], [own], lookup);
    expect(rows[0].status).toBe('same');
    expect(rows).toHaveLength(1); // nie tworzy duplikatu jako „nowy”
  });

  it('przelicza skład BL na produkty katalogu i łączy powtórzone SKU', () => {
    const k = blKit(1, [
      [10, 'FRE000001', 1],
      [11, 'FRE000001', 2],
      [12, 'NIEMA', 1],
    ]);
    const { items, unresolved } = itemsFromBl(k, lookup);
    expect(items).toHaveLength(2);
    expect(items.find((i) => i.sku === 'FRE000001')?.quantity).toBe(3);
    expect(unresolved).toEqual(['NIEMA']);
  });

  it('wykrywa różnice: dodane, usunięte i zmienione ilości', () => {
    const local = [
      { productId: 'a', sku: 'A', name: 'A', quantity: 1 },
      { productId: 'b', sku: 'B', name: 'B', quantity: 1 },
    ];
    const proposed = [
      { productId: 'b', sku: 'B', name: 'B', quantity: 3 },
      { productId: 'c', sku: 'C', name: 'C', quantity: 1 },
    ];
    const d = diffItems(local, proposed);
    expect(d.added.map((i) => i.sku)).toEqual(['C']);
    expect(d.removed.map((i) => i.sku)).toEqual(['A']);
    expect(d.changed).toEqual([{ sku: 'B', name: 'B', from: 1, to: 3 }]);
  });

  it('buduje zestawienie: nowy, różni się, zgodny, bez składu, usunięty w BL', () => {
    const bl: BlKit[] = [
      blKit(1, [[10, 'FRE000001', 1]]), // nowy
      blKit(2, [[10, 'FRE000001', 1], [11, 'FRE000002', 2]]), // różni się (lokalnie tylko 1 składnik)
      blKit(3, [[10, 'FRE000001', 1]]), // zgodny
      blKit(4, [], false), // brak składu w BL, a lokalnie istnieje
    ];
    const local: Kit[] = [
      localKit(2, [['FRE000001', 1]]),
      localKit(3, [['FRE000001', 1]]),
      localKit(4, [['FRE000001', 1]]),
      localKit(5, [['FRE000001', 1]]), // nie ma w BL
    ];
    const rows = buildKitSync(bl, local, lookup);
    const status = (key: string) => rows.find((r) => r.key === key)?.status;
    expect(status('new-1')).toBe('new');
    expect(status('kit-2')).toBe('diff');
    expect(status('kit-3')).toBe('same');
    expect(status('nb-4')).toBe('not-bundle');
    expect(status('miss-5')).toBe('missing-in-bl');
  });

  it('nie proponuje zestawu bez składu w BL, jeśli nie mamy go lokalnie', () => {
    const rows = buildKitSync([blKit(9, [], false)], [], lookup);
    expect(rows).toHaveLength(0);
  });
});

describe('dostępność zestawu', () => {
  const avail = (p: Product) => p.stock;

  it('liczy, ile zestawów da się złożyć z najmniej licznego składnika', () => {
    const items = [
      { productId: 'shop-FRE000001', sku: 'FRE000001', name: 'a', quantity: 2 }, // 12 / 2 = 6
      { productId: 'shop-FRE000002', sku: 'FRE000002', name: 'b', quantity: 1 }, // 3 / 1 = 3
    ];
    const r = kitAvailability(items, lookup, avail);
    expect(r?.count).toBe(3);
    expect(r?.limiting).toBe('Freshtek Paczula');
  });

  it('brak składnika na stanie → 0', () => {
    const items = [{ productId: 'shop-FRE000003', sku: 'FRE000003', name: 'c', quantity: 1 }];
    expect(kitAvailability(items, lookup, avail)?.count).toBe(0);
  });

  it('nie ocenia, gdy składnika nie ma w katalogu', () => {
    const items = [{ productId: 'bl-1', sku: 'NIEMA', name: 'x', quantity: 1 }];
    expect(kitAvailability(items, lookup, avail)).toBeNull();
  });
});
