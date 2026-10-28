import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Loader2, TriangleAlert, X } from 'lucide-react';
import { BASELINKER_MIN_SIDE, meetsMinSize, readImageSize, type PrepareMode } from '../lib/imagePrepare';

type Dims = { w: number; h: number } | 'error';

/** Grupowe dopasowanie wszystkich zdjęć produktu pod BaseLinker (min. 500×500 px). */
export function BatchPrepareModal({
  open,
  images,
  productName,
  onClose,
  onApply,
}: {
  open: boolean;
  images: string[];
  productName: string;
  onClose: () => void;
  /** Przetwarza wskazane zdjęcia; zwraca liczbę poprawionych. */
  onApply: (urls: string[], mode: PrepareMode, onProgress: (done: number, total: number) => void) => Promise<number>;
}) {
  const [dims, setDims] = useState<Record<string, Dims>>({});
  const [mode, setMode] = useState<PrepareMode>('scale');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState<[number, number] | null>(null);
  const [measuring, setMeasuring] = useState(false);

  // pomiar wymiarów wszystkich zdjęć (po 3 naraz) i domyślne zaznaczenie zbyt małych
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setDims({});
    setSelected(new Set());
    setProgress(null);
    setMeasuring(true);
    void (async () => {
      const queue = [...images];
      const result: Record<string, Dims> = {};
      async function worker() {
        while (queue.length && !cancelled) {
          const url = queue.shift()!;
          try {
            const s = await readImageSize(url);
            result[url] = { w: s.width, h: s.height };
          } catch {
            result[url] = 'error';
          }
          if (!cancelled) setDims({ ...result });
        }
      }
      await Promise.all([worker(), worker(), worker()]);
      if (cancelled) return;
      setSelected(new Set(images.filter((u) => {
        const d = result[u];
        return d && d !== 'error' && !meetsMinSize(d.w, d.h);
      })));
      setMeasuring(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, images]);

  const tooSmall = useMemo(
    () => images.filter((u) => {
      const d = dims[u];
      return d && d !== 'error' && !meetsMinSize(d.w, d.h);
    }),
    [images, dims],
  );
  const running = progress !== null;

  if (!open) return null;

  const toggle = (u: string) =>
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(u)) n.delete(u);
      else n.add(u);
      return n;
    });

  async function run() {
    const urls = images.filter((u) => selected.has(u));
    if (urls.length === 0) return;
    setProgress([0, urls.length]);
    try {
      await onApply(urls, mode, (done, total) => setProgress([done, total]));
      onClose();
    } finally {
      setProgress(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-3 sm:items-center sm:p-4"
      role="dialog"
      aria-modal
      aria-label="Dopasuj wszystkie zdjęcia pod BaseLinker"
      onClick={(e) => {
        e.stopPropagation();
        if (!running) onClose();
      }}
    >
      <div className="flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-2 border-b border-slate-800 px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-50">Dopasuj wszystkie zdjęcia pod BaseLinker</h2>
            <p className="mt-0.5 truncate text-xs text-slate-500">
              {productName} · wymagane min. {BASELINKER_MIN_SIDE}×{BASELINKER_MIN_SIDE} px
            </p>
          </div>
          <button type="button" disabled={running} onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 disabled:opacity-40" aria-label="Zamknij">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          <div className="flex gap-2">
            {(
              [
                ['scale', 'Przeskaluj (proporcje bez zmian)'],
                ['square', 'Kwadrat (dopełnij tłem)'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                disabled={running}
                onClick={() => setMode(key)}
                className={`flex-1 rounded-xl border px-3 py-2 text-xs font-medium ${mode === key ? 'border-brand-500 bg-brand-500/15 text-brand-200' : 'border-slate-700 text-slate-400 hover:bg-slate-800'}`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            {measuring ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Sprawdzam wymiary zdjęć…
              </span>
            ) : (
              <span>
                Za małe: <strong className="text-amber-300">{tooSmall.length}</strong> z {images.length}
              </span>
            )}
            <button type="button" disabled={running} onClick={() => setSelected(new Set(tooSmall))} className="ml-auto text-brand-300 hover:underline disabled:opacity-40">
              zaznacz tylko za małe
            </button>
            <button type="button" disabled={running} onClick={() => setSelected(new Set(images))} className="text-brand-300 hover:underline disabled:opacity-40">
              zaznacz wszystkie
            </button>
          </div>

          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {images.map((url, idx) => {
              const d = dims[url];
              const small = d && d !== 'error' && !meetsMinSize(d.w, d.h);
              const isOn = selected.has(url);
              return (
                <li key={url}>
                  <button
                    type="button"
                    disabled={running || d === 'error'}
                    onClick={() => toggle(url)}
                    className={`relative block w-full overflow-hidden rounded-xl border-2 text-left transition ${isOn ? 'border-brand-400' : 'border-slate-700 opacity-80 hover:opacity-100'}`}
                    title={d === 'error' ? 'Nie udało się odczytać zdjęcia (np. blokada CORS)' : undefined}
                  >
                    <img src={url} alt="" loading="lazy" className="aspect-square w-full bg-slate-950 object-contain" />
                    <span className="absolute left-1 top-1 rounded bg-black/70 px-1.5 text-[10px] font-semibold text-white">{idx === 0 ? 'główne' : idx + 1}</span>
                    {isOn && <CheckCircle2 className="absolute right-1 top-1 h-4 w-4 rounded-full bg-slate-900 text-brand-300" />}
                    <span
                      className={`block px-1.5 py-1 text-[10px] font-medium tabular-nums ${
                        d === 'error' ? 'bg-rose-500/20 text-rose-200' : small ? 'bg-amber-500/20 text-amber-200' : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {d === undefined ? '…' : d === 'error' ? 'błąd odczytu' : `${d.w}×${d.h}${small ? ' · za małe' : ''}`}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {tooSmall.length === 0 && !measuring && (
            <p className="flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
              <CheckCircle2 className="h-4 w-4" /> Wszystkie zdjęcia spełniają wymóg rozmiaru. Możesz mimo to zaznaczyć wybrane i przetworzyć.
            </p>
          )}
          <p className="flex items-start gap-1.5 text-[11px] text-slate-500">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Zdjęcia zostaną zastąpione nowymi plikami w tej samej kolejności. Poprzednia wersja zdjęcia głównego jest zachowana do przywrócenia.
          </p>

          {progress && (
            <div className="space-y-1.5 rounded-xl border border-brand-500/30 bg-brand-500/10 px-3 py-2.5">
              <div className="flex items-center justify-between text-xs font-medium text-brand-100">
                <span className="flex items-center gap-1.5">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Przetwarzanie zdjęć
                </span>
                <span className="tabular-nums">
                  {progress[0]} / {progress[1]}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                <div className="h-full rounded-full bg-brand-400 transition-all" style={{ width: `${Math.round((progress[0] / Math.max(1, progress[1])) * 100)}%` }} />
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-800 px-4 py-3">
          <button type="button" disabled={running} onClick={onClose} className="rounded-xl border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-40">
            Anuluj
          </button>
          <button
            type="button"
            disabled={running || measuring || selected.size === 0}
            onClick={() => void run()}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
          >
            {running && <Loader2 className="h-4 w-4 animate-spin" />}
            Dopasuj zaznaczone ({selected.size})
          </button>
        </div>
      </div>
    </div>
  );
}
