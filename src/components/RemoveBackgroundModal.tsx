import { useEffect, useRef, useState } from 'react';
import { Loader2, Upload, X } from 'lucide-react';
import { REMOVE_BG_PRESETS } from '../lib/removeWhiteBackground';

export function RemoveBackgroundModal({
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
  onApply: (
    preset: keyof typeof REMOVE_BG_PRESETS,
    processSource: string | Blob,
  ) => void;
}) {
  const [preset, setPreset] = useState<keyof typeof REMOVE_BG_PRESETS>('white');
  const [localFile, setLocalFile] = useState<File | null>(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processSource: string | Blob | null = localFile ?? sourceUrl;

  const beforePreviewUrl = localPreviewUrl ?? sourceUrl;

  const checkerStyle = {
    backgroundImage:
      'linear-gradient(45deg,#334155 25%,transparent 25%),linear-gradient(-45deg,#334155 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#334155 75%),linear-gradient(-45deg,transparent 75%,#334155 75%)',
    backgroundSize: '16px 16px',
    backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0',
  } as const;

  useEffect(() => {
    if (!open) {
      setLocalFile(null);
      setLocalPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    }
  }, [open]);

  useEffect(() => {
    if (!localFile) {
      setLocalPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      return;
    }
    const url = URL.createObjectURL(localFile);
    setLocalPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });
    return () => URL.revokeObjectURL(url);
  }, [localFile]);

  useEffect(() => {
    if (!open || !processSource) {
      setPreviewUrl(null);
      setPreviewError(null);
      return;
    }
    let cancelled = false;
    setPreviewing(true);
    setPreviewError(null);
    void (async () => {
      try {
        const { removeWhiteBackground } = await import('../lib/removeWhiteBackground');
        const blob = await removeWhiteBackground(processSource, REMOVE_BG_PRESETS[preset]);
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        setPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
      } catch (e) {
        if (!cancelled) {
          setPreviewError(e instanceof Error ? e.message : 'Podgląd nieudany');
          setPreviewUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return null;
          });
        }
      } finally {
        if (!cancelled) setPreviewing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, processSource, preset, localFile, sourceUrl]);

  useEffect(() => {
    if (!open) return;
    return () => {
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-3 sm:items-center sm:p-4"
      role="dialog"
      aria-modal
      aria-labelledby="remove-bg-title"
      onClick={onClose}
    >
      <div
        className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2 border-b border-slate-800 px-4 py-3">
          <div className="min-w-0">
            <h2 id="remove-bg-title" className="text-base font-semibold text-slate-50">
              Wytnij białe tło
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
          <div className="flex flex-wrap gap-2">
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
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-dashed border-slate-600 px-3 py-2 text-xs font-medium text-slate-300 hover:border-brand-500/50 hover:bg-slate-800"
            >
              <Upload className="h-4 w-4 shrink-0" />
              {localFile ? localFile.name : 'Wgraj plik z dysku (zalecane)'}
            </button>
          </div>

          <div className="flex gap-2">
            {(Object.keys(REMOVE_BG_PRESETS) as (keyof typeof REMOVE_BG_PRESETS)[]).map(
              (key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setPreset(key)}
                  className={`flex-1 rounded-xl border px-3 py-2 text-xs font-medium ${
                    preset === key
                      ? 'border-brand-500 bg-brand-500/15 text-brand-200'
                      : 'border-slate-700 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  {key === 'white' ? 'Białe tło' : 'Jasnoszare'}
                </button>
              ),
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="mb-1 text-[10px] uppercase tracking-wide text-slate-500">Przed</p>
              <div
                className="aspect-square overflow-hidden rounded-xl border border-slate-800 bg-slate-950"
                style={checkerStyle}
              >
                {beforePreviewUrl && (
                  <img src={beforePreviewUrl} alt="" className="h-full w-full object-contain p-2" />
                )}
              </div>
            </div>
            <div>
              <p className="mb-1 text-[10px] uppercase tracking-wide text-slate-500">Po</p>
              <div
                className="relative aspect-square overflow-hidden rounded-xl border border-slate-800 bg-slate-950"
                style={checkerStyle}
              >
                {previewing && (
                  <div className="flex h-full items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-brand-400" />
                  </div>
                )}
                {!previewing && previewUrl && (
                  <img src={previewUrl} alt="" className="h-full w-full object-contain p-2" />
                )}
                {!previewing && previewError && (
                  <p className="p-3 text-center text-xs text-rose-300">{previewError}</p>
                )}
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-500">
            Zapisze PNG z przezroczystością jako główne zdjęcie. Przed zapisem tworzymy kopię — możesz
            ją przywrócić przy produkcie. Przy błędzie CORS wgraj plik z dysku.
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
              disabled={busy || previewing || !!previewError || !previewUrl || !processSource}
              onClick={() => processSource && onApply(preset, processSource)}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-600 py-2.5 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Zapisz bez tła
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
