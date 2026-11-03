import type { Product } from '../types';
import { functionLeaves, type MaterialFact } from './categoryEngine';
import { descFamilyKey, MIN_DESCRIPTION, plainText, volumeOf } from './engineDescriptions';
import { fold } from './partsText';
import { isPlaceholderManufacturer } from './waproManufacturers';

/**
 * Kontrola spójności i poprawności opisów (obecnych i wczytywanych z pliku). Błąd blokuje zapis,
 * ostrzeżenie wymaga uwagi człowieka. Silnik niczego nie poprawia sam — wskazuje, co nie gra i dlaczego.
 */
export interface DescIssue {
  level: 'error' | 'warn';
  code: string;
  text: string;
}

export const ISSUE_LABEL: Record<string, string> = {
  pusty: 'Pusty opis',
  krotki: 'Zbyt krótki opis',
  szablon: 'Tekst zastępczy w opisie',
  html: 'Błędny HTML',
  pojemnosc: 'Inna pojemność niż produkt',
  marka: 'Wspomniana inna marka',
  kategoria: 'Opis niezgodny z kategorią',
  ph: 'Inne pH niż w karcie',
  link: 'Link w opisie',
  krzyk: 'Opis pisany wielkimi literami',
  biobojcze: 'Deklaracja biobójcza bez pokrycia',
  duplikat: 'Taki sam opis ma inny produkt',
};

const PLACEHOLDER = /lorem ipsum|do uzupe[łl]nienia|\btodo\b|\bxxx+\b|\[\.\.\.\]|wstaw tu|brak opisu|opis wkr[óo]tce|\btbd\b/i;
/** Deklaracje, które w Polsce wymagają pozwolenia na produkt biobójczy (samo słowo „dezynfekcja” pada też w zdaniach przeczących). */
const BIOCIDAL = /biob[óo]jcz|bakteriob[óo]jcz|wirusob[óo]jcz|grzybob[óo]jcz|zabija (bakterie|wirusy|grzyby)|99[.,]9\s?%/i;
/** Co uznajemy za pokrycie takiej deklaracji: dezynfekcja lub działanie biobójcze w nazwie, kategorii albo karcie produktu. */
const BIOCIDAL_COVER = /dezynfek|biob[óo]jcz|bakteriob|wirusob|grzybob|septal|steril/i;
/** Marki sprzętu i „marki” zbiorcze — mogą pojawić się w opisie zgodnie z prawdą (kompatybilność, linia produktów). */
const MENTION_OK = new Set(['karcher', 'kranzle', 'nilfisk', 'lavor', 'stihl', 'bosch', 'makita', 'dewalt', 'festool', 'rupes', 'flex', 'mirka', 'detailing', 'kenochem', 'inni producenci', 'marka niezdefiniowana']);
const PACKAGE_VOLUME = /(opakowani\w*|pojemno\w*|butelk\w*|kanistr\w*|baniak\w*|beczk\w*|worek\w*)[^.\n]{0,25}?(\d+(?:[.,]\d+)?)\s?(ml|l|kg|g)\b/gi;

/** Pojemność sprowadzona do jednej postaci (litry/kilogramy), żeby „500 ml” i „0,5 L” się zgadzały. */
function canonicalVolume(value: string, unit: string): string {
  const n = parseFloat(value.replace(',', '.'));
  const u = unit.toLowerCase();
  const base = u === 'ml' || u === 'g' ? n / 1000 : n;
  // litr i kilogram traktujemy jak tę samą ilość (opisy chemii często mieszają jednostki)
  return `${Math.round(base * 1000) / 1000}`;
}

export interface CheckContext {
  product: Product;
  /** Opis w HTML (obecny albo wczytany). */
  description: string;
  /** Kategoria produktu (liść drzewa). */
  category: string;
  /** Marki znane w katalogu — opis nie powinien wspominać cudzych. */
  makers: string[];
  fact?: MaterialFact;
}

