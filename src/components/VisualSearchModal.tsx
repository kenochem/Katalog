import { useRef, useState } from 'react';
import {
  X,
  Camera,
  Upload,
  Loader2,
  Sparkles,
  ImageOff,
} from 'lucide-react';
import type { Product } from '../types';
import {
  getProductImageSafe,
  recognizeProductFromImage,
  type VisualMatch,
  type RecognizeMethod,
} from '../lib/visualSearch';
import { formatStock } from '../lib/format';

interface VisualSearchModalProps {
  products: Product[];
  onClose: () => void;
  onSelect: (product: Product) => void;
}

export function VisualSearchModal({
  products,
  onClose,
  onSelect,
}: VisualSearchModalProps) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [matches, setMatches] = useState<VisualMatch[] | null>(null);
  const [method, setMethod] = useState<RecognizeMethod | null>(null);

  function finishWithMatches(
    list: VisualMatch[],
    opts?: {
      warn?: string;
      method?: RecognizeMethod;
    },
  ) {
    setMatches(list);
    if (opts?.warn) setWarning(opts.warn);
    if (opts?.method) setMethod(opts.method);

    // Auto-otwórz tylko gdy jeden wynik wyraźnie wygrywa
    const clearWinner =
      list.length >= 1 &&
      list[0].score >= 72 &&
      (list.length === 1 || list[0].score - list[1].score >= 8);

    if (clearWinner) {
      onSelect(list[0].product);
      onClose();
      return;
    }
    if (list.length === 0) {
      setError(
        opts?.warn ||
          'Brak wyniku. Zrób zdjęcie przodu produktu jak w katalogu.',
      );
    }
  }

  async function handleFile(file: File) {
    setError(null);
    setWarning(null);
    setMatches(null);
    setMethod(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(file));
    setBusy(true);
    setStatusText('Przygotowuję zdjęcie…');

    try {
      const result = await recognizeProductFromImage(
        file,
        products,
        (_status, detail) => {
          setStatusText(detail || 'Porównuję ze zdjęciami katalogu…');
        },
      );
      finishWithMatches(result.matches, {
        warn: result.warning,
        method: result.method,
      });
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error && err.message.length < 120
          ? err.message
          : 'Błąd rozpoznawania. Spróbuj ponownie.',
      );
    } finally {
      setBusy(false);
      setStatusText('');
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center overflow-x-hidden bg-black/80 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="animate-fade-in max-h-[92dvh] w-full max-w-lg overflow-x-hidden overflow-y-auto rounded-t-3xl border border-slate-700 bg-slate-900 pb-[env(safe-area-inset-bottom)] sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 border-b border-slate-800 bg-slate-900/95 backdrop-blur">
          <div className="flex items-center justify-between gap-2 px-3 py-3 sm:px-4">
            <div className="min-w-0">
              <h2 className="flex items-center gap-2 font-semibold text-slate-100">
                <Sparkles className="h-4 w-4 shrink-0 text-brand-400" />
                Lens
              </h2>
              <p className="truncate text-xs text-slate-400">
                Rozpoznaj po zdjęciu · jak w katalogu · top 3
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-full p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="space-y-3 p-3 sm:p-4">
          <p className="text-xs leading-relaxed text-slate-400">
            Zrób zdjęcie <strong className="text-slate-200">przodu</strong>{' '}
            butelki / opakowania — tak jak na zdjęciu produktu w katalogu.
            Lens porównuje wygląd, nie czyta kodu EAN (do tego osobny czytnik).
          </p>

          <div className="relative mx-auto flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-2xl border border-dashed border-slate-600 bg-slate-800">
            {preview ? (
              <img src={preview} alt="" className="h-full w-full object-contain" />
            ) : (
              <div className="flex flex-col items-center gap-2 px-6 text-center text-slate-500">
                <Camera className="h-10 w-10 opacity-40" />
                <p className="text-sm">Przód produktu w kadrze</p>
              </div>
            )}
            {busy && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/65 px-4 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-brand-400" />
                <p className="text-sm text-white">{statusText || 'Analiza…'}</p>
              </div>
            )}
          </div>

          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
              e.target.value = '';
            }}
          />
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
              e.target.value = '';
            }}
          />

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => cameraRef.current?.click()}
              className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-600 py-3 text-sm font-medium text-white disabled:opacity-50"
            >
              <Camera className="h-5 w-5" />
              Zdjęcie
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
              className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-700 py-3 text-sm font-medium text-slate-300 disabled:opacity-50"
            >
              <Upload className="h-5 w-5" />
              Galeria
            </button>
          </div>

          {warning && !error && (
            <p className="rounded-xl bg-amber-500 px-3 py-2.5 text-sm font-semibold text-amber-950">
              {warning}
            </p>
          )}

          {error && (
            <p className="rounded-xl bg-red-600 px-3 py-2.5 text-sm font-semibold text-white">
              {error}
            </p>
          )}

          {matches && matches.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Propozycje ({matches.length}
                {method === 'clip' ? ' · wygląd' : ''})
              </h3>
              <ul className="space-y-2">
                {matches.map((m) => {
                  const img = getProductImageSafe(m.product);
                  return (
                    <li key={m.product.id}>
                      <button
                        type="button"
                        onClick={() => {
                          onSelect(m.product);
                          onClose();
                        }}
                        className="flex w-full items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/40 p-2 text-left hover:border-brand-500/40"
                      >
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-800">
                          {img ? (
                            <img src={img} alt="" className="h-full w-full object-contain p-1" />
                          ) : (
                            <ImageOff className="h-5 w-5 text-slate-600" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-100">
                            {m.product.displayName}
                          </p>
                          <p className="font-mono text-xs text-brand-400">{m.product.sku}</p>
                          <p className="text-xs text-slate-300">
                            Stan: {formatStock(m.product.stock ?? 0)}
                          </p>
                          <p className="truncate text-[11px] text-slate-500">
                            {m.reasons.join(' · ')}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full bg-brand-500/15 px-2 py-0.5 text-xs font-medium text-brand-300">
                          {Math.min(99, m.score)}%
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
