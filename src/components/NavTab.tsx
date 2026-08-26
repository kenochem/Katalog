import type { ReactNode } from 'react';

export function NavTab({
  active,
  onClick,
  icon,
  label,
  count,
  highlight,
  layout = 'row',
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
  count?: number;
  highlight?: boolean;
  layout?: 'row' | 'sidebar';
}) {
  const tone = active
    ? 'bg-brand-600 text-white'
    : highlight
      ? 'bg-amber-500 text-amber-950 hover:bg-amber-600'
      : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-50';
  const badgeTone = active
    ? 'bg-black/20 text-white'
    : highlight
      ? 'bg-amber-950/15 text-amber-950'
      : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-400';

  if (layout === 'sidebar') {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition ${tone}`}
      >
        {icon}
        <span className="flex-1 text-left">{label}</span>
        {count !== undefined && (
          <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${badgeTone}`}>{count}</span>
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition sm:gap-2 sm:px-4 sm:text-sm ${tone}`}
    >
      {icon}
      <span>{label}</span>
      {count !== undefined && (
        <span className={`rounded-full px-1.5 py-0.5 text-[10px] sm:text-xs ${badgeTone}`}>{count}</span>
      )}
    </button>
  );
}
