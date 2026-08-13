import { ChevronLeft } from 'lucide-react';
import { ContextHelp } from '../ContextHelp';
import { inferContextHelpId } from '../../lib/contextHelp';

interface CrmTaskHeaderProps {
  title: string;
  subtitle: string;
  onBack: () => void;
}

export function CrmTaskHeader({ title, subtitle, onBack }: CrmTaskHeaderProps) {
  const helpId = inferContextHelpId(`${title} ${subtitle}`);
  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm text-slate-400 transition hover:text-slate-200"
      >
        <ChevronLeft className="h-4 w-4" />
        CRM — start
      </button>
      <div>
        <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-slate-50 sm:text-xl">
          {title}
          {helpId ? <ContextHelp id={helpId} /> : null}
        </h2>
        <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
      </div>
    </div>
  );
}
