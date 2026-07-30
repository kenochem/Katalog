import {
  Camera,
  Upload,
  Loader2,
  ImageOff,
  Layers,
  Minus,
  Plus,
  Star,
} from 'lucide-react';
import { memo, useRef, useState } from 'react';
import type { Product } from '../types';
import { getProductImage, updateProductImage } from '../lib/products';
import { formatStock } from '../lib/format';
import { showToast } from '../lib/toast';

interface ProductCardProps {
  product: Product;
  onClick: () => void;
  showUpload?: boolean;
  editMode?: boolean;
  isFavorite?: boolean;
  onToggleFavorite?: (productId: string) => void;
  onStockDelta?: (product: Product, delta: number) => void;
  onImageUpdated?: (productId: string, url: string) => void;
  /** Ilość w zamówieniu (0 = nie dodane). */
  orderQty?: number;
  onOrderDelta?: (product: Product, delta: number) => void;
  /** Gość: bez zdjęć — tylko SKU / nazwa. */
  hideImages?: boolean;
  stockBusy?: boolean;
  density?: 'sm' | 'md' | 'lg';
}

export const ProductCard = memo(function ProductCard({
  product,
  onClick,
  showUpload = false,
  editMode = false,
  isFavorite = false,
  onToggleFavorite,
  onStockDelta,
  onImageUpdated,
  orderQty = 0,
  onOrderDelta,
  hideImages = false,
  stockBusy = false,
  density = 'md',
}: ProductCardProps) {
  const imageUrl = hideImages ? null : getProductImage(product);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const compact = density === 'sm';
  const cozy = density === 'lg';

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const url = await updateProductImage(product.id, file);
      onImageUpdated?.(product.id, url);
      showToast('Zdjęcie zapisane', 'ok');
    } catch (err) {
      console.error(err);
      showToast('Błąd wgrywania zdjęcia', 'error');
    } finally {
      setUploading(false);
    }
  }

  return (
    <article
      className={`product-card-cv relative flex flex-col overflow-hidden rounded-2xl border bg-slate-900/80 ${
        isFavorite ? 'border-amber-400/60' : 'border-slate-800'
      }`}
    >
      {onToggleFavorite && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(product.id);
          }}
          className={`absolute right-2 top-2 z-20 rounded-full p-1.5 ${
            isFavorite
              ? 'bg-amber-400 text-amber-950'
              : 'bg-black/55 text-white/85 hover:bg-black/70'
          }`}
          title={isFavorite ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'}
          aria-label={isFavorite ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'}
        >
          <Star className={`h-4 w-4 ${isFavorite ? 'fill-current' : ''}`} />
        </button>
      )}

      <div
            className={`relative overflow-hidden bg-slate-800 aspect-square`}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt=""
            className={`pointer-events-none h-full w-full object-contain ${
              compact ? 'p-1.5' : cozy ? 'p-4' : 'p-3'
            }`}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="pointer-events-none flex h-full items-center justify-center text-slate-500">
            <ImageOff className={compact ? 'h-6 w-6' : cozy ? 'h-12 w-12' : 'h-9 w-9'} />
          </div>
        )}

        <button
          type="button"
          onClick={onClick}
          className="absolute inset-0 z-[1]"
          aria-label={product.displayName}
        />

        <span
          className={`pointer-events-none absolute left-2 top-2 z-[2] rounded-md bg-black/70 font-mono text-[#7dcf82] ${
            compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs'
          }`}
        >
          {product.isGroup ? `${product.variants?.length ?? 0} war.` : product.sku}
        </span>

        {product.isGroup && !compact && !onOrderDelta && (
          <span className="pointer-events-none absolute bottom-2 left-2 z-[2] flex items-center gap-1 rounded-md bg-brand-600/90 px-2 py-0.5 text-xs text-white">
            <Layers className="h-3 w-3" />
            Grupa
          </span>
        )}

        {onOrderDelta && !product.isGroup && (
          <div className="absolute bottom-2 left-2 z-10">
            {orderQty > 0 ? (
              <div className="flex items-center gap-0.5 rounded-lg bg-black/80 p-0.5 shadow-md ring-1 ring-white/20">
                <button
                  type="button"
                  onClick={() => onOrderDelta(product, -1)}
                  className={`flex items-center justify-center rounded-md bg-red-600 text-white hover:bg-red-500 ${
                    compact ? 'h-6 w-6' : 'h-7 w-7'
                  }`}
                  title="Usuń z zamówienia"
                  aria-label="Zmniejsz ilość w zamówieniu"
                >
                  <Minus className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} strokeWidth={2.5} />
                </button>
                <span
                  className={`min-w-[1.25rem] text-center font-semibold tabular-nums text-white ${
                    compact ? 'px-0.5 text-[11px]' : 'px-1 text-xs'
                  }`}
                >
                  {orderQty}
                </span>
                <button
                  type="button"
                  onClick={() => onOrderDelta(product, 1)}
                  className={`flex items-center justify-center rounded-md bg-brand-600 text-white hover:bg-brand-500 ${
                    compact ? 'h-6 w-6' : 'h-7 w-7'
                  }`}
                  title="Dodaj do zamówienia"
                  aria-label="Zwiększ ilość w zamówieniu"
                >
                  <Plus className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} strokeWidth={2.5} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => onOrderDelta(product, 1)}
                className={`flex items-center justify-center rounded-lg bg-brand-600 text-white shadow-md shadow-brand-900/40 hover:bg-brand-500 ${
                  compact ? 'h-7 w-7' : 'h-8 w-8'
                }`}
                title="Dodaj do zamówienia"
                aria-label="Dodaj do zamówienia"
              >
                <Plus className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} strokeWidth={2.5} />
              </button>
            )}
          </div>
        )}

        {!editMode && (
          <span
            className={`pointer-events-none absolute bottom-2 right-2 z-[2] rounded-md font-medium ${
              compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs'
            } ${
              product.stock <= 0
                ? 'bg-red-700/90 text-white'
                : 'bg-black/70 text-white'
            }`}
          >
            {formatStock(product.stock ?? 0)}
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={onClick}
        className={`flex flex-1 flex-col gap-0.5 text-left ${
          compact ? 'p-2' : cozy ? 'p-4' : 'p-3'
        }`}
      >
        <h3
          className={`font-medium leading-snug text-slate-100 ${
            compact
              ? 'line-clamp-2 text-xs'
              : cozy
                ? 'line-clamp-2 text-base'
                : 'line-clamp-2 text-sm'
          }`}
        >
          {product.displayName}
        </h3>
        {!compact && !product.isGroup && (
          <p className={`mt-auto text-slate-500 ${cozy ? 'text-sm' : 'text-xs'}`}>
            {product.category}
          </p>
        )}
      </button>

      {editMode && onStockDelta && !product.isGroup && (
        <div className="flex items-center gap-1 border-t border-slate-800 p-2">
          <button
            type="button"
            disabled={stockBusy}
            onClick={(e) => {
              e.stopPropagation();
              onStockDelta(product, -1);
            }}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 text-slate-300 disabled:opacity-50"
            aria-label="Zmniejsz stan"
          >
            <Minus className="h-4 w-4" />
          </button>
          <span
            className={`min-w-0 flex-1 text-center text-sm font-semibold ${
              (product.stock ?? 0) <= 0 ? 'text-red-400' : 'text-slate-100'
            }`}
          >
            {formatStock(product.stock ?? 0)}
          </span>
          <button
            type="button"
            disabled={stockBusy}
            onClick={(e) => {
              e.stopPropagation();
              onStockDelta(product, 1);
            }}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white disabled:opacity-50"
            aria-label="Zwiększ stan"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      )}

      {showUpload && (
        <div className="flex gap-1 border-t border-slate-800 p-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleUpload(f);
              e.target.value = '';
            }}
          />
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleUpload(f);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => cameraRef.current?.click()}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand-600 py-2 text-xs font-medium text-white disabled:opacity-50"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            Zdjęcie
          </button>
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-700 py-2 text-xs font-medium text-slate-300 disabled:opacity-50"
          >
            <Upload className="h-4 w-4" />
            Plik
          </button>
        </div>
      )}
    </article>
  );
});
