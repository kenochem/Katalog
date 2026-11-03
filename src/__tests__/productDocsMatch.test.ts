import { describe, expect, it } from 'vitest';
import { isImportableDoc, matchDocs, productPartOfFile, uploadNameFor } from '../lib/productDocsMatch';

const prod = (sku: string, name: string, maker: string) => ({ id: sku, sku, name, maker });
const P = [
  prod('C1', 'Kenotek GLOBO 3600 20L - piana aktywna', 'KENOTEK'),
  prod('C2', 'Kenotek GLOBO 3600+ 20L - piana aktywna', 'KENOTEK'),
  prod('C3', 'Kenotek CARGO 2600 25L', 'CID LINES'),
  prod('C4', 'Cid Lines DM CID 5L - chlorowy preparat', 'CID LINES'),
  prod('C5', 'Cid Lines DM CID S 24kg - piana', 'CID LINES'),
  prod('C6', 'Cid Lines FLOC 20L - flokulant', 'CID LINES'),
  prod('K1', 'KENOCHEM KOKPIT MAT 1L', 'KENOCHEM'),
  prod('T1', 'TENZI TEXTIL 1L - Środek do czyszczenia', 'TENZI'),
  prod('T2', 'TENZI DE-FOAM - Neutralizator piany', 'TENZI'),
  prod('T3', 'TENZI NEUTRAL MAGIC FOAM PINK 1L', 'TENZI'),
  prod('T4', 'TENZI BETORAST 10L', 'TENZI'),
];
const skus = (m: { products: { sku: string }[] }) => m.products.map((p) => p.sku).sort();

describe('dopasowanie materiałów do produktów', () => {
  it('wyciąga nazwę produktu z nazwy pliku', () => {
    expect(productPartOfFile('Cid Lines/Alcalu S_266_PL_9.05.pdf')).toBe('Alcalu S');
    expect(productPartOfFile('TENZI/TENZI_dekam-1l_60790f29.pdf')).toBe('dekam-');
  });
  it('numer modelu i plus rozróżniają produkty', () => {
    const r = matchDocs(
      [{ path: 'Cid Lines/Globo 3600_A47_PL_6.01.pdf' }, { path: 'Cid Lines/Globo 3600 Plus_B15_PL_4.01.pdf' }, { path: 'Cid Lines/Cargo 2500_F02_PL_2.01.pdf' }, { path: 'Cid Lines/Cargo 2600_Q73_PL_1.00.pdf' }],
      P,
    );
    expect(r.matches.map((m) => [m.path, skus(m)])).toEqual([
      ['Cid Lines/Globo 3600_A47_PL_6.01.pdf', ['C1']],
      ['Cid Lines/Globo 3600 Plus_B15_PL_4.01.pdf', ['C2']],
      ['Cid Lines/Cargo 2600_Q73_PL_1.00.pdf', ['C3']],
    ]);
    expect(r.unmatched).toEqual(['Cid Lines/Cargo 2500_F02_PL_2.01.pdf']);
  });
  it('wariant nazwy (S, Ultra, +) nie dostaje karty innego produktu', () => {
    const r = matchDocs([{ path: 'Cid Lines/DM Cid S_24_PL_12.03.pdf' }, { path: 'Cid Lines/Floc Ultra_F66_PL_1.03.pdf' }], P);
    expect(r.matches.map((m) => skus(m))).toEqual([['C5']]);
  });
  it('marka folderu musi zgadzać się z producentem produktu', () => {
    const r = matchDocs([{ path: 'TENZI/TENZI_tenzi_detailer_kokpit_mat_alure_rodek_do_piel_gnacji_0_6l_8bc12fb7.pdf' }], P);
    expect(r.matches).toEqual([]);
  });
  it('slug sklepowy dopasowuje po początku nazwy, a pojemność rozstrzyga remis', () => {
    const r = matchDocs(
      [
        { path: 'TENZI/TENZI_tenzi_neutral_magic_foam_pink_piana_aktywna_do_mycia_aut_5l_1d008668.pdf' },
        { path: 'TENZI/TENZI_tenzi_betorast_rodek_do_usuwania_betonu_rdzy_cementu_10l_d10e1951.pdf' },
        { path: 'TENZI/TENZI_tenzi_betorast_strong_rodek_do_usuwania_betonu_rdzy_cementu_koncentrat_5l_3015f146.pdf' },
        { path: 'TENZI/TENZI_textil-1l_2cb42f4c.pdf' },
      ],
      P,
    );
    const byPath = Object.fromEntries(r.matches.map((m) => [m.path.slice(6, 30), skus(m)]));
    expect(Object.values(byPath)).toEqual([['T3'], ['T4'], ['T1']]);
  });
});

