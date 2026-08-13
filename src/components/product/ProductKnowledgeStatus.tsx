import { BookOpen, ChevronRight } from 'lucide-react';
import type { Product } from '../../types';
import {
  assessProductKnowledge,
  suggestShortDescription,
  type KnowledgeLevel,
} from '../../lib/productKnowledge';

const LEVEL_LABEL: Record<KnowledgeLevel, string> = {
  weak: 'Słaba baza',
  fair: 'W trakcie',
  good: 'Dobra',
  rich: 'Bogata',
};

const LEVEL_BAR: Record<KnowledgeLevel, string> = {
  weak: 'bg-rose-500',
  fair: 'bg-amber-500',
  good: 'bg-emerald-500',
  rich: 'bg-violet-500',
};

const LEVEL_BADGE: Record<KnowledgeLevel, string> = {
  weak: 'bg-rose-600/12 text-rose-950 dark:bg-rose-500/15 dark:text-rose-200',
  fair: 'bg-amber-600/12 text-amber-950 dark:bg-amber-500/15 dark:text-amber-200',
  good: 'bg-emerald-600/12 text-emerald-950 dark:bg-emerald-500/15 dark:text-emerald-200',
  rich: 'bg-violet-600/12 text-violet-950 dark:bg-violet-500/15 dark:text-violet-200',
};

export function ProductKnowledgeStatus({
  product,
  onEditDescriptions,
  compact,
}: {
  product: Product;
  onEditDescriptions?: () => void;
  compact?: boolean;
}) {
  const k = assessProductKnowledge(product);

  return (
    <div className={`surface-panel ${compact ? 'p-3' : 'p-4'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex gap-2">
          <BookOpen className="mt-0.5 h-5 w-5 shrink-0 text-brand-400" />
          <div>
            <p className="text-sm font-medium text-slate-100">Opis w katalogu / dla AI</p>
            <p className="mt-0.5 text-xs text-slate-400">
              Im więcej pól, tym lepiej boty i handlowcy zrozumieją produkt. Ocena na żywo z danych w
              bazie.
            </p>
          </div>
        </div>
        <span
          className={`rounded-lg px-2.5 py-1 text-xs font-semibold tabular-nums ${LEVEL_BADGE[k.level]}`}
        >
          {k.score}% · {LEVEL_LABEL[k.level]}
        </span>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-700 dark:bg-slate-800">
        <div
          className={`h-full rounded-full transition-all ${LEVEL_BAR[k.level]}`}
          style={{ width: `${k.score}%` }}
        />
      </div>

      {!compact && k.missing.length > 0 && (
        <div className="mt-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Warto uzupełnić
          </p>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {k.missing.slice(0, 6).map((m) => (
              <li
                key={m}
                className="rounded-md border border-slate-600/80 bg-slate-800/30 px-2 py-0.5 text-[11px] text-slate-300 dark:border-slate-700/80 dark:bg-slate-900/80 dark:text-slate-400"
              >
                {m}
              </li>
            ))}
          </ul>
          {!product.meta?.shortDescription?.trim() && (
            <p className="mt-2 text-xs text-slate-400">
              Propozycja krótkiego opisu:{' '}
              <span className="text-slate-200">{suggestShortDescription(product)}</span>
            </p>
          )}
        </div>
      )}

      {onEditDescriptions && k.score < 85 && (
        <button
          type="button"
          onClick={onEditDescriptions}
          className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-brand-300 hover:text-brand-200 dark:text-brand-400 dark:hover:text-brand-300"
        >
          Uzupełnij opisy i parametry
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
