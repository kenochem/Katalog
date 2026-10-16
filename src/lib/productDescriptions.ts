import type { Product } from '../types';
import type { ProductMeta } from './productMeta';

/**
 * Opisy produktu: opis pełny (HTML), krótki opis i dodatkowe pola tekstowe (sposób użycia, skład,
 * bezpieczeństwo). Pola mapują się na pola tekstowe BaseLinkera (description, description_extra1–4).
 */
export type DescKey = 'description' | 'shortDescription' | 'descUsage' | 'descComposition' | 'descSafety';

export interface DescFieldDef {
  key: DescKey;
  label: string;
  hint: string;
  /** Edytor z formatowaniem (HTML) albo zwykły tekst. */
  rich: boolean;
  /** Klucz pola tekstowego w BaseLinkerze. */
  blKey: 'description' | 'description_extra1' | 'description_extra2' | 'description_extra3' | 'description_extra4';
  /** Zalecana minimalna liczba znaków (do wskazówek i kompletności). */
  minChars: number;
  /** Zalecana maksymalna liczba znaków (licznik ostrzega po przekroczeniu). */
  maxChars?: number;
}

export const DESC_FIELDS: DescFieldDef[] = [
  {
    key: 'description',
    label: 'Opis pełny',
    hint: 'Tradycyjny opis produktu: do czego służy, dla kogo, najważniejsze cechy i zalety.',
    rich: true,
    blKey: 'description',
    minChars: 450,
  },
  {
    key: 'shortDescription',
    label: 'Opis krótki',
    hint: 'Jedno–dwa zdania na listę produktów, ofertę i wyniki wyszukiwania.',
    rich: false,
    blKey: 'description_extra1',
    minChars: 60,
    maxChars: 300,
  },
  {
    key: 'descUsage',
    label: 'Sposób użycia / dawkowanie',
    hint: 'Jak stosować, w jakich proporcjach rozcieńczać, na jakie powierzchnie.',
    rich: true,
    blKey: 'description_extra2',
    minChars: 40,
  },
  {
    key: 'descComposition',
    label: 'Skład / dane techniczne',
    hint: 'Skład, pojemność, wymiary, materiał, parametry.',
    rich: true,
    blKey: 'description_extra3',
    minChars: 20,
  },
  {
    key: 'descSafety',
    label: 'Bezpieczeństwo i ostrzeżenia',
    hint: 'Środki ostrożności, piktogramy, przechowywanie, utylizacja.',
    rich: true,
    blKey: 'description_extra4',
    minChars: 20,
  },
];

export type DescValues = Record<DescKey, string>;

export const EMPTY_DESC: DescValues = {
  description: '',
  shortDescription: '',
  descUsage: '',
  descComposition: '',
  descSafety: '',
};

/** Aktualne wartości opisów produktu (opis pełny z `description`, resztę z meta). */
export function descValuesOf(product: Pick<Product, 'description'> & { meta?: ProductMeta }): DescValues {
  const m = product.meta;
  return {
    description: product.description ?? '',
    shortDescription: m?.shortDescription ?? '',
    descUsage: m?.descUsage ?? '',
    descComposition: m?.descComposition ?? '',
    descSafety: m?.descSafety ?? '',
  };
}

// ---------------------------------------------------------------------------------------------
// HTML: rozpoznawanie, tekst, czyszczenie
// ---------------------------------------------------------------------------------------------

export function looksLikeHtml(text: string): boolean {
  return /<\/?[a-z][\s\S]*?>/i.test(text);
}

