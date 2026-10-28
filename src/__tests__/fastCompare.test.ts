import { describe, expect, it } from 'vitest';

const nativeCompare = String.prototype.localeCompare;
const sample = ['zebra', 'Łódź', 'lampa', 'Ścieżka', 'sciezka', 'A10', 'a2', 'Ala', 'ala', 'żaba', 'zaba', 'Dysza 1/4 25-055', 'Dysza 1/4 25-050', ''];

describe('szybkie localeCompare', () => {
  it('daje takie same wyniki jak natywne dla opcji używanych w katalogu', async () => {
    await import('../lib/fastCompare');
    for (const a of sample) {
      for (const b of sample) {
        const expected = nativeCompare.call(a, b, 'pl', { sensitivity: 'base', numeric: true });
        const got = a.localeCompare(b, 'pl', { sensitivity: 'base', numeric: true });
        expect(Math.sign(got)).toBe(Math.sign(expected));
        expect(Math.sign(a.localeCompare(b, 'pl'))).toBe(Math.sign(nativeCompare.call(a, b, 'pl')));
        expect(Math.sign(a.localeCompare(b))).toBe(Math.sign(nativeCompare.call(a, b)));
      }
    }
  });

  it('nie tworzy nowego Collatora przy każdym porównaniu', async () => {
    await import('../lib/fastCompare');
    const Original = Intl.Collator;
    let created = 0;
    (Intl as { Collator: unknown }).Collator = new Proxy(Original, {
      construct(target, args) {
        created++;
        return Reflect.construct(target, args);
      },
    });
    try {
      const list = Array.from({ length: 2000 }, (_, i) => `Produkt ${(i * 7919) % 2000} ${i % 13 ? 'płyn' : 'żel'}`);
      list.sort((x, y) => x.localeCompare(y, 'pl', { sensitivity: 'base', numeric: true }));
      expect(created).toBeLessThanOrEqual(1);
    } finally {
      (Intl as { Collator: unknown }).Collator = Original;
    }
  });
});
