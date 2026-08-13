import { useEffect, useState } from 'react';
import { Check, Info, AlertTriangle, X } from 'lucide-react';
import { subscribeToast, type ToastPayload, type ToastTone } from '../lib/toast';

interface ToastItem extends ToastPayload {
  id: number;
}

const ICONS: Record<ToastTone, typeof Check> = {
  ok: Check,
  info: Info,
  warn: AlertTriangle,
  error: X,
};

const STYLES: Record<ToastTone, string> = {
  ok: 'toast-host-item toast-host-item--ok border border-emerald-500/30 bg-white shadow-xl dark:bg-slate-950 dark:text-slate-50',
  info: 'toast-host-item toast-host-item--info border border-slate-300 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50',
  warn: 'toast-host-item toast-host-item--warn border border-amber-400/60 bg-amber-50 shadow-xl dark:bg-amber-950 dark:text-amber-50',
  error: 'toast-host-item toast-host-item--error border border-red-500/50 bg-red-50 shadow-xl dark:bg-red-950 dark:text-red-50',
};

const ICON_STYLES: Record<ToastTone, string> = {
  ok: 'text-emerald-700 dark:text-emerald-300',
  info: 'text-slate-600 dark:text-slate-300',
  warn: 'text-amber-700 dark:text-amber-300',
  error: 'text-red-700 dark:text-red-300',
};

export function ToastHost() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    return subscribeToast((payload) => {
      const id = Date.now() + Math.random();
      setItems((prev) => [...prev.slice(-4), { ...payload, id }]);
      window.setTimeout(() => {
        setItems((prev) => prev.filter((t) => t.id !== id));
      }, payload.durationMs ?? 2800);
    });
  }, []);

  if (!items.length) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-[100] flex flex-col items-center gap-2 px-3 lg:bottom-[max(1rem,env(safe-area-inset-bottom))]"
      aria-live="polite"
    >
      {items.map((t) => {
        const tone = t.tone ?? 'ok';
        const Icon = ICONS[tone];
        return (
          <div
            key={t.id}
            className={`animate-fade-in pointer-events-auto flex max-w-md items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold shadow-xl backdrop-blur ${STYLES[tone]}`}
          >
            <Icon className={`h-4 w-4 shrink-0 ${ICON_STYLES[tone]}`} />
            <span>{t.message}</span>
          </div>
        );
      })}
    </div>
  );
}
