import { beforeEach, describe, expect, it } from 'vitest';
import { isImageHostDown, recordImageError, recordImageOk, resetImageHostHealth } from '../lib/imageHostHealth';

const u = (n: number) => `https://shop.example.com/uploads/img-${n}.png`;

describe('bezpiecznik hostów zdjęć', () => {
  beforeEach(() => resetImageHostHealth());

  it('po kilku różnych błędach bez sukcesu host uznawany jest za niedostępny, a potem wygasa', () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 5; i++) recordImageError(u(i), t0 + i);
    expect(isImageHostDown(u(99), t0 + 10)).toBe(false);
    recordImageError(u(5), t0 + 6);
    expect(isImageHostDown(u(99), t0 + 10)).toBe(true);
    expect(isImageHostDown(u(99), t0 + 6 * 60_000)).toBe(false);
  });

  it('ten sam adres ładowany wielokrotnie nie liczy się jako awaria hosta', () => {
    for (let i = 0; i < 20; i++) recordImageError(u(1), 5_000_000 + i);
    expect(isImageHostDown(u(1), 5_000_100)).toBe(false);
  });

  it('udane ładowanie zeruje licznik błędów i przywraca host', () => {
    const t0 = 9_000_000;
    for (let i = 0; i < 6; i++) recordImageError(u(i), t0 + i);
    expect(isImageHostDown(u(0), t0 + 10)).toBe(true);
    recordImageOk(u(100));
    expect(isImageHostDown(u(0), t0 + 11)).toBe(false);
  });

  it('własny magazyn zdjęć nigdy nie jest uznawany za niedostępny', () => {
    const own = (n: number) => `https://abc.supabase.co/storage/v1/object/public/product-images/products/${n}.jpg`;
    for (let i = 0; i < 20; i++) recordImageError(own(i), 7_000_000 + i);
    expect(isImageHostDown(own(0), 7_000_100)).toBe(false);
  });
});