export function checkDescription(ctx: CheckContext): DescIssue[] {
  const { product: p, description, category } = ctx;
  const out: DescIssue[] = [];
  const text = plainText(description);
  const name = p.displayName || p.name;

  if (!text) return [{ level: 'error', code: 'pusty', text: 'Opis jest pusty.' }];
  if (text.length < MIN_DESCRIPTION) out.push({ level: 'warn', code: 'krotki', text: `Opis ma tylko ${text.length} znaków (zalecane co najmniej ${MIN_DESCRIPTION}).` });
  if (PLACEHOLDER.test(text)) out.push({ level: 'error', code: 'szablon', text: 'W opisie jest tekst zastępczy („do uzupełnienia”, „lorem ipsum” itp.).' });

  if (/<(script|iframe|style|object|embed)\b/i.test(description)) out.push({ level: 'error', code: 'html', text: 'Opis zawiera niedozwolone znaczniki (script, iframe, style).' });
  else {
    for (const tag of ['p', 'ul', 'ol', 'li', 'h2', 'h3', 'strong', 'b']) {
      const open = (description.match(new RegExp(`<${tag}(\\s[^>]*)?>`, 'gi')) ?? []).length;
      const close = (description.match(new RegExp(`</${tag}>`, 'gi')) ?? []).length;
      if (open !== close) {
        out.push({ level: 'warn', code: 'html', text: `Niedomknięty znacznik <${tag}> (${open} otwarć, ${close} zamknięć).` });
        break;
      }
    }
  }
  if (/https?:\/\/|www\./i.test(text)) out.push({ level: 'warn', code: 'link', text: 'W opisie jest adres internetowy.' });

  const letters = text.replace(/[^A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż]/g, '');
  if (letters.length > 80 && letters.replace(/[^A-ZĄĆĘŁŃÓŚŹŻ]/g, '').length / letters.length > 0.5) out.push({ level: 'warn', code: 'krzyk', text: 'Większość opisu jest pisana wielkimi literami.' });

  // pojemność opakowania w opisie vs w nazwie produktu
  const own = volumeOf(name);
  if (own) {
    const ownCanon = canonicalVolume(own.split(' ')[0], own.split(' ')[1]);
    const found = [...text.matchAll(PACKAGE_VOLUME)].map((m) => ({ canon: canonicalVolume(m[2], m[3]), shown: `${m[2]} ${m[3]}` }));
    if (found.length && !found.some((f) => f.canon === ownCanon)) {
      out.push({ level: 'warn', code: 'pojemnosc', text: `Opis podaje opakowanie ${[...new Set(found.map((f) => f.shown))].join(', ')}, a produkt ma ${own}.` });
    }
  }

  // cudze marki
  const ownMaker = fold(p.manufacturer ?? '');
  const foreign = ctx.makers.filter((m) => {
    const f = fold(m).trim();
    return f.length >= 4 && !MENTION_OK.has(f) && f !== ownMaker && !fold(name).includes(f) && !ownMaker.includes(f) && !f.includes(ownMaker) && !isPlaceholderManufacturer(m) && new RegExp(`(^|[^a-z0-9])${f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`).test(fold(text));
  });
  if (foreign.length) out.push({ level: 'warn', code: 'marka', text: `Opis wspomina inne marki: ${foreign.slice(0, 3).join(', ')}.` });

  // czy opis opowiada o tym, co kategoria
  if (category && category !== 'Do decyzji' && text.length >= MIN_DESCRIPTION) {
    const leaves = functionLeaves(text);
    const own = leaves.find((l) => l.leaf === category);
    const strongest = leaves.filter((l) => l.leaf !== category && l.w >= 1.2 && l.hits >= 2).sort((a, b) => b.w * b.hits - a.w * a.hits)[0];
    if (!own && strongest) out.push({ level: 'warn', code: 'kategoria', text: `Opis mówi o „${strongest.leaf}”, a produkt jest w „${category}”.` });
  }

  // pH zgodne z kartą
  if (ctx.fact?.ph) {
    const factPh = parseFloat(ctx.fact.ph.replace(',', '.'));
    const descPh = text.match(/\bpH\b[^0-9]{0,25}(\d{1,2}(?:[.,]\d+)?)/i)?.[1];
    if (!Number.isNaN(factPh) && descPh && Math.abs(parseFloat(descPh.replace(',', '.')) - factPh) > 1.5) {
      out.push({ level: 'warn', code: 'ph', text: `Opis podaje pH ${descPh}, a karta produktu ${ctx.fact.ph}.` });
    }
  }

  // deklaracje biobójcze wymagają pokrycia w nazwie, kategorii albo karcie
  if (BIOCIDAL.test(text) && !BIOCIDAL_COVER.test(`${name} ${category} ${ctx.fact?.use ?? ''}`)) {
    out.push({ level: 'warn', code: 'biobojcze', text: 'Opis deklaruje działanie biobójcze/dezynfekujące, a nic w produkcie ani karcie tego nie potwierdza.' });
  }
  return out;
}

export interface CheckedRow {
  product: Product;
  issues: DescIssue[];
}

/** Sprawdza wszystkie produkty z opisem; dodaje wykrywanie identycznych opisów u różnych produktów (poza tą samą rodziną). */
export function checkAllDescriptions(products: Product[], descriptions: Map<string, string>, facts: Record<string, MaterialFact> = {}, categoryOf: (p: Product) => string = (p) => p.category): CheckedRow[] {
  const singles = products.filter((p) => !p.isGroup && (p.sku ?? '').trim());
  const makers = [...new Set(singles.map((p) => (p.manufacturer ?? '').trim()).filter(Boolean))];
  const seen = new Map<string, Product[]>();
  const rows: CheckedRow[] = [];
  for (const p of singles) {
    const desc = descriptions.get(p.id) ?? p.description ?? '';
    const text = plainText(desc);
    if (!text) continue;
    const key = fold(text).slice(0, 400);
    if (text.length >= MIN_DESCRIPTION) (seen.get(key) ?? seen.set(key, []).get(key)!).push(p);
    rows.push({ product: p, issues: checkDescription({ product: p, description: desc, category: categoryOf(p), makers, fact: facts[(p.sku ?? '').toUpperCase()] }) });
  }
  const byProduct = new Map(rows.map((r) => [r.product.id, r]));
  for (const group of seen.values()) {
    if (group.length < 2) continue;
    const families = new Set(group.map((p) => descFamilyKey(p)));
    if (families.size < 2) continue; // ten sam produkt w kilku opakowaniach może mieć wspólny opis
    for (const p of group) byProduct.get(p.id)?.issues.push({ level: 'warn', code: 'duplikat', text: `Ten sam opis ma ${group.length - 1} inny(ch) produkt(ów), np. ${group.find((x) => x.id !== p.id)!.sku}.` });
  }
  return rows.filter((r) => r.issues.length);
}

export function issueSummary(rows: CheckedRow[]): { code: string; label: string; count: number; level: 'error' | 'warn' }[] {
  const m = new Map<string, { count: number; level: 'error' | 'warn' }>();
  for (const r of rows) for (const i of r.issues) {
    const cur = m.get(i.code) ?? { count: 0, level: i.level };
    cur.count++;
    if (i.level === 'error') cur.level = 'error';
    m.set(i.code, cur);
  }
  return [...m.entries()].map(([code, v]) => ({ code, label: ISSUE_LABEL[code] ?? code, ...v })).sort((a, b) => b.count - a.count);
}
