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
  ok: 'bg-emerald-600 text-white',
  info: 'bg-[#1e293b] text-[#f1f5f9] ring-1 ring-white/10',
  warn: 'bg-amber-500 text-amber-950',
  error: 'bg-red-600 text-white',
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
      className="pointer-events-none fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[100] flex flex-col items-center gap-2 px-3"
      aria-live="polite"
    >
      {items.map((t) => {
        const tone = t.tone ?? 'ok';
        const Icon = ICONS[tone];
        return (
          <div
            key={t.id}
            className={`animate-fade-in pointer-events-auto flex max-w-md items-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium shadow-xl ${STYLES[tone]}`}
          >
            <Icon className="h-4 w-4 shrink-0 opacity-90" />
            <span>{t.message}</span>
          </div>
        );
      })}
    </div>
  );
}