describe('nazwy produktów z opisem i pojemnością', () => {
  it('opis po pojemności i literówka w marce nie psują dopasowania', () => {
    const r = matchDocs(
      [{ path: 'Cid Lines/Active Foam Cherry_199_PL_3.05.pdf' }, { path: 'Cid Lines/Cargo 2800 plus_I61_PL_3.01.pdf' }, { path: 'Cid Lines/AD 50 Active Wash_E42_PL_1.01.pdf' }],
      [prod('A', 'Kenotek ACTIVE FOAM CHERRY 20L-  kwaśna piana aktywna', 'KENOTEK'), prod('B', 'Kenotk CARGO 2800 + 25L - aktywna piana', 'KENOTEK'), prod('C', 'Kenotek AD50 ACTIVEWASH 25kg - do wody', 'KENOTEK')],
    );
    expect(r.matches.map((m) => skus(m))).toEqual([['A'], ['B'], ['C']]);
  });
});

describe('materiały innych marek', () => {
  const K = [
    prod('K2000048', 'K2 EVOS Drewniana zawieszka - Sparta', 'K2'),
    prod('K2000014', 'K2 BONO BLACK Czernidło do opon 250 ml', 'K2'),
    prod('CART0125', 'CARTEC REFINISH FINAL CUT 9000 150ml step cut', 'CARTEC'),
    prod('ECO000001', 'Eco Shine TOILET SEPT 1L - dezynfekcja', 'ECO SHINE'),
  ];
  it('SKU w nazwie pliku wskazuje produkt bez względu na folder', () => {
    const r = matchDocs([{ path: 'materialy_produktowe/K2/KARTY_PRODUKTU/EVOS/K2000048_K2_EVOS_KARTA_PRODUKTU.pdf' }], K);
    expect(r.matches.map((m) => skus(m))).toEqual([['K2000048']]);
  });
  it('nazwa w pliku jest początkiem nazwy produktu, pojemność i kod nie przeszkadzają', () => {
    const r = matchDocs(
      [
        { path: 'materialy_produktowe/K2/KARTY_PRODUKTU/K2 BONO BLACK 250 ML.pdf' },
        { path: 'materialy_produktowe/CARTEC/TDS/REFL90 Final Cut 9000 (ENG).pdf' },
        { path: 'materialy_produktowe/ECO SHINE/TDS/TOILET SEPT - TOILET SEPT karta techniczna (122 KB).pdf' },
      ],
      K,
    );
    expect(r.matches.map((m) => skus(m))).toEqual([['K2000014'], ['CART0125'], ['ECO000001']]);
  });
  it('rozpoznaje importowalne dokumenty i pomija zdjęcia, pakiety zbiorcze oraz archiwa', () => {
    expect(isImportableDoc('K2/KARTY_PRODUKTU/K2 BONO.pdf')).toBe(true);
    expect(isImportableDoc('K2/ZDJECIA/foto.jpg')).toBe(false);
    expect(isImportableDoc('K2/K2_KARTY_PRODUKTU_ZBIORCZE.pdf')).toBe(false);
    expect(isImportableDoc('K2/ETYKIETY/K2 AKRA 5 KG.zip')).toBe(false);
  });
  it('typ dokumentu trafia do nazwy pliku, żeby KCH i karta o tej samej nazwie się nie nadpisały', () => {
    expect(uploadNameFor('K2/KARTY_PRODUKTU/K2 AKRA 750 ML.pdf')).toBe('Karta produktu - K2 AKRA 750 ML.pdf');
    expect(uploadNameFor('K2/INFORMACJE_BEZPIECZENSTWA/K2 AKRA 750 ML.pdf')).toBe('KCH - K2 AKRA 750 ML.pdf');
    expect(uploadNameFor('Cid Lines/Alcalu S_266_PL_9.05.pdf')).toBe('Alcalu S_266_PL_9.05.pdf');
  });
});
