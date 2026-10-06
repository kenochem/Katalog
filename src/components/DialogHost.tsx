import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, HelpCircle, Info, Trash2 } from 'lucide-react';
import {
  dismissDialog,
  subscribeDialogs,
  type DialogRequest,
  type DialogTone,
} from '../lib/dialog';

const TONE: Record<
  DialogTone,
  { ring: string; icon: string; button: string; Icon: typeof AlertTriangle; title: string }
> = {
  danger: {
    ring: 'bg-red-500/15 text-red-400 ring-1 ring-red-500/30',
    icon: 'text-red-400',
    button: 'bg-red-600 hover:bg-red-500 focus-visible:ring-red-400',
    Icon: Trash2,
    title: 'Potwierdź usunięcie',
  },
  warn: {
    ring: 'bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30',
    icon: 'text-amber-400',
    button: 'bg-brand-600 hover:bg-brand-500 focus-visible:ring-brand-400',
    Icon: AlertTriangle,
    title: 'Potwierdź akcję',
  },
  info: {
    ring: 'bg-sky-500/15 text-sky-400 ring-1 ring-sky-500/30',
    icon: 'text-sky-400',
    button: 'bg-brand-600 hover:bg-brand-500 focus-visible:ring-brand-400',
    Icon: Info,
    title: 'Informacja',
  },
};

function DialogView({ req }: { req: DialogRequest }) {
  const tone: DialogTone = req.tone ?? (req.kind === 'alert' ? 'info' : 'warn');
  const t = TONE[tone];
  const Icon = req.kind === 'prompt' ? HelpCircle : t.Icon;
  const [value, setValue] = useState(req.kind === 'prompt' ? req.defaultValue ?? '' : '');
  const inputRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  function close(result: 'ok' | 'cancel') {
    dismissDialog(req);
    if (req.kind === 'confirm') req.resolve(result === 'ok');
    else if (req.kind === 'alert') req.resolve();
    else req.resolve(result === 'ok' ? value : null);
  }

  useEffect(() => {
    // Przy usuwaniu domyślnie „Anuluj”, żeby przypadkowy Enter niczego nie kasował.
    if (req.kind === 'prompt') inputRef.current?.select();
    else if (tone === 'danger') cancelRef.current?.focus();
    else confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close('cancel');
      }
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const title =
    req.title ??
    (req.kind === 'prompt' ? 'Podaj wartość' : req.kind === 'alert' ? 'Informacja' : t.title);
  const confirmLabel =
    req.confirmLabel ?? (req.kind === 'alert' ? 'OK' : tone === 'danger' ? 'Usuń' : 'Potwierdź');

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close('cancel');
      }}
    >
      <div
        role={req.kind === 'alert' ? 'alertdialog' : 'dialog'}
        aria-modal="true"
        aria-labelledby="app-dialog-title"
        className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-5 text-slate-100 shadow-2xl"
      >
        <div className="flex items-start gap-3.5">
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${t.ring}`}>
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="app-dialog-title" className="text-base font-semibold text-slate-50">
              {title}
            </h2>
            <p className="mt-1.5 whitespace-pre-line break-words text-sm leading-relaxed text-slate-300">
              {req.message}
            </p>
          </div>
        </div>

        {req.kind === 'prompt' && (
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={req.placeholder}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                close('ok');
              }
            }}
            className="input-field mt-4 w-full text-sm"
            autoFocus
          />
        )}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {req.kind !== 'alert' && (
            <button
              ref={cancelRef}
              type="button"
              onClick={() => close('cancel')}
              className="rounded-xl border border-slate-600 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
            >
              {req.cancelLabel ?? 'Anuluj'}
            </button>
          )}
          <button
            ref={confirmRef}
            type="button"
            onClick={() => close('ok')}
            className={`rounded-xl px-4 py-2 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 ${t.button}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Pokazuje pierwsze okno z kolejki (kolejne czekają, aż to zostanie zamknięte). */
export function DialogHost() {
  const [queue, setQueue] = useState<DialogRequest[]>([]);
  useEffect(() => subscribeDialogs(setQueue), []);
  const current = queue[0];
  if (!current) return null;
  return <DialogView key={queue.length + (current.message ?? '')} req={current} />;
}
