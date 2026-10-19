import { describe, expect, it } from 'vitest';
import { fileKey, imageKey, planImagePull, pullCandidates } from '../lib/blImagePull';

describe('klucze zdjęć', () => {
  it('ignoruje protokół, parametry i wielkość liter', () => {
    expect(imageKey('HTTPS://Cdn.x/A/b.JPG?v=123#x')).toBe('cdn.x/a/b.jpg');
  });
  it('nazwa pliku bez rozszerzenia (png → jpg to to samo zdjęcie)', () => {
    expect(fileKey('https://a/x/CIDL0038-1.png')).toBe('cidl0038-1');
    expect(fileKey('https://b/y/cidl0038-1.jpg?z=1')).toBe('cidl0038-1');
  });
});

describe('plan zaciągnięcia zdjęć z BaseLinkera', () => {
  it('produkt tylko z dodatkowymi grafikami i martwym głównym dostaje główne z BL', () => {
    const plan = planImagePull(
      { imageUrl: 'https://rajci/old/CIDL0038.png', customImageUrl: '', extraImageUrls: ['https://ok/extra1.jpg'] },
      pullCandidates(['https://bl/cdn/CIDL0038.jpg', 'https://ok/extra1.jpg'], [], ['https://rajci/old/CIDL0038.png']),
      ['https://rajci/old/CIDL0038.png'],
    );
    expect(plan.imageUrl).toBe('https://bl/cdn/CIDL0038.jpg');
    expect(plan.extraImageUrls).toEqual(['https://ok/extra1.jpg']);
    expect(plan.removed).toEqual(['https://rajci/old/CIDL0038.png']);
    expect(plan.added).toEqual(['https://bl/cdn/CIDL0038.jpg']);
    expect(plan.changed).toBe(true);
  });

  it('działające zdjęcia zostają, nowe z BL trafiają do dodatkowych', () => {
    const plan = planImagePull({ imageUrl: 'https://a/x.jpg', extraImageUrls: [] }, ['https://a/x.jpg', 'https://bl/y.jpg']);
    expect(plan.imageUrl).toBe('https://a/x.jpg');
    expect(plan.extraImageUrls).toEqual(['https://bl/y.jpg']);
    expect(plan.removed).toEqual([]);
  });

  it('dokłada zdjęcia wskazane przez serwer jako brakujące, także gdy mają tę samą nazwę pliku w innym folderze', () => {
    const plan = planImagePull(
      { imageUrl: 'https://wp/a/image.jpg', extraImageUrls: [] },
      pullCandidates(['https://bl/p1/image.jpg', 'https://bl/p2/image.jpg'], ['https://bl/p1/image.jpg', 'https://bl/p2/image.jpg']),
    );
    expect(plan.added).toEqual(['https://bl/p1/image.jpg', 'https://bl/p2/image.jpg']);
  });

  it('kandydaci: martwy link ma odpowiednik w BL pod tą samą nazwą pliku', () => {
    expect(pullCandidates(['https://bl/x.jpg', 'https://bl/y.jpg'], [], ['https://dead/x.png'])).toEqual(['https://bl/x.jpg']);
  });

  it('produkt bez żadnych zdjęć dostaje pierwsze z BL jako główne', () => {
    const plan = planImagePull({ imageUrl: '', extraImageUrls: [] }, ['https://bl/a.jpg', 'https://bl/b.jpg']);
    expect(plan.imageUrl).toBe('https://bl/a.jpg');
    expect(plan.extraImageUrls).toEqual(['https://bl/b.jpg']);
  });

  it('martwy link bez zamiennika w BL: usuwa go, a pierwszy dodatkowy awansuje na główne', () => {
    const plan = planImagePull(
      { imageUrl: 'https://dead/a.png', extraImageUrls: ['https://ok/b.jpg'] },
      [],
      ['https://dead/a.png'],
    );
    expect(plan.imageUrl).toBe('https://ok/b.jpg');
    expect(plan.extraImageUrls).toEqual([]);
  });

  it('bez zmian, gdy nic nie brakuje i nic nie jest martwe', () => {
    const plan = planImagePull({ imageUrl: 'https://a/x.jpg', extraImageUrls: ['https://a/y.jpg'] }, ['https://a/x.jpg']);
    expect(plan.changed).toBe(false);
  });
});
