import { describe, expect, it } from 'vitest';
import { collectProductImageCandidates } from '../lib/products';

const HP = (n: string) => `https://kenochem.com/hpeciai/abc/${n}.jpg`;
const WP = (n: string) => `https://kenochem.com/wp-content/uploads/2024/01/${n}.jpg`;

describe('zdjęcia produktu — kopie hpeciai', () => {
  it('gdy są lepsze źródła, kopie hpeciai są pomijane', () => {
    const list = collectProductImageCandidates({ imageUrl: WP('a'), extraImageUrls: [HP('a'), HP('b')] });
    expect(list).toEqual([WP('a')]);
  });

  it('gdy hpeciai to jedyne źródło, służy jako rezerwa (jest podgląd i galeria)', () => {
    const list = collectProductImageCandidates({ imageUrl: HP('main'), extraImageUrls: [HP('1'), HP('2'), HP('1')] });
    expect(list).toEqual([HP('main'), HP('1'), HP('2')]);
  });

  it('brak adresów — pusta lista', () => {
    expect(collectProductImageCandidates({ imageUrl: '', extraImageUrls: [] })).toEqual([]);
  });
});

describe('kolejność zdjęć ustawiana ręcznie', () => {
  const SB = (n: string) => `https://abc.supabase.co/storage/v1/object/public/p/${n}.jpg`;
  const BL = (n: string) => `https://upload.cdn.baselinker.com/${n}.jpg`;

  it('domyślnie zdjęcia dodatkowe są sortowane po hoście', () => {
    const list = collectProductImageCandidates({ customImageUrl: WP('main'), extraImageUrls: [BL('b'), SB('a')] });
    expect(list).toEqual([WP('main'), SB('a'), BL('b')]);
  });

  it('z keepOrder zostaje kolejność zapisana przez użytkownika', () => {
    const list = collectProductImageCandidates({ customImageUrl: WP('main'), extraImageUrls: [BL('b'), SB('a')] }, { keepOrder: true });
    expect(list).toEqual([WP('main'), BL('b'), SB('a')]);
  });
});

describe('galeria produktu bez zdublowanych zdjęć (katalog akcesoriów i sklep)', () => {
  const HPX = (n: string) => `https://kenochem.com/hpeciai/abc123/${n}.jpg`;
  const WPX = (n: string) => `https://kenochem.com/wp-content/uploads/2026/06/${n}.jpg`;

  it('kopia /hpeciai/ tego samego zdjęcia nie pojawia się drugi raz — w obu katalogach', async () => {
    const { getProductImages } = await import('../lib/products');
    for (const catalog of ['accessories', 'shop'] as const) {
      const product = {
        id: 'x',
        sku: 'X',
        catalog,
        imageUrl: WPX('a_1'),
        extraImageUrls: [WPX('a_2'), HPX('a_2'), WPX('a_3'), HPX('a_3'), WPX('a_2')],
      } as never;
      expect(getProductImages(product)).toEqual([WPX('a_1'), WPX('a_2'), WPX('a_3')]);
    }
  });
});
