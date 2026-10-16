import { describe, expect, it } from 'vitest';
import {
  DESC_FIELDS,
  blTextFromDesc,
  charCount,
  descFromBlText,
  descValuesOf,
  fieldState,
  plainText,
  sanitizeDescriptionHtml,
  toEditorHtml,
} from '../lib/productDescriptions';
import { assessProductKnowledge } from '../lib/productKnowledge';
import type { Product } from '../types';

describe('czyszczenie HTML opisów', () => {
  it('usuwa skrypty, style i atrybuty, zostawia formatowanie', () => {
    const out = sanitizeDescriptionHtml(
      '<div style="color:red" onclick="x()"><script>alert(1)</script><strong class="a">Mocny</strong> <span>tekst</span></div>',
    );
    expect(out).not.toMatch(/script|onclick|style|class|span/i);
    expect(out).toContain('<strong>Mocny</strong>');
    expect(out).toContain('tekst');
  });

  it('linki: bezpieczne zostają, javascript: znika', () => {
    expect(sanitizeDescriptionHtml('<a href="https://kenochem.com/x">ok</a>')).toContain('href="https://kenochem.com/x"');
    expect(sanitizeDescriptionHtml('<a href="javascript:alert(1)">zły</a>')).not.toContain('javascript');
  });

  it('normalizuje nagłówki i usuwa puste akapity', () => {
    const out = sanitizeDescriptionHtml('<h1>Tytuł</h1><p>  </p><p><br></p><h5>Pod</h5>');
    expect(out).toBe('<h2>Tytuł</h2><h4>Pod</h4>');
  });

  it('zwykły tekst zamienia na akapity, HTML zostawia', () => {
    expect(toEditorHtml('a\nb\n\nc')).toBe('<p>a<br>b</p><p>c</p>');
    expect(toEditorHtml('<p>x</p>')).toBe('<p>x</p>');
    expect(toEditorHtml('1 < 2')).toContain('&lt;');
  });

  it('liczy znaki bez znaczników', () => {
    expect(plainText('<p>Ala&nbsp;ma</p><ul><li>kota</li></ul>')).toBe('Ala ma kota');
    expect(charCount('<p></p>')).toBe(0);
  });
});

describe('pola opisowe i BaseLinker', () => {
  it('mapuje pola BL na pola katalogu i z powrotem', () => {
    const fromBl = descFromBlText({
      description: '<div>Pełny <b>opis</b></div>',
      description_extra1: '<p>Krótki</p>',
      description_extra2: '',
    });
    expect(fromBl.description).toBe('<p>Pełny <b>opis</b></p>');
    expect(fromBl.shortDescription).toBe('Krótki');
    expect(fromBl.descUsage).toBeUndefined();

    const toBl = blTextFromDesc({ description: 'Zwykły tekst', shortDescription: 'Krótki & dobry', descUsage: '' });
    expect(toBl.description).toBe('<p>Zwykły tekst</p>');
    expect(toBl.description_extra1).toBe('Krótki &amp; dobry');
    expect(toBl.description_extra2).toBeUndefined();
  });

  it('puste pola nie trafiają do BaseLinkera (nie kasujemy tam treści)', () => {
    expect(blTextFromDesc({ description: '  ', shortDescription: '' })).toEqual({});
  });

  it('ocena pola: brak / za krótki / ok', () => {
    const def = DESC_FIELDS[0];
    expect(fieldState(def, '')).toBe('empty');
    expect(fieldState(def, '<p>krótki</p>')).toBe('short');
    expect(fieldState(def, '<p>' + 'a'.repeat(def.minChars) + '</p>')).toBe('ok');
  });

  it('wartości z produktu', () => {
    const v = descValuesOf({ description: 'x', meta: { shortDescription: 's', descUsage: 'u' } });
    expect(v).toMatchObject({ description: 'x', shortDescription: 's', descUsage: 'u', descComposition: '' });
  });
});

describe('kompletność uwzględnia nowe opisy', () => {
  const base = {
    id: 'a',
    sku: 'TEST1',
    name: 'Produkt testowy do opisów',
    displayName: 'Produkt testowy do opisów',
    category: 'Chemia',
    hasImage: true,
    stock: 1,
    catalog: 'shop',
  } as unknown as Product;

  it('krótki opis i sposób użycia podnoszą wynik', () => {
    const empty = assessProductKnowledge(base).score;
    const filled = assessProductKnowledge({
      ...base,
      meta: {
        shortDescription: 'Skuteczny środek do mycia powierzchni szklanych, nie pozostawia smug ani zacieków.',
        descUsage: 'Nanieść na powierzchnię i przetrzeć czystą ściereczką.',
      },
    } as Product).score;
    expect(filled).toBeGreaterThan(empty);
  });
});
