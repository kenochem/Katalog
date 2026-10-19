import type { Product } from '../types';

/**
 * Walidacje jakości danych produktu: poprawność EAN (długość i suma kontrolna GS1), duplikaty EAN i nazw,
 * spójność cen i długość tytułu. Wyniki trafiają do Uzupełniania danych i Statystyk.
 */
export type ValidationKind = 'eanBad' | 'dupEan' | 'dupName' | 'priceBelow' | 'priceMismatch' | 'titleLong' | 'nameFormat';

export const VALIDATION_LABEL: Record<ValidationKind, string> = {
  eanBad: 'Błędny EAN',
  dupEan: 'Duplikat EAN',
  dupName: 'Duplikat nazwy',
  priceBelow: 'Sprzedaż poniżej zakupu',
  priceMismatch: 'Niespójne ceny netto/brutto',
  titleLong: 'Za długi tytuł',
  nameFormat: 'Nazwa do poprawy',
};

export const VALIDATION_KINDS = Object.keys(VALIDATION_LABEL) as ValidationKind[];

/** Maksymalna zalecana długość tytułu oferty (Allegro i większość marketplace’ów: 75). */
export const TITLE_MAX = 75;

export interface ValidationFinding {
  kind: ValidationKind;
  /** Krótki opis problemu (do plakietki). */
  label: string;
  tone: 'danger' | 'warn' | 'info';
}

export type EanCheck = 'empty' | 'ok' | 'length' | 'digits' | 'checksum';

/** Suma kontrolna GS1 (EAN-8 / UPC-A / EAN-13 / GTIN-14). */
export function gs1CheckDigitOk(digits: string): boolean {
  if (!/^\d+$/.test(digits) || ![8, 12, 13, 14].includes(digits.length)) return false;
  const body = digits.slice(0, -1);
  let sum = 0;
  for (let i = 0; i < body.length; i++) {
    const d = Number(body[body.length - 1 - i]);
    sum += d * (i % 2 === 0 ? 3 : 1);
  }
  return (10 - (sum % 10)) % 10 === Number(digits[digits.length - 1]);
}

export function checkEan(raw: string | undefined | null): EanCheck {
  const v = (raw ?? '').trim();
  if (!v) return 'empty';
  if (!/^\d+$/.test(v)) return 'digits';
  if (![8, 12, 13, 14].includes(v.length)) return 'length';
  return gs1CheckDigitOk(v) ? 'ok' : 'checksum';
}

const EAN_REASON: Record<Exclude<EanCheck, 'empty' | 'ok'>, string> = {
  digits: 'zawiera znaki inne niż cyfry',
  length: 'zła długość (8, 12, 13 lub 14 cyfr)',
  checksum: 'nie zgadza się cyfra kontrolna',
};

export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export interface ValidationContext {
  /** EAN → zbiór różnych SKU, które go używają. */
  eanSkus: Map<string, Set<string>>;
  /** Znormalizowana nazwa → zbiór różnych SKU. */
  nameSkus: Map<string, Set<string>>;
}

/** Przygotowuje mapy duplikatów dla całej listy (jedno przejście). */
export function buildValidationContext(products: Product[]): ValidationContext {
  const eanSkus = new Map<string, Set<string>>();
  const nameSkus = new Map<string, Set<string>>();
  for (const p of products) {
    if (p.isGroup) continue;
    const ean = (p.ean ?? '').trim();
    if (ean) {
      const s = eanSkus.get(ean) ?? new Set<string>();
      s.add(p.sku);
      eanSkus.set(ean, s);
    }
    const nn = normalizeName(p.displayName || p.name || '');
    if (nn.length >= 8) {
      const s = nameSkus.get(nn) ?? new Set<string>();
      s.add(p.sku);
      nameSkus.set(nn, s);
    }
  }
  return { eanSkus, nameSkus };
}

const vatOf = (p: Product) => (typeof p.meta?.vatRate === 'number' ? p.meta.vatRate : 23);

/** Wszystkie problemy jakości dla jednego produktu. */
export function validateProduct(p: Product, ctx: ValidationContext): ValidationFinding[] {
  const out: ValidationFinding[] = [];

  const ean = checkEan(p.ean);
  if (ean !== 'empty' && ean !== 'ok') {
    out.push({ kind: 'eanBad', label: `błędny EAN: ${EAN_REASON[ean]}`, tone: 'danger' });
  }
  const eanKey = (p.ean ?? '').trim();
  if (eanKey) {
    const others = ctx.eanSkus.get(eanKey);
    if (others && others.size > 1) {
      const list = [...others].filter((s) => s !== p.sku).slice(0, 3);
      out.push({ kind: 'dupEan', label: `duplikat EAN (też: ${list.join(', ')})`, tone: 'danger' });
    }
  }
  const nn = normalizeName(p.displayName || p.name || '');
  const nameSet = nn ? ctx.nameSkus.get(nn) : undefined;
  if (nameSet && nameSet.size > 1) {
    const list = [...nameSet].filter((s) => s !== p.sku).slice(0, 3);
    out.push({ kind: 'dupName', label: `duplikat nazwy (też: ${list.join(', ')})`, tone: 'warn' });
  }

  const net = p.priceSaleNet;
  const gross = p.priceSaleGross;
  const buy = p.pricePurchaseNet;
  if (net != null && buy != null && net > 0 && buy > 0 && net < buy) {
    out.push({ kind: 'priceBelow', label: 'sprzedaż netto poniżej zakupu', tone: 'danger' });
  }
  if (net != null && gross != null && net > 0 && gross > 0) {
    const expected = net * (1 + vatOf(p) / 100);
    if (Math.abs(gross - expected) > 0.05 && Math.abs(gross - expected) / expected > 0.02) {
      out.push({ kind: 'priceMismatch', label: 'brutto nie pasuje do netto i VAT', tone: 'warn' });
    }
  }

  const title = (p.displayName || '').trim();
  if (title.length > TITLE_MAX) {
    out.push({ kind: 'titleLong', label: `tytuł ${title.length} zn. (zalecane do ${TITLE_MAX})`, tone: 'info' });
  }
  const raw = p.displayName || '';
  const letters = raw.replace(/[^A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż]/g, '');
  if (/\s{2,}/.test(raw) || raw !== raw.trim()) {
    out.push({ kind: 'nameFormat', label: 'nazwa: zbędne spacje', tone: 'info' });
  } else if (letters.length >= 8 && letters === letters.toUpperCase()) {
    out.push({ kind: 'nameFormat', label: 'nazwa: same wielkie litery', tone: 'info' });
  }
  return out;
}
