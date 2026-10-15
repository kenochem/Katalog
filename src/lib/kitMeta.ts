import type { Kit, Product } from '../types';
import { resolveKitItemProduct, type ProductLookup } from './kitResolve';
import { foldText } from './productSearchIndex';
import { customerGrossPrice } from './format';
import { getProductImage } from './products';

/** Kody katalogowe zestawów (ZST-0001…), wartość, okładki i wyszukiwanie. */

export const KIT_CODE_PREFIX = 'ZST-';

export function formatKitCode(n: number): string {
  return KIT_CODE_PREFIX + String(n).padStart(4, '0');
}

function codeNumber(code: string | undefined): number {
  const m = /^ZST-(\d+)$/i.exec(code ?? '');
  return m ? Number(m[1]) : 0;
}

/** Kolejny wolny kod katalogowy (po największym istniejącym). */
export function nextKitCode(kits: Kit[]): string {
  const max = kits.reduce((acc, k) => Math.max(acc, codeNumber(k.code)), 0);
  return formatKitCode(max + 1);
}

/** Zestawy bez kodu i kody, jakie dostaną (w kolejności od najstarszego). */
export function planKitCodes(kits: Kit[]): { kit: Kit; code: string }[] {
  const missing = kits.filter((k) => !k.code).sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
  let max = kits.reduce((acc, k) => Math.max(acc, codeNumber(k.code)), 0);
  return missing.map((kit) => ({ kit, code: formatKitCode(++max) }));
}

/** Suma cen składników × ilość (brutto) i ile składników ma cenę. */
export function kitValue(kit: Kit, lookup: ProductLookup): { gross: number; priced: number; total: number } {
  let gross = 0;
  let priced = 0;
  for (const item of kit.items) {
    const p = resolveKitItemProduct(item, lookup);
    const price = p ? customerGrossPrice(p.priceSaleGross, p.priceSaleNet) : null;
    if (price != null) {
      gross += price * item.quantity;
      priced++;
    }
  }
  return { gross: Math.round(gross * 100) / 100, priced, total: kit.items.length };
}

/** Do 4 zdjęć składników — jako mozaika, gdy zestaw nie ma własnego zdjęcia. */
export function kitCoverImages(kit: Kit, lookup: ProductLookup, max = 4): string[] {
  const out: string[] = [];
  for (const item of kit.items) {
    const p: Product | undefined = resolveKitItemProduct(item, lookup);
    const img = p ? getProductImage(p) : null;
    if (img && !out.includes(img)) out.push(img);
    if (out.length >= max) break;
  }
  return out;
}

/** Wyszukiwanie zestawów: nazwa, kod, kategoria, SKU i nazwy składników (wszystkie słowa muszą pasować). */
export function kitMatches(kit: Kit, query: string, lookup: ProductLookup): boolean {
  const words = foldText(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const parts = [kit.name, kit.code ?? '', kit.category, kit.description];
  for (const item of kit.items) {
    const p = resolveKitItemProduct(item, lookup);
    parts.push(item.sku, item.name, p?.displayName ?? '');
  }
  const hay = foldText(parts.join(' '));
  return words.every((w) => hay.includes(w));
}
