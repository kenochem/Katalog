import { describe, expect, it } from 'vitest';
import type { Product } from '../types';
import { collapseGroupMembers } from '../lib/search';

const p = (id: string, sku: string, extra: Partial<Product> = {}): Product =>
  ({ id, sku, name: sku, displayName: sku, ean: '', ...extra }) as unknown as Product;

const group = p('g1', 'GRP', { isGroup: true, variants: [{ sku: 'A1' }, { sku: 'A2' }] as never });
const a1 = p('a1', 'A1');
const a2 = p('a2', 'A2');
const other = p('o1', 'OTHER');
const all = [group, a1, a2, other];

describe('warianty grup na liście katalogu', () => {
  it('chowa warianty, gdy grupa jest na liście', () => {
    expect(collapseGroupMembers(all, all, '').map((x) => x.id)).toEqual(['g1', 'o1']);
  });

  it('pokazuje wariant, gdy grupy nie ma w wynikach', () => {
    const res = [a1, other];
    expect(collapseGroupMembers(all, res, '').map((x) => x.id)).toEqual(['a1', 'o1']);
  });

  it('wyszukiwanie po SKU wariantu zachowuje ten wariant', () => {
    expect(collapseGroupMembers(all, all, 'a1').map((x) => x.id)).toEqual(['g1', 'a1', 'o1']);
  });
});
