import { describe, expect, it } from 'vitest';
import { formatSize, safeDocName } from '../lib/productDocs';

describe('materiały produktu', () => {
  it('nazwa pliku jest bezpieczna dla magazynu', () => {
    expect(safeDocName('Karta charakterystyki – Płyn do szyb (2024).PDF')).toBe('Karta_charakterystyki_Plyn_do_szyb_2024.pdf');
    expect(safeDocName('żółć.pdf')).toBe('zolc.pdf');
    expect(safeDocName('???.pdf')).toBe('plik.pdf');
  });
  it('formatuje rozmiar', () => {
    expect(formatSize(500)).toBe('500 B');
    expect(formatSize(2048)).toBe('2 KB');
    expect(formatSize(5 * 1024 * 1024)).toBe('5.0 MB');
  });
});
