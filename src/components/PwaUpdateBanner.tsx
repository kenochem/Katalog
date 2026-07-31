import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { applyPwaUpdate, onPwaUpdateAvailable } from '../lib/pwaUpdate';

/** Stały pasek zamiast twardego reloadu w trakcie pracy. */
export function PwaUpdateBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => onPwaUpdateAvailable(() => setVisible(true)), []);

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-[80] px-3 lg:bottom-4 lg:left-auto lg:right-4 lg:max-w-sm lg:px-0">
      <div className="flex items-center gap-3 rounded-2xl border border-brand-500/40 bg-slate-900/95 p-3 shadow-xl backdrop-blur">
        <p className="min-w-0 flex-1 text-sm text-slate-200">
          Jest nowa wersja katalogu. Odśwież, gdy skończysz bieżącą czynność.
        </p>
        <button
          type="button"
          onClick={() => applyPwaUpdate()}
          className="flex shrink-0 items-center gap-1.5 rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-500"
        >
          <RefreshCw className="h-4 w-4" />
          Odśwież
        </button>
      </div>
    </div>
  );
}
