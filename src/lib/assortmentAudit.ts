import type { Product } from '../types';
import { getProductDisplayCategory, isGenericSourceCategory, isLikelyProducerCategory } from './catalogCategory';
import { flattenCategories } from './categoryRegistry';
import { effectiveManufacturer } from './waproManufacturers';
import {
  buildCategoryModel,
  buildManufacturerFinder,
  compactKey,
  norm,
  normTitle,
  UNDECIDED,
  type CategoryModel,
} from './assortmentAnalysis';
import { buildValidationContext, validateProduct } from './validations';

/**
 * Pełny audyt asortymentu: dla każdego produktu lista problemów (producent, kategoria, nazwa, gotowość do sklepu)
 * z podpowiedzią poprawki. Wynik można pobrać jako plik i przeanalizować poza aplikacją.
 */
export type AuditArea = 'producent' | 'kategoria' | 'nazwa' | 'sklep' | 'dane';
export type AuditSeverity = 'wysoki' | 'średni' | 'niski';

export interface AuditIssue {
  code: string;
  area: AuditArea;
  severity: AuditSeverity;
  message: string;
  /** Proponowana wartość (kategoria / producent), jeśli da się ją wyliczyć. */
  suggestion?: string;
}

export interface AuditRow {
  sku: string;
  name: string;
  manufacturer: string;
  category: string;
  shopPath: string;
  priceGross: number | null;
  stock: number;
  issues: AuditIssue[];
}

export const AUDIT_CODE_LABEL: Record<string, string> = {
  'M-BRAK': 'Brak producenta',
  'M-OGOLNY': 'Producent ogólny lub nie jest marką',
  'M-INNA-MARKA': 'W nazwie inna marka niż producent',
  'M-WARIANT': 'Producent zapisany w kilku wariantach',
  'K-BRAK': 'Brak kategorii („Do decyzji”)',
  'K-OGOLNA': 'Kategoria ogólna lub nazwa producenta',
  'K-NIE-LISC': 'Kategoria spoza drzewa lub nie najniższego poziomu',
  'K-ROZJAZD': 'Kategoria w kolumnie różni się od ścieżki sklepu',
  'K-MODEL': 'Nazwa wskazuje inną kategorię',
  'N-KROTKA': 'Nazwa zbyt krótka lub pusta',
  'N-UCIETA': 'Nazwa wygląda na uciętą',
  'N-SMIECI': 'Nazwa z techniczną końcówką lub prefiksem',
  'N-POJEMNOSC': 'Brak pojemności lub rozmiaru w nazwie',
  'S-OBRAZ': 'Brak zdjęcia',
  'S-OPIS': 'Brak opisu',
  'S-CENA': 'Brak ceny sprzedaży',
  'S-MARZA': 'Podejrzana marża',
  'D-EAN': 'Brak EAN',
  'D-WALID': 'Błąd walidacji danych',
};

const GENERIC_MANUFACTURERS = new Set([
  'wapro',
  'inne',
  'inni producenci',
  'inny',
  'brak',
  'bez producenta',
  'akcesoria',
  'akcesoria do myjni',
  'akcesoria do sprzatania',
  'dyfuzor elektryczny',
  'chemia',
  'produkt',
  'produkty',
]);

const CAPACITY_RE = /\b\d+([.,]\d+)?\s?(ml|l|litr|litry|kg|g|szt|m|mb|cm|mm|x)\b|\b\d+\s?x\s?\d+/i;
/** Kategorie, w których pojemność / rozmiar w nazwie jest oczekiwana (płyny, chemia). */
const CAPACITY_CATEGORY_HINT = /(chemi|plyn|zel|szampon|wosk|pasta|preparat|odswiez|dezynf|myjni|czyszcz|mleczko|spray)/;

const NON_ALPHA = /[^A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż]/g;

export interface AuditSummary {
  total: number;
  withIssues: number;
  clean: number;
  byCode: { code: string; label: string; area: AuditArea; count: number }[];
  byArea: Record<AuditArea, number>;
}

export interface AuditResult {
  generatedAt: string;
  rows: AuditRow[];
  summary: AuditSummary;
  manufacturers: { name: string; count: number }[];
  categories: { name: string; path: string; count: number; isLeaf: boolean }[];
  trained: number;
}

