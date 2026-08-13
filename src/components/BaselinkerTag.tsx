import type { Product } from '../types';
import { baselinkerLinkLabel, hasBaselinkerLink } from '../lib/baselinkerLink';

type BaselinkerTagProps = {
  product: Product;
  /** sm = karta katalogu / wiersz tabeli; md = nagłówek produktu */
  size?: 'sm' | 'md';
  className?: string;
};

/** Niebieski tag „B” — produkt powiązany z ofertą BaseLinker (wystawiony w necie). */
export function BaselinkerTag({ product, size = 'sm', className = '' }: BaselinkerTagProps) {
  if (!hasBaselinkerLink(product)) return null;

  const label = baselinkerLinkLabel(product);
  const dim = size === 'md' ? 'h-5 min-w-5 px-1 text-[11px]' : 'h-[18px] min-w-[18px] text-[10px]';

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-[4px] font-extrabold leading-none text-white ${dim} ${className}`}
      style={{ backgroundColor: '#2563eb', boxShadow: '0 0 0 1px rgba(37,99,235,0.35)' }}
      title={label ? `BaseLinker — ${label}` : 'BaseLinker — oferta w marketplace'}
      aria-label={label ? `BaseLinker ${label}` : 'BaseLinker'}
    >
      B
    </span>
  );
}
