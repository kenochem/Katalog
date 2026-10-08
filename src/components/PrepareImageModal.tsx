import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Loader2, TriangleAlert, Upload, X } from 'lucide-react';
import {
  BASELINKER_MIN_SIDE,
  meetsMinSize,
  prepareImage,
  readImageSize,
  type PrepareMode,
  type PrepareResult,
} from '../lib/imagePrepare';

const checkerStyle = {
  backgroundImage:
    'linear-gradient(45deg,#334155 25%,transparent 25%),linear-gradient(-45deg,#334155 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#334155 75%),linear-gradient(-45deg,transparent 75%,#334155 75%)',
  backgroundSize: '16px 16px',
  backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0',
} as const;

/** Przygotowanie zdjecia pod BaseLinker: min. 500x500 px (skalowanie / kwadrat z dopelnieniem). */
export function PrepareImageModal({
  open,
  sourceUrl,
  productName,
  busy,
  onClose,
  onApply,
}: {
  open: boolean;
  sourceUrl: string | null;
  productName: string;
  busy: boolean;
  onClose: () => void;
  onApply: (result: PrepareResult) => void;
}) {
  const [mode, setMode] = useState<PrepareMode>('scale');
  const [localFile, setLocalFile] = useState<File | null>(null);
  const [beforeUrl, setBeforeUrl] = useState<string | null>(null);
  const [orig, setOrig] = useState<{ width: number; height: number } | null>(null);
  const [result, setResult] = useState<PrepareResult | null>(null);
  const [afterUrl, setAfterUrl] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const source: string | Blob | null = localFile ?? sourceUrl;

  useEffect(() => {
    if (!open) {
      setLocalFile(null);
      setMode('scale');
      setResult(null);
      setOrig(null);
      setError(null);
    }
  }, [open]);

  // podglad "przed"
  useEffect(() => {
    if (!localFile) {
      setBeforeUrl(sourceUrl);
      return;
    }
    const url = URL.createObjectURL(localFile);
    setBeforeUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [localFile, sourceUrl]);

  // wymiary oryginalu + wynik
  useEffect(() => {
    if (!open || !source) return;
    let cancelled = false;
    setWorking(true);
    setError(null);
    void (async () => {
      try {
        const size = await readImageSize(source);
        const res = await prepareImage(source, mode);
        if (cancelled) return;
        setOrig(size);
        setResult(res);
        setAfterUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return URL.createObjectURL(res.blob);
        });
      } catch (e) {
        if (!cancelled) {
          setResult(null);
          setError(
            e instanceof Error
              ? e.message
              : 'Nie udało się przetworzyć zdjęcia (przy błędzie CORS wgraj plik z dysku)',
          );
        }
      } finally {
        if (!cancelled) setWorking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, source, mode]);

  useEffect(() => {
    return () => {
      setAfterUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, [open]);

  if (!open) return null;

  const origOk = orig ? meetsMinSize(orig.width, orig.height) : null;
  const afterOk = result ? meetsMinSize(result.width, result.height) || (mode === 'square' && Math.max(result.width, result.height) >= BASELINKER_MIN_SIDE) : null;
  const unchanged = !!orig && !!result && orig.width === result.width && orig.height === result.height;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-3 sm:items-center sm:p-4"
      role="dialog"
      aria-modal
      aria-labelledby="prepare-img-title"
      onClick={onClose}
    >
      <div
        className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2 border-b border-slate-800 px-4 py-3">
          <div className="min-w-0">
            <h2 id="prepare-img-title" className="text-base font-semibold text-slate-50">
              Przygotuj zdjęcie pod BaseLinker
            </h2>
            <p className="mt-0.5 truncate text-xs text-slate-500">{productName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-800"
            aria-label="Zamknij"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3 p-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) setLocalFile(f);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-600 px-3 py-2 text-xs font-medium text-slate-300 hover:border-brand-500/50 hover:bg-slate-800"
          >
            <Upload className="h-4 w-4 shrink-0" />
            {localFile ? localFile.name : 'Użyj pliku z dysku zamiast obecnego zdjęcia'}
          </button>

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
                onClick={() => setMode(key)}
                className={`flex-1 rounded-xl border px-3 py-2 text-xs font-medium ${
                  mode === key
                    ? 'border-brand-500 bg-brand-500/15 text-brand-200'
                    : 'border-slate-700 text-slate-400 hover:bg-slate-800'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="mb-1 text-[10px] uppercase tracking-wide text-slate-500">
                Przed {orig ? `· ${orig.width}×${orig.height}` : ''}
              </p>
              <div
                className="aspect-square overflow-hidden rounded-xl border border-slate-800 bg-slate-950"
                style={checkerStyle}
              >
                {beforeUrl && (
                  <img src={beforeUrl} alt="" className="h-full w-full object-contain p-2" />
                )}
              </div>
            </div>
            <div>
              <p className="mb-1 text-[10px] uppercase tracking-wide text-slate-500">
                Po {result ? `· ${result.width}×${result.height}` : ''}
              </p>
              <div
                className="relative aspect-square overflow-hidden rounded-xl border border-slate-800 bg-slate-950"
                style={checkerStyle}
              >
                {working && (
                  <div className="flex h-full items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-brand-400" />
                  </div>
                )}
                {!working && afterUrl && !error && (
                  <img src={afterUrl} alt="" className="h-full w-full object-contain p-2" />
                )}
                {!working && error && (
                  <p className="p-3 text-center text-xs text-rose-300">{error}</p>
                )}
              </div>
            </div>
          </div>

          {orig && (
            <p
              className={`flex items-start gap-1.5 rounded-xl border px-3 py-2 text-xs ${
                origOk
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                  : 'border-amber-500/30 bg-amber-500/10 text-amber-200'
              }`}
            >
              {origOk ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              ) : (
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              )}
              {origOk
                ? `Zdjęcie ma ${orig.width}×${orig.height} px — spełnia minimum ${BASELINKER_MIN_SIDE}×${BASELINKER_MIN_SIDE}.${
                    mode === 'square' && !unchanged ? ' Zostanie tylko dopełnione do kwadratu.' : ' Nie trzeba skalować.'
                  }`
                : `Zdjęcie ma ${orig.width}×${orig.height} px — poniżej minimum ${BASELINKER_MIN_SIDE}×${BASELINKER_MIN_SIDE}. Zostanie powiększone${
                    result ? ` do ${result.width}×${result.height} px` : ''
                  } (jakość nie poprawi się — to tylko powiększenie; najlepiej wgrać większy plik).`}
            </p>
          )}
          {result && afterOk === false && (
            <p className="text-xs text-rose-300">
              Przy tak wąskim zdjęciu po powiększeniu krótszy bok nadal jest poniżej 500 px — użyj
              trybu „Kwadrat”.
            </p>
          )}

          <p className="text-xs text-slate-500">
            Zapisze wynik jako główne zdjęcie (przezroczystość zostaje). Przed zapisem tworzymy kopię —
            możesz ją przywrócić przy produkcie.
          </p>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="flex-1 rounded-xl border border-slate-700 py-2.5 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-50"
            >
              Anuluj
            </button>
            <button
              type="button"
              disabled={busy || working || !!error || !result || (unchanged && !localFile)}
              onClick={() => result && onApply(result)}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-600 py-2.5 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-50"
              title={unchanged && !localFile ? 'Zdjęcie nie wymaga zmian' : undefined}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {unchanged && !localFile ? 'Bez zmian' : 'Zapisz jako główne'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
