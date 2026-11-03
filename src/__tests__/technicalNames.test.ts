import { describe, expect, it } from 'vitest';
import { nameDuplicateKey, standardizeTechnicalName } from '../lib/technicalNames';

const std = (raw: string, brand: string | null = null) => standardizeTechnicalName(raw, brand);

describe('standard nazw rodzin technicznych', () => {
  it('nyple: jeden zapis gwintu niezależnie od chaosu w źródle', () => {
    expect(std('NYPEL MOSIĄDZ GZ3/8 - GW1/4')?.name).toBe('Nypel mosiężny GZ 3/8 × GW 1/4');
    expect(std('NYPEL MOSIĄDZ Gw 3/8 - Gw 1/4')?.name).toBe('Nypel mosiężny GW 3/8 × GW 1/4');
    expect(std('NYPEL MOSIĄDZ GZ3/8-GZ1/4')?.name).toBe('Nypel mosiężny GZ 3/8 × GZ 1/4');
    expect(std('NYPEL STAL OBROTOWY GW1/4 - GW3/8')?.name).toBe('Nypel obrotowy stalowy GW 1/4 × GW 3/8');
    expect(std('NYPEL STAL 1 - 1/2')?.name).toBe('Nypel stalowy 1" × 1/2"');
  });

  it('gwint metryczny: GZM22 i GZ22 to M22, ten drugi z adnotacją', () => {
    expect(std('NYPEL MOSIĄDZ GZM22 - GW1/4')?.name).toBe('Nypel mosiężny GZ M22 × GW 1/4');
    const r = std('NYPEL MOSIĄDZ GZ22 - GW3/8');
    expect(r?.name).toBe('Nypel mosiężny GZ M22 × GW 3/8');
    expect(r?.notes.join(' ')).toContain('GZ22 przyjęto jako GZ M22');
  });

  it('Ż i M przy rozmiarze to gwint wewnętrzny i zewnętrzny', () => {
    const r = std('ZŁĄCZE OBROT.90 Ż3/8 - M3/8 mosiądz');
    expect(r?.name).toBe('Złącze obrotowe mosiężne 90 GW 3/8 × GZ 3/8');
  });

  it('podejrzany rozmiar gwintu wymaga sprawdzenia', () => {
    const r = std('NYPEL MOSIĄDZ GW3/18 - GZ3/8');
    expect(r?.confidence).toBe('do sprawdzenia');
  });

  it('lance: rodzaj, materiał zgodny z rodzajem gramatycznym, długość w mm', () => {
    expect(std('LANCA DO OPRYSKU STAL 60cm')?.name).toBe('Lanca stalowa do opryskiwania 600mm');
    expect(std('LANCA GIĘTA 700mm 0702405202')?.name).toBe('Lanca gięta 700mm - 0702405202');
    expect(std('LANCA PROSTA 800')?.name).toBe('Lanca prosta 800mm');
    expect(std('Lanca teleskopowa 40-280cm')?.name).toBe('Lanca teleskopowa 40-280cm');
    expect(std('LANCA DO OPRYSKU TELESKOP 1080/1925')?.name).toBe('Lanca teleskopowa do opryskiwania 1080/1925mm');
  });

  it('węże: przekrój, ciśnienie i długość w stałej kolejności, kolor zgodny z rodzajem', () => {
    expect(std('WĄŻ CIŚNIEN. 8 x 2 400bar 20m czarny')?.name).toBe('Wąż ciśnieniowy 8x2 400bar 20m czarny');
  });

  it('marka na początku zostaje na początku', () => {
    expect(std('HYDROFLEX NYPEL STAL GW1/4 - GW1/4', 'HYDROFLEX')?.name).toBe('HYDROFLEX Nypel stalowy GW 1/4 × GW 1/4');
  });

  it('nazwy spoza rodzin technicznych są pomijane', () => {
    expect(std('Szampon samochodowy 1L')).toBeNull();
  });

  it('nie gubi liczb z nazwy', () => {
    for (const raw of ['PISTOLET MV 925 GW3/8-GZ1/4 zielony obr.', 'DYSZA ROTACYJNA ROTJET 255 bar 060', 'LANCA DO PIANOWANIA LS12 07021105512']) {
      const r = std(raw)!;
      for (const n of raw.match(/\d+/g) ?? []) expect(r.name.replace(/[.,]/g, ' ')).toContain(n.length > 3 ? n : n);
    }
  });

  it('klucz dubla ignoruje kolejność końców przyłącza i wielkość liter', () => {
    const a = std('NYPEL MOSIĄDZ GW1/4 - GZ3/8')!.name;
    const b = std('NYPEL MOSIĄDZ GZ3/8 - GW1/4')!.name;
    expect(a).not.toBe(b);
    expect(nameDuplicateKey(a)).toBe(nameDuplicateKey(b));
  });
});
