import { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { ackAlerts, useSystemAlerts } from '../lib/systemAlerts';

interface Props {
  /** Imię/nazwa osoby zapisywana przy „Przyjąłem”. */
  who: string;
  onOpenStatus: () => void;
}

/**
 * Czerwony pasek na górze aplikacji, gdy system ma aktywny alarm (błąd lub brak sygnału agenta),
 * którego nikt jeszcze nie przyjął. Ostrzeżenia i informacje widać tylko w Logi → Status systemów.
 */
export function SystemAlertBanner({ who, onOpenStatus }: Props) {
  const { alerts, refresh } = useSystemAlerts(true);
  const [hidden, setHidden] = useState(false);

  const open = alerts.filter((a) => a.level === 'error' && !a.ackAt);
  if (hidden || open.length === 0) return null;
  const first = open[0];

  return (
    <div className="mb-3 flex items-start gap-3 rounded-xl border border-red-500/60 bg-red-600/90 px-4 py-2.5 text-white shadow-lg">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">
          {open.length === 1 ? first.title : `${open.length} alarmów systemowych — ${first.title}`}
        </p>
        <p className="mt-0.5 line-clamp-2 text-xs text-white/90">{first.message}</p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
        <button
          type="button"
          onClick={onOpenStatus}
          className="rounded-lg bg-white/15 px-2.5 py-1 text-xs font-semibold hover:bg-white/25"
        >
          Szczegóły
        </button>
        <button
          type="button"
          onClick={() => {
            void ackAlerts(
              open.map((a) => a.id),
              who,
            ).then(() => refresh());
          }}
          className="rounded-lg bg-white px-2.5 py-1 text-xs font-bold text-red-700 hover:bg-red-50"
        >
          Przyjąłem
        </button>
        <button
          type="button"
          onClick={() => setHidden(true)}
          className="rounded-lg p-1 text-white/80 hover:bg-white/15"
          aria-label="Ukryj do odświeżenia strony"
          title="Ukryj do odświeżenia strony"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
