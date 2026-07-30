import { useEffect, useId, useRef, useState } from 'react';
import {
  X,
  Camera,
  Upload,
  Loader2,
  Sparkles,
  ScanLine,
  ImageOff,
} from 'lucide-react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import type { Product } from '../types';
import {
  getProductImageSafe,
  matchByEan,
  recognizeProductFromImage,
  type VisualMatch,
} from '../lib/visualSearch';
import { formatStock } from '../lib/format';

interface VisualSearchModalProps {
  products: Product[];
  onClose: () => void;
  onSelect: (product: Product) => void;
}

type Mode = 'ean' | 'photo';

export function VisualSearchModal({
  products,
  onClose,
  onSelect,
}: VisualSearchModalProps) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<Mode>('ean');
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [matches, setMatches] = useState<VisualMatch[] | null>(null);
  const [barcode, setBarcode] = useState<string | null>(null);
  const [ocrText, setOcrText] = useState<string | null>(null);
  const [method, setMethod] = useState<'ean' | 'ocr' | 'none' | null>(null);

  function finishWithMatches(
    list: VisualMatch[],
    opts?: {
      code?: string | null;
      warn?: string;
      method?: 'ean' | 'ocr' | 'none';
      ocr?: string;
      /** Auto-otwórz tylko przy pewnym EAN / mocnym OCR */
      autoOpen?: boolean;
    },
  ) {
    setMatches(list);
    if (opts?.code !== undefined) setBarcode(opts.code);
    if (opts?.warn) setWarning(opts.warn);
    if (opts?.method) setMethod(opts.method);
    if (opts?.ocr) setOcrText(opts.ocr.slice(0, 180));

    const canAuto =
      opts?.autoOpen !== false &&
      list.length === 1 &&
      (opts?.method === 'ean' || (opts?.method === 'ocr' && list[0].score >= 88));

    if (canAuto) {
      onSelect(list[0].product);
      onClose();
      return;
    }
    if (list.length === 0) {
      setError(
        opts?.warn ||
          'Brak wyniku. Nakieruj na kod EAN albo zrób zbliżenie na markę + nazwę.',
      );
    }
  }

  async function handleFile(file: File) {
    setError(null);
    setWarning(null);
    setMatches(null);
    setBarcode(null);
    setOcrText(null);
    setMethod(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(file));
    setBusy(true);
    setStatusText('Przygotowuję zdjęcie...');

    try {
      const result = await recognizeProductFromImage(
        file,
        products,
        (status, detail) => {
          if (status === 'barcode') setStatusText(detail || 'Szukam EAN...');
          else if (status === 'ocr') setStatusText(detail || 'Czytam etykietę...');
        },
      );
      finishWithMatches(result.matches, {
        code: result.barcode,
        warn: result.warning,
        method: result.method,
        ocr: result.ocrText,
      });
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error && err.message.length < 120
          ? err.message
          : 'Błąd analizy. Użyj kamery EAN.',
      );
    } finally {
      setBusy(false);
      setStatusText('');
    }
  }

  function handleLiveEan(code: string) {
    setError(null);
    setWarning(null);
    setOcrText(null);
    const found = matchByEan(products, code);
    finishWithMatches(found, { code, method: 'ean', autoOpen: true });
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
                1. EAN · 2. OCR marki · max 3 · bez zgadywania
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
          <div className="grid grid-cols-2 gap-1 px-3 pb-3 sm:px-4">
            <button
              type="button"
              onClick={() => {
                setMode('ean');
                setError(null);
                setWarning(null);
              }}
              className={`rounded-xl px-3 py-2.5 text-sm font-semibold ${
                mode === 'ean'
                  ? 'bg-brand-600 text-white'
                  : 'bg-slate-800 text-slate-300'
              }`}
            >
              Kamera EAN
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('photo');
                setError(null);
                setWarning(null);
              }}
              className={`rounded-xl px-3 py-2.5 text-sm font-semibold ${
                mode === 'photo'
                  ? 'bg-brand-600 text-white'
                  : 'bg-slate-800 text-slate-300'
              }`}
            >
              Zdjęcie
            </button>
          </div>
        </div>

        <div className="space-y-3 p-3 sm:p-4">
          {mode === 'ean' ? (
            <LiveEanPanel onScan={handleLiveEan} disabled={busy} />
          ) : (
            <>
              <p className="text-xs leading-relaxed text-slate-400">
                Najpewniej: <strong className="text-slate-200">kod EAN</strong>.
                Jeśli nie ma kodu — zbliż na{' '}
                <strong className="text-slate-200">markę + nazwę</strong> (OCR lokalnie,
                tylko w tej marce). Bez „zgadywania” z całego katalogu.
              </p>

              <div className="relative mx-auto flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-2xl border border-dashed border-slate-600 bg-slate-800">
                {preview ? (
                  <img src={preview} alt="" className="h-full w-full object-contain" />
                ) : (
                  <div className="flex flex-col items-center gap-2 px-6 text-center text-slate-500">
                    <Camera className="h-10 w-10 opacity-40" />
                    <p className="text-sm">EAN lub etykieta (marka)</p>
                  </div>
                )}
                {busy && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/65 px-4 text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-brand-400" />
                    <p className="text-sm text-white">{statusText || 'Analiza...'}</p>
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
            </>
          )}

          {barcode && (
            <p className="flex items-center gap-1.5 text-xs text-slate-400">
              <ScanLine className="h-3.5 w-3.5 text-brand-400" />
              EAN: <span className="font-mono text-slate-200">{barcode}</span>
            </p>
          )}

          {ocrText && (
            <p className="rounded-xl border border-slate-700 bg-slate-950/50 px-3 py-2 text-[11px] leading-snug text-slate-400">
              <span className="font-medium text-slate-500">OCR: </span>
              {ocrText}
            </p>
          )}

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
                {method === 'ean' ? ' · EAN' : method === 'ocr' ? ' · OCR' : ''})
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