/** Główne przejście audytu po wszystkich produktach (bez zapisu). */
export function runAudit(products: Product[], model?: CategoryModel): AuditResult {
  const normMemo = new Map<string, string>();
  const nrm = (s: string): string => {
    let v = normMemo.get(s);
    if (v === undefined) {
      v = norm(s);
      normMemo.set(s, v);
    }
    return v;
  };
  const singles = products.filter((p) => !p.isGroup);
  const catModel = model ?? buildCategoryModel(products);
  const findBrand = buildManufacturerFinder(products);
  const ctx = buildValidationContext(products);
  const tree = flattenCategories();
  const leafNames = new Set(tree.filter((c) => c.isLeaf).map((c) => nrm(c.name)));
  const treeNames = new Set(tree.map((c) => nrm(c.name)));

  // producenci: liczność i warianty zapisu
  const mfCount = new Map<string, number>();
  for (const p of singles) {
    const m = effectiveManufacturer(p);
    if (m) mfCount.set(m, (mfCount.get(m) ?? 0) + 1);
  }
  const variantGroups = new Map<string, string[]>();
  for (const name of mfCount.keys()) {
    const k = compactKey(name);
    variantGroups.set(k, [...(variantGroups.get(k) ?? []), name]);
  }
  const variantOf = (name: string) => {
    const g = variantGroups.get(compactKey(name));
    return g && g.length > 1 ? g : null;
  };
  // znane marki do wykrywania „innej marki w nazwie”
  const brandKeys = [...mfCount.entries()]
    .filter(([n, c]) => c >= 3 && !GENERIC_MANUFACTURERS.has(nrm(n)) && nrm(n).length >= 4)
    .map(([n]) => ({ name: n, key: nrm(n) }));

  const rows: AuditRow[] = [];
  const codeCount = new Map<string, AuditIssue>();
  const codeTotals = new Map<string, number>();
  const areaTotals: Record<AuditArea, number> = { producent: 0, kategoria: 0, nazwa: 0, sklep: 0, dane: 0 };
  const catCount = new Map<string, number>();

  for (const p of singles) {
    const issues: AuditIssue[] = [];
    const add = (i: AuditIssue) => {
      issues.push(i);
      codeCount.set(i.code, i);
    };
    const title = (p.displayName || p.name || '').trim();
    const mf = effectiveManufacturer(p);
    const display = getProductDisplayCategory(p);
    const shopPath = typeof p.meta?.shopCategoryPath === 'string' ? p.meta.shopCategoryPath : '';
    const rawCat = (p.category ?? '').trim();
    catCount.set(display, (catCount.get(display) ?? 0) + 1);

    // --- producent ---
    if (!mf) {
      const s = findBrand(p);
      add({ code: 'M-BRAK', area: 'producent', severity: 'wysoki', message: 'produkt nie ma producenta', suggestion: s?.manufacturer });
    } else {
      if (GENERIC_MANUFACTURERS.has(nrm(mf)) || treeNames.has(nrm(mf)) || /\s-\s/.test(mf) || mf.length > 28) {
        const s = findBrand(p);
        add({ code: 'M-OGOLNY', area: 'producent', severity: 'wysoki', message: `„${mf}” nie wygląda na markę`, suggestion: s?.manufacturer });
      } else {
        const hay = ` ${normTitle(p)} `;
        const other = brandKeys.find((b) => b.key !== nrm(mf) && hay.includes(` ${b.key} `));
        if (other && !hay.includes(` ${nrm(mf)} `)) {
          add({ code: 'M-INNA-MARKA', area: 'producent', severity: 'średni', message: `producent „${mf}”, ale w nazwie „${other.name}”`, suggestion: other.name });
        }
      }
      const variants = variantOf(mf);
      if (variants) add({ code: 'M-WARIANT', area: 'producent', severity: 'niski', message: `warianty zapisu: ${variants.join(' / ')}` });
    }

    // --- kategoria ---
    if (display === UNDECIDED) {
      const s = catModel.suggest(p);
      add({ code: 'K-BRAK', area: 'kategoria', severity: 'wysoki', message: 'brak przypisanej kategorii', suggestion: s?.category });
    } else {
      if (isGenericSourceCategory(rawCat) || isLikelyProducerCategory(rawCat, p)) {
        add({ code: 'K-OGOLNA', area: 'kategoria', severity: 'średni', message: `kategoria źródłowa „${rawCat || 'brak'}” jest ogólna lub jest marką` });
      }
      if (!leafNames.has(nrm(display))) {
        add({ code: 'K-NIE-LISC', area: 'kategoria', severity: 'średni', message: `„${display}” nie jest kategorią najniższego poziomu` });
      }
      if (shopPath && rawCat && !isGenericSourceCategory(rawCat) && nrm(shopPath.split(/[>›]/).pop() ?? '') !== nrm(rawCat)) {
        add({ code: 'K-ROZJAZD', area: 'kategoria', severity: 'niski', message: `kolumna „${rawCat}” ≠ ścieżka „${shopPath}”` });
      }
      const s = catModel.suggest(p);
      if (s && s.confidence >= 0.65 && nrm(s.category) !== nrm(display)) {
        add({
          code: 'K-MODEL',
          area: 'kategoria',
          severity: s.confidence >= 0.85 ? 'wysoki' : 'średni',
          message: `jest „${display}”, nazwa wskazuje „${s.category}” (${Math.round(s.confidence * 100)}%, po: ${s.because.join(', ')})`,
          suggestion: s.category,
        });
      }
    }

    // --- nazwa ---
    const letters = title.replace(NON_ALPHA, '').length;
    if (title.length < 8 || letters < 4) {
      add({ code: 'N-KROTKA', area: 'nazwa', severity: 'wysoki', message: `nazwa „${title}” jest za krótka` });
    }
    if (p.name && p.displayName && p.displayName !== p.name && p.displayName.length > 0 && p.name.length > p.displayName.length + 3 && p.name.startsWith(p.displayName)) {
      add({ code: 'N-UCIETA', area: 'nazwa', severity: 'średni', message: 'tytuł jest krótszy od nazwy z WAPRO (uciety?)' });
    } else if (/[,\-–/(]\s*$/.test(title) || (title.length === 50 && !/[.)\d]$/.test(title))) {
      add({ code: 'N-UCIETA', area: 'nazwa', severity: 'średni', message: `nazwa kończy się w pół słowa lub znaku: „…${title.slice(-12)}”` });
    }
    if (/^((Ź|Z)[ -]?Z[ -]|XX|TEST|NIE\b|\*)/i.test(title) || /(\s|^)(ZZ|XXX|DO\s+USUNI[ĘE]CIA)\s*$/i.test(title)) {
      add({ code: 'N-SMIECI', area: 'nazwa', severity: 'średni', message: 'nazwa ma techniczny prefiks/końcówkę (np. ŹZ-, ZZ, XX)' });
    }
    if (CAPACITY_CATEGORY_HINT.test(nrm(`${display} ${rawCat}`)) && !CAPACITY_RE.test(title)) {
      add({ code: 'N-POJEMNOSC', area: 'nazwa', severity: 'niski', message: 'brak pojemności/wagi w nazwie' });
    }

    // --- gotowość do sklepu ---
    if (!(p.hasImage || p.imageUrl || p.customImageUrl)) {
      add({ code: 'S-OBRAZ', area: 'sklep', severity: 'średni', message: 'brak zdjęcia' });
    }
    if (!(p.description ?? '').trim() && !(typeof p.meta?.shortDescription === 'string' && p.meta.shortDescription.trim())) {
      add({ code: 'S-OPIS', area: 'sklep', severity: 'niski', message: 'brak opisu' });
    }
    const gross = p.priceSaleGross ?? null;
    const buy = p.pricePurchaseNet ?? null;
    if (!gross || gross <= 0) {
      add({ code: 'S-CENA', area: 'sklep', severity: 'wysoki', message: 'brak ceny sprzedaży brutto' });
    } else if (buy && buy > 0 && p.priceSaleNet && p.priceSaleNet > 0) {
      const margin = p.priceSaleNet / buy;
      if (margin > 4) add({ code: 'S-MARZA', area: 'sklep', severity: 'niski', message: `marża ${Math.round((margin - 1) * 100)}% — sprawdź cenę zakupu` });
    }
    if (!(p.ean ?? '').trim()) {
      add({ code: 'D-EAN', area: 'dane', severity: 'niski', message: 'brak EAN' });
    }
    for (const v of validateProduct(p, ctx)) {
      if (v.kind === 'eanBad' || v.kind === 'dupEan' || v.kind === 'priceBelow' || v.kind === 'priceMismatch' || v.kind === 'dupName') {
        add({ code: 'D-WALID', area: 'dane', severity: v.tone === 'danger' ? 'wysoki' : 'średni', message: v.label });
      }
    }

    for (const i of issues) {
      codeTotals.set(i.code, (codeTotals.get(i.code) ?? 0) + 1);
      areaTotals[i.area]++;
    }
    rows.push({
      sku: p.sku,
      name: title,
      manufacturer: mf,
      category: display,
      shopPath,
      priceGross: gross,
      stock: p.stock ?? 0,
      issues,
    });
  }

  const withIssues = rows.filter((r) => r.issues.length).length;
  const byCode = [...codeTotals.entries()]
    .map(([code, count]) => ({ code, label: AUDIT_CODE_LABEL[code] ?? code, area: codeCount.get(code)!.area, count }))
    .sort((a, b) => b.count - a.count);

  const catPath = new Map(tree.map((c) => [nrm(c.name), c]));
  return {
    generatedAt: new Date().toISOString(),
    rows,
    summary: { total: rows.length, withIssues, clean: rows.length - withIssues, byCode, byArea: areaTotals },
    manufacturers: [...mfCount.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
    categories: [...catCount.entries()]
      .map(([name, count]) => {
        const info = catPath.get(nrm(name));
        return { name, path: info?.path ?? '', count, isLeaf: info?.isLeaf ?? false };
      })
      .sort((a, b) => b.count - a.count),
    trained: catModel.trained,
  };
}

const csvCell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;

/** CSV z jednym wierszem na problem (łatwy do filtrowania w Excelu). */
export function auditToCsv(result: AuditResult): string {
  const head = ['SKU', 'Nazwa', 'Producent', 'Kategoria', 'Sciezka sklepu', 'Cena brutto', 'Stan', 'Obszar', 'Waznosc', 'Kod', 'Problem', 'Podpowiedz'];
  const lines = [head.map(csvCell).join(';')];
  for (const r of result.rows) {
    for (const i of r.issues) {
      lines.push(
        [r.sku, r.name, r.manufacturer, r.category, r.shopPath, r.priceGross ?? '', r.stock, i.area, i.severity, i.code, i.message, i.suggestion ?? '']
          .map(csvCell)
          .join(';'),
      );
    }
  }
  return '﻿' + lines.join('\r\n');
}

export function downloadText(filename: string, content: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content], { type: `${mime};charset=utf-8` }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
