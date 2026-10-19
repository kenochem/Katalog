import { describe, expect, it } from 'vitest';
import { dHashFromRGBA, hashDistance, isSameImage } from '../lib/imageHash';

/** Syntetyczny „produkt”: ciemna butelka o zadanym kształcie na białym tle, w dowolnym rozmiarze i marginesie. */
function bottle(size: number, margin: number, shade = 30): { data: Uint8ClampedArray; w: number; h: number } {
  const data = new Uint8ClampedArray(size * size * 4).fill(255);
  const inner = size - margin * 2;
  for (let y = margin; y < size - margin; y++) {
    for (let x = margin; x < size - margin; x++) {
      const u = (x - margin) / inner;
      const v = (y - margin) / inner;
      // wąska szyjka u góry, szerokie ciało, jaśniejsza etykieta w środku
      const widthAt = v < 0.25 ? 0.18 : 0.5;
      if (Math.abs(u - 0.5) < widthAt) {
        const label = v > 0.45 && v < 0.75 && Math.abs(u - 0.5) < 0.3;
        const c = label ? 150 : shade;
        const i = (y * size + x) * 4;
        data[i] = data[i + 1] = data[i + 2] = c;
        data[i + 3] = 255;
      }
    }
  }
  return { data, w: size, h: size };
}

function stripes(size: number): { data: Uint8ClampedArray; w: number; h: number } {
  const data = new Uint8ClampedArray(size * size * 4).fill(255);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const dark = Math.floor(x / (size / 6)) % 2 === 0 && y > size * 0.2;
      const i = (y * size + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = dark ? 20 : 240;
    }
  return { data, w: size, h: size };
}

describe('hash percepcyjny zdjęć', () => {
  it('to samo zdjęcie w innym rozmiarze i z marginesem ma prawie ten sam hash', () => {
    const a = bottle(160, 8);
    const b = bottle(100, 22); // przeskalowane, więcej białego marginesu
    const d = hashDistance(dHashFromRGBA(a.data, a.w, a.h), dHashFromRGBA(b.data, b.w, b.h));
    expect(d).toBeLessThanOrEqual(10);
  });

  it('przezroczyste tło traktowane jak białe', () => {
    const a = bottle(120, 10);
    const t = new Uint8ClampedArray(a.data);
    for (let i = 0; i < t.length; i += 4) {
      if (t[i] === 255) {
        t[i] = 0;
        t[i + 1] = 0;
        t[i + 2] = 0;
        t[i + 3] = 0; // przezroczysty
      }
    }
    expect(isSameImage(dHashFromRGBA(a.data, 120, 120), dHashFromRGBA(t, 120, 120))).toBe(true);
  });

  it('zupełnie inne zdjęcie ma wyraźnie inny hash', () => {
    const a = bottle(160, 8);
    const b = stripes(160);
    expect(hashDistance(dHashFromRGBA(a.data, a.w, a.h), dHashFromRGBA(b.data, b.w, b.h))).toBeGreaterThan(10);
  });

  it('odległość: identyczne = 0, hashe różnej długości = maksimum', () => {
    expect(hashDistance('ffff', 'ffff')).toBe(0);
    expect(hashDistance('0000', 'ffff')).toBe(16);
    expect(hashDistance('ff', 'ffff')).toBe(64);
  });
});
