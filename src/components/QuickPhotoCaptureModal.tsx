import { useRef, useState } from 'react';
import { Camera, Upload, Loader2, X, SkipForward, CheckCircle2, PartyPopper } from 'lucide-react';
import type { Product } from '../types';
import { updateProductImage } from '../lib/products';
import { ProductImage } from './ProductImage';
import { showToast } from '../lib/toast';

interface QuickPhotoCaptureModalProps {
  products: Product[];
  onImageUpdated: (productId: string, url: string) => void;
  onClose: () => void;
}

export function QuickPhotoCaptureModal({
  products,
  onImageUpdated,
  onClose,
}: QuickPhotoCaptureModalProps) {
  const [index, setIndex] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [doneCount, setDoneCount] = useState(0);
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const total = products.length;
  const current = products[index];
  const finished = index >= total;

  async function handleFile(file: File) {
    if (!current) return;
    setUploading(true);
    try {
      const url = await updateProductImage(current.id, file);
      onImageUpdated(current.id, url);
      setDoneCount((n) => n + 1);
      setIndex((i) => i + 1);
    } catch (err) {
      console.error(err);
      showToast('Błąd wgrywania zdjęcia — spróbuj ponownie', 'error');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-slate-950 text-slate-100">
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <div>
          <p className="text-sm font-semibold">Szybkie zdjęcia</p>
          {!finished && (
            <p className="text-xs text-slate-500">
              {index + 1} z {total} · dodano {doneCount}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
          aria-label="Zamknij"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {!finished && (
        <div className="h-1 w-full bg-slate-900">
          <div
            className="h-full bg-brand-500 transition-all"
            style={{ width: `${total ? (index / total) * 100 : 0}%` }}
          />
        </div>
      )}

      {finished ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
          <PartyPopper className="h-12 w-12 text-brand-400" />
          <div>
            <p className="text-lg font-semibold">Gotowe!</p>
            <p className="mt-1 text-sm text-slate-400">
              Dodano zdjęcia do {doneCount} z {total} produktów.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="mt-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-500"
          >
            Zamknij
          </button>
        </div>
      ) : current ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-4">
          <div className="flex h-56 w-56 items-center justify-center overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
            <ProductImage
              product={current}
              className="h-full w-full object-contain p-2"
              placeholderClassName="flex h-full w-full items-center justify-center text-slate-600"
            />
          </div>
          <div className="max-w-xs text-center">
            <p className="font-semibold text-slate-100">{current.displayName}</p>
            <p className="mt-0.5 font-mono text-xs text-slate-500">{current.sku}</p>
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

          <div className="mt-2 flex w-full max-w-xs flex-col gap-2">
            <button
              type="button"
              disabled={uploading}
              onClick={() => cameraRef.current?.click()}
              className="flex items-center justify-center gap-2 rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Camera className="h-4 w-4" />
              )}
              {uploading ? 'Zapisuję…' : 'Zrób zdjęcie'}
            </button>
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-700 py-3 text-sm font-medium text-slate-300 disabled:opacity-50"
            >
              <Upload className="h-4 w-4" />
              Wybierz plik
            </button>
            <button
              type="button"
              disabled={uploading}
              onClick={() => setIndex((i) => i + 1)}
              className="flex items-center justify-center gap-2 rounded-xl py-2 text-xs font-medium text-slate-500 hover:text-slate-300 disabled:opacity-50"
            >
              <SkipForward className="h-3.5 w-3.5" />
              Pomiń
            </button>
          </div>
        </div>
      ) : null}

      {doneCount > 0 && !finished && (
        <div className="flex items-center justify-center gap-1.5 border-t border-slate-800 py-2 text-xs text-emerald-400">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Ostatnio zapisano
        </div>
      )}
    </div>
  );
}
