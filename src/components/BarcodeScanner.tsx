import { useEffect, useId, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { X, Loader2 } from 'lucide-react';

interface BarcodeScannerProps {
  onScan: (code: string) => void;
  onClose: () => void;
}

export function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const containerId = useId().replace(/:/g, '');
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);

  const onScanRef = useRef(onScan);
  const onCloseRef = useRef(onClose);
  onScanRef.current = onScan;
  onCloseRef.current = onClose;

  useEffect(() => {
    let active = true;
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
            fps: 10,
            qrbox: { width: 280, height: 140 },
            aspectRatio: 1.5,
          },
          (decoded) => {
            const code = decoded.trim();
            if (!code) return;
            onScanRef.current(code);
            void scanner.stop().finally(() => onCloseRef.current());
          },
          () => {},
        );
        if (active) setStarting(false);
      } catch (err) {
        console.error(err);
        if (active) {
          setError(
            'Nie udało się uruchomić kamery. Zezwól na dostęp do aparatu w przeglądarce.',
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
      if (s?.isScanning) {
        void s.stop().catch(() => {});
      }
    };
  }, [containerId]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/80 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-t-3xl border border-slate-700 bg-slate-900 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <div>
            <h2 className="font-semibold text-slate-100">Skanuj kod kreskowy</h2>
            <p className="text-xs text-slate-400">EAN / kod kreskowy produktu</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="relative bg-black">
          {starting && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-black/80">
              <Loader2 className="h-8 w-8 animate-spin text-brand-400" />
              <p className="text-sm text-white/80">Uruchamianie kamery...</p>
            </div>
          )}
          <div id={containerId} className="min-h-[280px] w-full" />
        </div>

        {error && (
          <p className="border-t border-slate-800 px-4 py-3 text-sm text-red-300">
            {error}
          </p>
        )}

        <p className="border-t border-slate-800 px-4 py-3 text-center text-xs text-slate-500">
          Skieruj aparat na kod kreskowy — wyszukiwanie uruchomi się automatycznie
        </p>
      </div>
    </div>
  );
}
