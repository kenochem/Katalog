import { describe, expect, it } from 'vitest';
import { marginPercent, inferGrossFromNet, customerGrossPrice, formatMarginPercent } from '../lib/format';
import { parsePackFromText, unitPrice, shortLabelName, formatPack } from '../lib/labelPack';
import { buildWaproOrderPayload } from '../lib/waproOrder';
import type { OrderDraft } from '../lib/orderDraft';

describe('marże i ceny', () => {
  it('marża jak w WAPRO: (sprzedaż − zakup) / sprzedaż', () => {
    expect(marginPercent(60, 100)).toBeCloseTo(40);
    expect(marginPercent(100, 100)).toBe(0);
    expect(marginPercent(120, 100)).toBeCloseTo(-20);
  });

  it('brak ceny sprzedaży → brak marży', () => {
    expect(marginPercent(10, 0)).toBeNull();
    expect(marginPercent(10, undefined)).toBeNull();
    expect(formatMarginPercent(null)).toBe('—');
  });

  it('brutto z netto z VAT 23%', () => {
    expect(inferGrossFromNet(100)).toBe(123);
    expect(customerGrossPrice(undefined, 100)).toBe(123);
    expect(customerGrossPrice(99.99, 100)).toBe(99.99);
  });
});

describe('etykiety: opakowanie i cena jednostkowa', () => {
  it('rozpoznaje pojemność i wagę z nazwy', () => {
    expect(parsePackFromText('Aroma 100ml')).toEqual({ qty: 100, unit: 'ml' });
    expect(parsePackFromText('Płyn 5 L')).toEqual({ qty: 5, unit: 'l' });
    expect(parsePackFromText('Pasta 750 g')).toEqual({ qty: 750, unit: 'g' });
    expect(parsePackFromText('Produkt 1,5 kg')).toEqual({ qty: 1.5, unit: 'kg' });
    expect(parsePackFromText('Bez opakowania')).toBeNull();
  });

  it('cena za 1 l / 1 kg', () => {
    expect(unitPrice(10, { qty: 500, unit: 'ml' })).toEqual({ value: 20, label: '1 l' });
    expect(unitPrice(10, { qty: 250, unit: 'g' })).toEqual({ value: 40, label: '1 kg' });
    expect(unitPrice(null, { qty: 1, unit: 'l' })).toBeNull();
    expect(formatPack({ qty: 1.5, unit: 'kg' })).toBe('1,5 kg');
  });

  it('nazwa na etykiecie jest ucinana od myślnika, ale „CAR-WASH” zostaje', () => {
    expect(shortLabelName('Aroma Patyczki 50ml - Drewno Cedrowe')).toBe('Aroma Patyczki 50ml');
    expect(shortLabelName('Szampon CAR-WASH 1L')).toBe('Szampon CAR-WASH 1L');
  });
});

describe('zamówienie do WAPRO (payload)', () => {
  const base: OrderDraft = {
    clientName: ' Firma Test ',
    note: '',
    updatedAt: 0,
    items: [{ productId: 'a', sku: ' hyd000335 ', displayName: 'Nypel', catalog: 'accessories', quantity: 0 }],
  };

  it('normalizuje SKU i wymusza minimum 1 szt.', () => {
    const r = buildWaproOrderPayload(base);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.payload.items[0].sku).toBe('HYD000335');
      expect(r.payload.items[0].qty).toBe(1);
      expect(r.payload.clientName).toBe('Firma Test');
    }
  });

  it('odrzuca pusty koszyk', () => {
    expect(buildWaproOrderPayload({ ...base, items: [] }).ok).toBe(false);
  });

  it('odrzuca grupy i wiele SKU (trzeba wybrać wariant)', () => {
    const group = { ...base, items: [{ ...base.items[0], sku: 'GROUP-DYSZA-WODY' }] };
    const multi = { ...base, items: [{ ...base.items[0], sku: 'A1,A2' }] };
    expect(buildWaproOrderPayload(group).ok).toBe(false);
    expect(buildWaproOrderPayload(multi).ok).toBe(false);
  });

  it('pusta nazwa klienta → „Klient katalog”', () => {
    const r = buildWaproOrderPayload({ ...base, clientName: '  ' });
    expect(r.ok && r.payload.clientName).toBe('Klient katalog');
  });
});