function escapeHtml(t: string): string {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Zwykły tekst → HTML (akapity i łamanie linii); HTML zostaje bez zmian. */
export function toEditorHtml(text: string): string {
  const v = (text ?? '').trim();
  if (!v) return '';
  if (looksLikeHtml(v)) return v;
  return v
    .split(/\n{2,}/)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

/** Tekst bez znaczników (do liczenia znaków i kompletności). */
export function plainText(html: string | undefined | null): string {
  return String(html ?? '')
    .replace(/<\s*br\s*\/?>/gi, ' ')
    .replace(/<\/\s*(p|li|h[1-6]|div|tr)\s*>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

const ALLOWED_TAGS = new Set([
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li', 'h2', 'h3', 'h4', 'a', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'blockquote',
]);
const DROP_WITH_CONTENT = /<\s*(script|style|iframe|object|embed|noscript|template)\b[\s\S]*?<\s*\/\s*\1\s*>/gi;

function safeHref(raw: string): string | null {
  const v = raw.trim();
  if (/^(https?:\/\/|mailto:|tel:|\/)/i.test(v)) return v.replace(/"/g, '&quot;');
  return null;
}

/** Zostawia tylko bezpieczne znaczniki formatowania, bez atrybutów (poza href w linkach). */
export function sanitizeDescriptionHtml(html: string | undefined | null): string {
  let src = String(html ?? '').replace(/<!--[\s\S]*?-->/g, '').replace(DROP_WITH_CONTENT, '');
  src = src.replace(/<\s*(\/?)\s*([a-z][a-z0-9]*)\b([^>]*)>/gi, (_m, slash: string, tagRaw: string, attrs: string) => {
    let tag = tagRaw.toLowerCase();
    if (tag === 'div' || tag === 'section' || tag === 'article') tag = 'p';
    if (tag === 'h1') tag = 'h2';
    if (tag === 'h5' || tag === 'h6') tag = 'h4';
    if (tag === 'span' || tag === 'font') return '';
    if (!ALLOWED_TAGS.has(tag)) return '';
    if (slash) return tag === 'br' ? '' : `</${tag}>`;
    if (tag === 'br') return '<br>';
    if (tag === 'a') {
      const href = /href\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attrs);
      const url = href ? safeHref(href[2] ?? href[3] ?? href[4] ?? '') : null;
      return url ? `<a href="${url}" target="_blank" rel="noopener noreferrer">` : '<a>';
    }
    return `<${tag}>`;
  });
  // puste akapity i nadmiarowe odstępy
  src = src
    .replace(/<p>\s*(<br>)?\s*<\/p>/gi, '')
    .replace(/(<br>\s*){3,}/gi, '<br><br>')
    .trim();
  return src;
}

export function charCount(html: string): number {
  return plainText(html).length;
}

// ---------------------------------------------------------------------------------------------
// Ocena pól (do wskazówek w edytorze)
// ---------------------------------------------------------------------------------------------

export type FieldState = 'empty' | 'short' | 'ok';

export function fieldState(def: DescFieldDef, value: string): FieldState {
  const n = charCount(value);
  if (n === 0) return 'empty';
  return n < def.minChars ? 'short' : 'ok';
}

// ---------------------------------------------------------------------------------------------
// BaseLinker: pola tekstowe ↔ pola katalogu
// ---------------------------------------------------------------------------------------------

export type BlTextFields = Partial<Record<DescFieldDef['blKey'], string>>;

/** Pola BL → wartości opisów w katalogu (tylko te, które BL zwrócił). */
export function descFromBlText(text: BlTextFields | null | undefined): Partial<DescValues> {
  const out: Partial<DescValues> = {};
  if (!text) return out;
  for (const def of DESC_FIELDS) {
    const raw = text[def.blKey];
    if (raw == null) continue;
    const v = String(raw).trim();
    if (!v) continue;
    out[def.key] = def.rich ? sanitizeDescriptionHtml(v) : plainText(v);
  }
  return out;
}

/** Wartości katalogu → pola tekstowe BL (puste pomijamy, żeby nie kasować tego, co jest w BL). */
export function blTextFromDesc(values: Partial<DescValues>): BlTextFields {
  const out: BlTextFields = {};
  for (const def of DESC_FIELDS) {
    const v = (values[def.key] ?? '').trim();
    if (!v) continue;
    out[def.blKey] = def.rich ? sanitizeDescriptionHtml(toEditorHtml(v)) : escapeHtml(plainText(v));
  }
  return out;
}
