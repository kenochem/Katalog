/**
 * Cena jednostkowa na etykiecie półkowej (obowiązek w Polsce): cena za 1 l, 1 kg albo 1 szt.
 * Pojemność / wagę opakowania rozpoznajemy z nazwy produktu („100ml”, „5 L”, „750 g”, „2kg”, „12 szt.”)
 * i można ją poprawić ręcznie przy produkcie na liście do wydruku.
 */

export type PackUnit = 'ml' | 'l' | 'g' | 'kg' | 'szt';

export interface PackSize {
  qty: number;
  unit: PackUnit;
}

export const PACK_UNITS: { id: PackUnit; label: string }[] = [
  { id: 'ml', label: 'ml' },
  { id: 'l', label: 'l' },
  { id: 'g', label: 'g' },
  { id: 'kg', label: 'kg' },
  { id: 'szt', label: 'szt.' },
];

/** Rozpoznaje pierwszą pojemność/wagę w tekście, np. „Płyn 5L” → 5 l; „Pasta 750 g” → 750 g. */
export function parsePackFromText(text: string | undefined | null): PackSize | null {
  const t = String(text || '').replace(/,/g, '.');
  // liczba + jednostka jako osobny „token” (żeby „Aroma 100ml” łapało 100 ml, a „4526_7” nie)
  const re = /(\d+(?:\.\d+)?)\s*(ml|litr(?:y|ów|ow)?|l|kg|g|szt\.?|sztuk)(?![a-ząćęłńóśźż])/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) {
    const qty = Number(m[1]);
    if (!Number.isFinite(qty) || qty <= 0) continue;
    const u = m[2].toLowerCase();
    let unit: PackUnit;
    if (u === 'ml') unit = 'ml';
    else if (u.startsWith('lit') || u === 'l') unit = 'l';
    else if (u === 'kg') unit = 'kg';
    else if (u === 'g') unit = 'g';
    else unit = 'szt';
    return { qty, unit };
  }
  return null;
}

/** Podstawa przeliczenia: litry, kilogramy albo sztuki. */
export function packBase(pack: PackSize): { baseQty: number; baseLabel: '1 l' | '1 kg' | '1 szt.' } {
  switch (pack.unit) {
    case 'ml':
      return { baseQty: pack.qty / 1000, baseLabel: '1 l' };
    case 'l':
      return { baseQty: pack.qty, baseLabel: '1 l' };
    case 'g':
      return { baseQty: pack.qty / 1000, baseLabel: '1 kg' };
    case 'kg':
      return { baseQty: pack.qty, baseLabel: '1 kg' };
    default:
      return { baseQty: pack.qty, baseLabel: '1 szt.' };
  }
}

/** Cena za jednostkę (zł) i jej opis; null gdy brak ceny lub opakowania. */
export function unitPrice(
  price: number | null | undefined,
  pack: PackSize | null | undefined,
): { value: number; label: string } | null {
  if (price == null || !Number.isFinite(price) || price <= 0 || !pack || !(pack.qty > 0)) return null;
  const { baseQty, baseLabel } = packBase(pack);
  if (!(baseQty > 0)) return null;
  return { value: Math.round((price / baseQty) * 100) / 100, label: baseLabel };
}

export function formatPack(pack: PackSize | null | undefined): string {
  if (!pack) return '';
  const q = Number.isInteger(pack.qty) ? String(pack.qty) : String(pack.qty).replace('.', ',');
  return `${q} ${pack.unit === 'szt' ? 'szt.' : pack.unit}`;
}
