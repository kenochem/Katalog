import { describe, expect, it } from 'vitest';
import { parseTechName, parseThreads, rebuildDisplayName } from '../lib/techParser';

/** Prawdziwe nazwy z WAPRO → oczekiwana nazwa katalogowa. Gdy parser się zmieni, ten test pokaże, co się zmieniło. */
const NAMES: [string, string][] = [
  ['NYPEL MOSIĄDZ GZ22 - GW3/8', 'Nypel mosiężny M22 M × 3/8 Ż'],
  ['NYPEL STAL GZ3/8 - GZ3/4', 'Nypel stalowy 3/8 M × 3/4 M'],
  ['Nypel stal 1/2m - 1/4ż', 'Nypel stalowy 1/2 M × 1/4 Ż'],
  ['NYPEL STAL OBROTOWY GW3/8 - GW3/8', 'Nypel obrotowy stalowy 3/8 Ż × 3/8 Ż'],
  ['Trójnik Y 3x1/4F', 'Trójnik Y 1/4 Ż × 1/4 Ż × 1/4 Ż'],
  ['Trójnik 3/8-3/8-3/8', 'Trójnik 3/8 × 3/8 × 3/8'],
  ['Kolanko 3/8 M - 3/8 Ż', 'Kolanko 3/8 M × 3/8 Ż'],
  ['REDUKCJA OBROTOWA MOSIĄDZ GW3/8-GZ3/8', 'Redukcja obrotowa mosiężna 3/8 Ż × 3/8 M'],
  ['DYSZA ROTACYJNA ROTJET 255 bar 075', 'Dysza rotacyjna ROTJET 075, 255 bar'],
  ['Dysza strumieniowa wody HB 25-040', 'Dysza wody HB 25-040, bez gwintu'],
  ['Dysza strumieniowa wody 1/4 LP 50-600', 'Dysza wody LP 50-600, 1/4'],
  ['ORING CZARNY 7,00 x 2,00', 'O-ring 7,00 × 2,00 mm'],
  ['Adapter K-Lock TR22M - 3/8 M', 'Adapter K-Lock TR22 M × 3/8 M'],
  ['ZAWÓR BY PASS VRT3  310bar', 'Zawór by-pass'],
  ['MANOMETR D50 315 Bar 1/4', 'Manometr Ø50 315 bar 1/4'],
];

describe('parseTechName — nazwy katalogowe', () => {
  it.each(NAMES)('%s → %s', (name, expected) => {
    expect(parseTechName(name)?.displayName).toBe(expected);
  });

  it('nie używa znaczka cali w nazwach', () => {
    for (const [name] of NAMES) expect(parseTechName(name)?.displayName).not.toContain('″');
  });

  it('pomija produkty spoza obsługiwanych typów', () => {
    expect(parseTechName('Sonax Xtreme 500ml')).toBeNull();
    expect(parseTechName('Zestaw zaworów Hawk - H20')).toBeNull();
    expect(parseTechName('')).toBeNull();
  });
});

describe('parseTechName — pewność parsera', () => {
  it('pewne: komplet gwintów i poprawne rozmiary', () => {
    expect(parseTechName('NYPEL STAL GZ3/8 - GZ3/4')?.confidence).toBe('ok');
  });

  it('do sprawdzenia: literówka w rozmiarze gwintu (3/18)', () => {
    const r = parseTechName('NYPEL STAL OBROTOWY GW3/18 - GZ3/8');
    expect(r?.confidence).toBe('review');
    expect(r?.reasons.join(' ')).toMatch(/Nietypowy rozmiar/);
  });

  it('do sprawdzenia: brak gwintów w nazwie nypla', () => {
    expect(parseTechName('Nypel presostatu')?.confidence).toBe('review');
  });

  it('do sprawdzenia: ostrzega, gdy płeć „damskie” nie zgadza się z gwintem', () => {
    const r = parseTechName('SZYBKOZŁĄCZE KEW DAMSKIE GZ1/4');
    expect(r?.confidence).toBe('review');
  });
});

describe('parseThreads — gwinty', () => {
  it('rozpoznaje płeć i rozmiar z różnych zapisów', () => {
    const t = parseThreads('GZ3/8 - GW1/4');
    expect(t.map((x) => `${x.size} ${x.gender}`)).toEqual(['3/8 M', '1/4 Ż']);
  });

  it('rozwija mnożnik: 3x1/4F → trzy końcówki', () => {
    expect(parseThreads('3x1/4F')).toHaveLength(3);
  });

  it('rozwija „2xGZM22 i 1xGWM22” do M, M, Ż', () => {
    const t = parseThreads('2xGZM22 i 1xGWM22');
    expect(t.map((x) => x.gender)).toEqual(['M', 'M', 'Ż']);
    expect(t.every((x) => x.size === 'M22')).toBe(true);
  });

  it('nie traktuje długości i modeli jako gwintów (1,30; 25x20)', () => {
    expect(parseThreads('LS3 1,30')).toHaveLength(0);
  });
});

describe('rebuildDisplayName', () => {
  it('składa nazwę z parametrów po ręcznej edycji', () => {
    const parsed = parseTechName('NYPEL STAL GZ3/8 - GZ3/4');
    expect(parsed).not.toBeNull();
    const edited = { ...parsed!.attrs, material: 'mosiadz' as const };
    expect(rebuildDisplayName('nypel', 'zwykly', edited)).toBe('Nypel mosiężny 3/8 M × 3/4 M');
  });
});