function LiveEanPanel({
  onScan,
  disabled,
}: {
  onScan: (code: string) => void;
  disabled?: boolean;
}) {
  const containerId = useId().replace(/:/g, '');
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [starting, setStarting] = useState(true);
  const [camError, setCamError] = useState<string | null>(null);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;
  const scannedRef = useRef(false);

  useEffect(() => {
    if (disabled) return;
    let active = true;
    scannedRef.current = false;
    const scanner = new Html5Qrcode(containerId, {
      formatsToSupport: [
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.CODE_128,
      ],
      verbose: false,
    });
    scannerRef.current = scanner;

    async function start() {
      try {
        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 12,
            qrbox: { width: 300, height: 160 },
            aspectRatio: 1.4,
          },
          (decoded) => {
            if (scannedRef.current) return;
            const code = decoded.trim();
            if (!code) return;
            scannedRef.current = true;
            try {
              navigator.vibrate?.(40);
            } catch {
              /* ignore */
            }
            onScanRef.current(code);
            void scanner.stop().catch(() => undefined);
          },
          () => {},
        );
        if (active) setStarting(false);
      } catch (err) {
        console.error(err);
        if (active) {
          setCamError(
            'Brak kamery. Zezwól na aparat albo użyj „Zdjęcie”.',
          );
          setStarting(false);
        }
      }
    }

    void start();

    return () => {
      active = false;
      const s = scannerRef.current;
      scannerRef.current = null;
      if (s?.isScanning) void s.stop().catch(() => undefined);
    };
  }, [containerId, disabled]);

  return (
    <div className="space-y-2">
      <p className="text-xs leading-relaxed text-slate-400">
        Nakieruj na <strong className="text-slate-200">kod EAN</strong> — to
        najpewniejsza metoda. Produkt otworzy się po skanie.
      </p>
      <div className="relative overflow-hidden rounded-2xl bg-black">
        {starting && !camError && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60">
            <Loader2 className="h-8 w-8 animate-spin text-brand-400" />
          </div>
        )}
        <div id={containerId} className="min-h-[280px] w-full" />
      </div>
      {camError && (
        <p className="rounded-xl bg-red-600 px-3 py-2.5 text-sm font-semibold text-white">
          {camError}
        </p>
      )}
    </div>
  );
}
