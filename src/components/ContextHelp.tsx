import { useState } from 'react';
import { Info } from 'lucide-react';
import { getContextHelp } from '../lib/contextHelp';

interface ContextHelpProps {
  id: string;
  className?: string;
  side?: 'left' | 'right';
}

export function ContextHelp({ id, className = '', side = 'right' }: ContextHelpProps) {
  const item = getContextHelp(id);
  const [open, setOpen] = useState(false);
  if (!item) return null;

  return (
    <span
      className={`group relative inline-flex align-middle ${className}`}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen((current) => !current);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-[#cbd5e1] bg-white text-[#475569] shadow-sm transition hover:border-brand-500/50 hover:text-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:text-brand-300"
        aria-label={`Pomoc: ${item.title}`}
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      <span
        role="tooltip"
        className={`pointer-events-none absolute top-[calc(100%+0.5rem)] z-[220] w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-[#cbd5e1] bg-white p-3 text-left text-xs normal-case leading-relaxed text-[#334155] opacity-0 shadow-2xl shadow-slate-900/15 transition group-hover:opacity-100 group-focus-within:opacity-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:shadow-black/40 ${
          open ? 'opacity-100' : ''
        } ${side === 'left' ? 'right-0' : 'left-0'}`}
      >
        <span className="block text-sm font-semibold text-[#0f172a] dark:text-slate-100">
          {item.title}
        </span>
        <span className="mt-1 block">{item.body}</span>
        {item.guideArticleId ? (
          <span className="mt-2 block text-[11px] font-semibold uppercase tracking-wide text-[#1f6124] dark:text-brand-300">
            Wiekszy opis znajdziesz w Bazie wiedzy
          </span>
        ) : null}
      </span>
    </span>
  );
}
