import { describe, expect, it } from 'vitest';
import { Brush, Car, Flower2, Package, Target } from 'lucide-react';
import { iconForCategory } from '../lib/categoryIcons';

describe('ikony kategorii', () => {
  it('dobiera ikonę po nazwie, więc zmiana nazwy zmienia ikonę', () => {
    expect(iconForCategory('Olejki do dyfuzorów')).toBe(Flower2);
    expect(iconForCategory('Lance i pistolety')).toBe(Target);
    expect(iconForCategory('Szczotki do mycia samochodu', 'Sprzęt i akcesoria czyszczące › Szczotki, miotły i zmiotki › Szczotki do mycia samochodu')).toBe(Brush);
  });
  it('bez dopasowania nazwy bierze ikonę z działu, a na końcu paczkę', () => {
    expect(iconForCategory('Xyz', 'Chemia samochodowa › Abc › Xyz')).toBe(Car);
    expect(iconForCategory('Xyz')).toBe(Package);
  });
});
