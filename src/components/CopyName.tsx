import type { KeyboardEvent, MouseEvent, ReactNode } from 'react';
import { copyText } from '../lib/copyText';

/** Nazwa produktu kopiowana do schowka jednym kliknięciem (bez otwierania produktu). Zaznaczanie tekstu nadal działa. */
export function CopyName({ text, children, what = 'nazwę', className = '' }: { text: string; children?: ReactNode; what?: string; className?: string }) {
  const run = (e: MouseEvent | KeyboardEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (typeof window !== 'undefined' && (window.getSelection()?.toString() ?? '').length > 0) return;
    void copyText(text, what);
  };
  return (
    <span
      role="button"
      tabIndex={0}
      onClick={run}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') run(e);
      }}
      title={`Kliknij, aby skopiować ${what}`}
      className={`cursor-copy decoration-dotted underline-offset-2 hover:underline ${className}`}
    >
      {children ?? text}
    </span>
  );
}
