import { memo } from 'react';
import { ImageOff, Layers, Star } from 'lucide-react';
import type { Product } from '../types';
import { ProductImage, hasDisplayableProductImage } from './ProductImage';
import { BaselinkerTag, WaproMagTag } from './BaselinkerTag';
import { customerGrossPrice, formatPricePln, formatStock } from '../lib/format';
import { getProductDisplayCategory } from '../lib/catalogCategory';
import { isCatalogHiddenProduct } from '../lib/productMeta';
import { useReservedQty } from '../lib/reservedStock';
import { useLivePromo } from '../lib/promotions';
import { copyText } from '../lib/copyText';

export interface ProductRowProps {
  product: Product;
  onClick: () => void;
  isFavorite?: boolean;
  onToggleFavorite?: (productId: string) => void;
  hideImages?: boolean;
  showPrices?: boolean;
}

/**
 * Wiersz produktu do telefonów: miniatura, nazwa (do 2 linii), SKU i kategoria, po prawej stan i cena.
 * Całość jest jednym dużym celem dotyku (otwiera produkt); gwiazdka i SKU mają własne przyciski.
 */
export const ProductRow = memo(function ProductRow({
  product,
  onClick,
  isFavorite = false,
  onToggleFavorite,
  hideImages = false,
  showPrices = false,
}: ProductRowProps) {
  const showImage = !hideImages && hasDisplayableProductImage(product);
  const reservedQty = useReservedQty(product.isGroup ? undefined : product.sku);
  const promo = useLivePromo(product.isGroup ? undefined : product.sku);
  const available = Math.max(0, (product.stock ?? 0) - reservedQty);
  const price = customerGrossPrice(product.priceSaleGross, product.priceSaleNet, product.meta?.vatRate);
  const hasPrice = showPrices && (price != null || promo != null);
  const hidden = isCatalogHiddenProduct(product);
  const stockTone =
    available <= 0
      ? 'bg-red-600/90 text-white'
      : available <= 5
        ? 'bg-amber-500/90 text-amber-950'
        : 'bg-emerald-600/90 text-white';

  return (
    <article className="product-card-cv relative flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/80 p-2.5 transition active:bg-slate-800/80">
      <button type="button" onClick={onClick} className="absolute inset-0 z-[1] rounded-2xl" aria-label={product.displayName} />

      <div className="pointer-events-none relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-xl bg-slate-800 ring-1 ring-slate-700/60">
        {showImage ? (
          <ProductImage
            product={product}
            alt=""
            className="h-full w-full object-contain p-1"
            placeholderClassName="flex h-full w-full items-center justify-center text-slate-500"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-slate-500">
            <ImageOff className="h-6 w-6" />
          </div>
        )}
        {product.isGroup && (
          <span className="absolute bottom-0.5 left-0.5 inline-flex items-center gap-0.5 rounded-md bg-emerald-600 px-1 py-0.5 text-[10px] font-bold leading-none text-white">
            <Layers className="h-2.5 w-2.5" />
            {product.variants?.length ?? 0}
          </span>
        )}
      </div>

      <div className="pointer-events-none min-w-0 flex-1 space-y-1">
        <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug text-slate-100">{product.displayName}</h3>
        <div className="flex min-w-0 items-center gap-1.5 text-[11px] text-slate-400">
          {!product.isGroup && product.sku && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                void copyText(product.sku, 'SKU');
              }}
              className="pointer-events-auto relative z-[2] shrink-0 rounded-md bg-slate-950/50 px-1.5 py-0.5 font-mono text-[11px] text-[#7dcf82] ring-1 ring-white/10 active:bg-slate-700"
              aria-label={`Skopiuj SKU ${product.sku}`}
            >
              {product.sku}
            </button>
          )}
          {!product.isGroup && <BaselinkerTag product={product} />}
          {!product.isGroup && <WaproMagTag product={product} />}
          <span className="min-w-0 truncate">{getProductDisplayCategory(product)}</span>
        </div>
        {hidden && (
          <span className="inline-block rounded-md border border-red-300 bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-red-800 dark:border-red-500/40 dark:bg-red-500/15 dark:text-red-200">
            {product.meta?.waproBlocked ? 'Blokada WAPRO' : 'Ukryty'}
          </span>
        )}
      </div>

      <div className="pointer-events-none flex shrink-0 flex-col items-end gap-1.5">
        <span className={`rounded-lg px-2 py-0.5 text-xs font-bold tabular-nums ${stockTone}`}>
          {formatStock(available)}
          {reservedQty > 0 && <span className="ml-1 rounded bg-amber-400 px-1 text-[10px] text-amber-950">R{formatStock(reservedQty)}</span>}
        </span>
        {hasPrice && (
          <span className="text-xs font-semibold tabular-nums text-brand-300">
            {promo ? <span className="text-red-400">{formatPricePln(promo.promoGross)}</span> : formatPricePln(price)}
          </span>
        )}
        {onToggleFavorite && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(product.id);
            }}
            className={`pointer-events-auto relative z-[2] -mr-1 rounded-full p-1.5 ${isFavorite ? 'text-amber-400' : 'text-slate-500 active:text-slate-200'}`}
            aria-label={isFavorite ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'}
          >
            <Star className={`h-4 w-4 ${isFavorite ? 'fill-current' : ''}`} />
          </button>
        )}
      </div>
    </article>
  );
});
