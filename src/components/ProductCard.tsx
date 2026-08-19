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
import { memo, useRef, useState, type MouseEvent } from 'react';
import type { Product } from '../types';
import { CATALOG_LABELS } from '../types';
import { getProductImage, updateProductImage } from '../lib/products';
import { customerGrossPrice, formatStock, formatPricePln, formatMarginPercent, marginPercent } from '../lib/format';
import { resolveProductCatalogKind } from '../lib/catalogKind';
import { isCatalogHiddenProduct } from '../lib/productMeta';
import { showToast } from '../lib/toast';
import { getProductDisplayCategory } from '../lib/catalogCategory';
import { AddToCollectionMenu } from './AddToCollectionMenu';
import { BaselinkerTag, WaproMagTag } from './BaselinkerTag';

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
  /** Pokazuj cenę brutto (+ marżę) — role z viewPrices. */
  showPrices?: boolean;
  /** Pokazuj etykietę Akcesoria / Produkty (widok „Wszystkie”). */
  showCatalogKind?: boolean;
  /** Zalogowany użytkownik — ikona folderu na karcie. */
  collectionUserKey?: string;
  onCollectionsChange?: () => void;
}

export const ProductCard = memo(
  function ProductCard({
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
    showPrices = false,
    showCatalogKind = false,
    collectionUserKey,
    onCollectionsChange,
  }: ProductCardProps) {
  const imageUrl = hideImages ? null : getProductImage(product);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const compact = density === 'sm';
  const cozy = density === 'lg';
  const hasPrice =
    showPrices &&
    (product.priceSaleGross != null ||
      product.priceSaleNet != null ||
      product.pricePurchaseNet != null);
  const customerPrice = customerGrossPrice(product.priceSaleGross, product.priceSaleNet, product.meta?.vatRate);
  const margin = marginPercent(product.pricePurchaseNet, product.priceSaleNet);
  const catalogKind = resolveProductCatalogKind(product);
  const catalogKindShort =
    catalogKind === 'shop' ? 'Produkty' : CATALOG_LABELS.accessories;
  const catalogHidden = isCatalogHiddenProduct(product);

  async function copySku(e: MouseEvent) {
    e.stopPropagation();
    if (product.isGroup || !product.sku) return;
    try {
      await navigator.clipboard.writeText(product.sku);
      showToast('Skopiowano SKU', 'ok');
    } catch {
      showToast('Nie udało się skopiować', 'error');
    }
  }

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
        isFavorite
          ? 'border-amber-400/60 hover:border-amber-400 hover:bg-slate-800/90'
          : 'border-slate-800 hover:border-brand-500/45 hover:bg-slate-800/80'
      }`}
    >
      {onToggleFavorite && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(product.id);
          }}
          className={`group/fav absolute right-2 top-2 z-20 rounded-full p-1.5 ${
            isFavorite
              ? 'bg-amber-400 text-amber-950'
              : 'bg-black/55 text-white/85 hover:bg-black/70'
          }`}
          title={isFavorite ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'}
          aria-label={isFavorite ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'}
        >
          <Star className={`h-4 w-4 ${isFavorite ? 'fill-current' : ''}`} />
          <span
            className="pointer-events-none absolute right-0 top-full z-30 mt-1.5 hidden whitespace-nowrap rounded-md bg-black/90 px-2 py-1 text-[10px] font-medium text-white shadow-lg group-hover/fav:block"
            role="tooltip"
          >
            {isFavorite ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'}
          </span>
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
            sizes={compact ? '(max-width:640px) 30vw, 120px' : '(max-width:640px) 45vw, 180px'}
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

        <div className="absolute left-2 top-2 z-[3] flex max-w-[calc(100%-1rem)] flex-col items-start gap-1">
          {!product.isGroup && product.sku ? (
            <div className="flex max-w-full items-center gap-1">
              <button
                type="button"
                onClick={(e) => void copySku(e)}
                className={`group/sku relative max-w-full truncate rounded-md bg-black/70 font-mono text-[#7dcf82] ring-1 ring-white/10 transition hover:bg-black/85 hover:ring-brand-400/50 ${
                  compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs'
                }`}
                title="Kliknij, aby skopiować SKU"
                aria-label={`Skopiuj SKU ${product.sku}`}
              >
                {product.sku}
                <span
                  className="pointer-events-none absolute left-0 top-full z-30 mt-1.5 hidden whitespace-nowrap rounded-md bg-black/90 px-2 py-1 text-[10px] font-medium text-white shadow-lg group-hover/sku:block"
                  role="tooltip"
                >
                  Kliknij, aby skopiować SKU
                </span>
              </button>
              <BaselinkerTag product={product} />
              <WaproMagTag product={product} />
            </div>
          ) : (
            <div className="flex max-w-full items-center gap-1">
              <span
                className={`max-w-full truncate rounded-md bg-black/70 font-mono text-[#7dcf82] ${
                  compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs'
                }`}
              >
                {product.isGroup ? `${product.variants?.length ?? 0} war.` : product.sku}
              </span>
              {!product.isGroup ? <BaselinkerTag product={product} /> : null}
              {!product.isGroup ? <WaproMagTag product={product} /> : null}
            </div>
          )}
          {collectionUserKey && (
            <AddToCollectionMenu
              userKey={collectionUserKey}
              product={product}
              onChanged={onCollectionsChange}
            />
          )}
        </div>

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
        {showCatalogKind && (
          <span
            className={`mb-1 inline-flex w-fit max-w-full truncate rounded-md border px-2 py-0.5 font-semibold leading-none ${
              catalogKind === 'shop' ? 'hub-badge-violet' : 'hub-badge-sky'
            } ${compact ? 'text-[9px]' : 'text-[10px]'}`}
          >
            {catalogKindShort}
          </span>
        )}
        {catalogHidden && (
          <span
            className={`mb-1 inline-flex w-fit max-w-full truncate rounded-md border border-red-300 bg-red-50 px-2 py-0.5 font-semibold leading-none text-red-800 dark:border-red-500/40 dark:bg-red-500/15 dark:text-red-200 ${
              compact ? 'text-[9px]' : 'text-[10px]'
            }`}
            title={product.meta?.catalogHiddenReason || 'Produkt ukryty w katalogu'}
          >
            Ukryty
          </span>
        )}
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
        {hasPrice && (
          <p
            className={`tabular-nums font-semibold text-brand-300 ${
              compact ? 'text-[11px]' : cozy ? 'text-sm' : 'text-xs'
            }`}
          >
            {formatPricePln(customerPrice)}
            {margin != null && !compact && (
              <span className="ml-1.5 font-medium text-slate-500">
                {formatMarginPercent(margin)}
              </span>
            )}
          </p>
        )}
        {!compact && !product.isGroup && (
          <p className={`mt-auto text-slate-500 ${cozy ? 'text-sm' : 'text-xs'}`}>
            {getProductDisplayCategory(product)}
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
},
  (prev, next) =>
    prev.product === next.product &&
    prev.isFavorite === next.isFavorite &&
    prev.orderQty === next.orderQty &&
    prev.editMode === next.editMode &&
    prev.stockBusy === next.stockBusy &&
    prev.density === next.density &&
    prev.showPrices === next.showPrices &&
    prev.showCatalogKind === next.showCatalogKind &&
    prev.hideImages === next.hideImages &&
    prev.showUpload === next.showUpload &&
    prev.collectionUserKey === next.collectionUserKey,
);
