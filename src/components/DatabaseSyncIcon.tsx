import { Database, RefreshCw } from 'lucide-react';

/** Ikona: baza + małe kółko odświeżania (sync WAPRO ≠ przeładowanie katalogu). */
export function DatabaseSyncIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <span className={`relative inline-flex shrink-0 ${className}`} aria-hidden>
      <Database className="h-full w-full" />
      <span className="absolute -bottom-0.5 -right-0.5 flex h-[45%] w-[45%] items-center justify-center rounded-full bg-slate-950 text-brand-400 ring-1 ring-slate-950">
        <RefreshCw className="h-full w-full" strokeWidth={2.75} />
      </span>
    </span>
  );
}
