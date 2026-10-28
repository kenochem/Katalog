import { describe, expect, it } from 'vitest';
import type { Product } from '../types';
import { attributesFor, type AttributeDef } from '../lib/attributes';
import {
  SEGMENT_ATTRIBUTES,
  TYPE_CHEM,
  TYPE_CLEAN,
  TYPE_FOAM,
  TYPE_HYGIENE,
  TYPE_MACHINE,
  TYPE_PART,
  TYPE_SCENT,
  TYPE_SERVICE,
  classifyProduct,
  newAttrValues,
  proposeSegmentation,
  threadsOf,
} from '../lib/segmentation';

const p = (displayName: string, manufacturer = '', category = ''): Product =>
  ({ id: displayName, sku: displayName, name: displayName, displayName, manufacturer, category }) as unknown as Product;

describe('segregacja: typ towaru i grupa części', () => {
  it('rozpoznaje rzeczownik główny (najwcześniejsze słowo)', () => {
    expect(classifyProduct(p('Płyn do mycia podłóg 5L')).type).toBe(TYPE_CHEM);
    expect(classifyProduct(p('Dysza 1/4 25-055 - Lechler stal nierdzewna karcher HD HDS'))).toMatchObject({ type: TYPE_PART, group: 'Dysze' });
    expect(classifyProduct(p('Wąż do myjki Karcher 20m złącze Bayonet'))).toMatchObject({ type: TYPE_PART, group: 'Węże i bębny' });
    expect(classifyProduct(p('Pianownica do myjki Karcher 2L')).type).toBe(TYPE_FOAM);
    expect(classifyProduct(p('Aroma Patyczki zapachowe 100ml - Mrożona Herbata')).type).toBe(TYPE_SCENT);
    expect(classifyProduct(p('Z-Z RĘCZNIK 2W 4000 folia biały')).type).toBe(TYPE_HYGIENE);
    expect(classifyProduct(p('USŁUGA - DOJAZD')).type).toBe(TYPE_SERVICE);
    expect(classifyProduct(p('COMET MYJKA KL 1600 Classic')).type).toBe(TYPE_MACHINE);
    expect(classifyProduct(p('Wiadro z pokrywą 30L Transparentne')).type).toBe(TYPE_CLEAN);
    expect(classifyProduct(p('Myjka Ściągaczka teleskopowa 1,2m')).type).toBe(TYPE_CLEAN);
  });

  it('piana aktywna z zapachem to chemia, a ogólne słowa części liczą się tylko w świecie myjek', () => {
    expect(classifyProduct(p('Kenotek CARGO 2800 + 25L - aktywna piana zapachowa')).type).toBe(TYPE_CHEM);
    expect(classifyProduct(p('Uchwyt do wycieraczek dywaników')).type).not.toBe(TYPE_PART);
    expect(classifyProduct(p('Uchwyt do myjki K250', 'HYDROFLEX'))).toMatchObject({ type: TYPE_PART, group: 'Obudowy i elementy' });
  });

  it('bez słowa kluczowego: pojemność → chemia (do sprawdzenia), inaczej Inne', () => {
    expect(classifyProduct(p('EILFIX ECO 5004 S 10L'))).toMatchObject({ type: TYPE_CHEM, confidence: 'low' });
    expect(classifyProduct(p('Zestaw Żarówek 1v z H7')).type).toBe('Inne');
  });
});

describe('segregacja: właściwości z nazwy', () => {
  it('dysza: kąt rozpylania, rozmiar, materiał, marka myjki', () => {
    const s = proposeSegmentation(p('Dysza 1/4 15-060 - Lechler stal nierdzewna karcher HD HDS'));
    expect(s.attrs).toMatchObject({ typ_towaru: TYPE_PART, grupa_czesci: 'Dysze', kat_rozpylania: 15, rozmiar_dyszy: '060', material: 'Stal nierdzewna', pasuje_do: 'Karcher' });
  });

  it('wąż: długość i ciśnienie', () => {
    const s = proposeSegmentation(p('WĄŻ CIŚNIEN. 8 x 2 400bar 20m czarny'));
    expect(s.attrs).toMatchObject({ grupa_czesci: 'Węże i bębny', dlugosc_m: 20, cisnienie_max_bar: 400 });
  });

  it('chemia: pojemność w ml, masa w g i forma', () => {
    expect(proposeSegmentation(p('K2 FELIX Płyn do mycia felg 750 ml')).attrs).toMatchObject({ pojemnosc_ml: 750, forma_produktu: 'Płyn' });
    expect(proposeSegmentation(p('ACTIVE FOAM MAGIC 22kg - aktywna piana')).attrs).toMatchObject({ masa_g: 22000, forma_produktu: 'Piana / pianka' });
    expect(proposeSegmentation(p('Pianownica LS3 M22 2L - do myjki Karcher HD HDS Lavor')).attrs).toMatchObject({ pojemnosc_ml: 2000, gwint: 'M22', pasuje_do: 'Karcher, Lavor' });
  });

  it('gwint: kilka oznaczeń', () => {
    expect(threadsOf('PISTOLET AURA GW3/8-GW1/4 z obrotem')).toBe('GW3/8 / GW1/4');
    expect(threadsOf('Adapter K-Lock z nakrętką M22 - TR22M')).toBe('M22');
  });

  it('nowe wartości: tylko puste albo (przy nadpisaniu) inne', () => {
    expect(newAttrValues({ typ_towaru: 'Inne' }, { typ_towaru: TYPE_CHEM, pojemnosc_ml: 500 }, false)).toEqual({ pojemnosc_ml: 500 });
    expect(newAttrValues({ typ_towaru: 'Inne' }, { typ_towaru: TYPE_CHEM, pojemnosc_ml: 500 }, true)).toEqual({ typ_towaru: TYPE_CHEM, pojemnosc_ml: 500 });
  });
});

describe('atrybuty zależne (showWhen)', () => {
  it('Grupa części pojawia się dopiero dla typu „Część”', () => {
    const defs = SEGMENT_ATTRIBUTES as AttributeDef[];
    const prod = (attrs: Record<string, string>) => ({ ...p('x'), meta: { attrs } }) as unknown as Product;
    const keys = (attrs: Record<string, string>) => attributesFor(prod(attrs), defs).map((d) => d.key);
    expect(keys({})).toEqual(expect.arrayContaining(['typ_towaru', 'przeznaczenie']));
    expect(keys({})).not.toContain('grupa_czesci');
    expect(keys({ typ_towaru: TYPE_PART })).toContain('grupa_czesci');
    expect(keys({ typ_towaru: TYPE_PART })).not.toContain('kat_rozpylania');
    expect(keys({ typ_towaru: TYPE_PART, grupa_czesci: 'Dysze' })).toContain('kat_rozpylania');
    expect(keys({ typ_towaru: TYPE_CHEM })).toContain('pojemnosc_ml');
  });
});
