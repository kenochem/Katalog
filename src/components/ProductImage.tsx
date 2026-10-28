import { useEffect, useMemo, useState } from 'react';
import { ImageOff } from 'lucide-react';
import { collectProductImageCandidates, type ProductImageSource } from '../lib/products';
import { isImageHostDown, recordImageError, recordImageOk, useImageHostHealthVersion } from '../lib/imageHostHealth';

type ProductImageProps = {
  product: ProductImageSource;
  alt?: string;
  className?: string;
  placeholderClassName?: string;
  loading?: 'lazy' | 'eager';
  sizes?: string;
  onClick?: () => void;
};

export function ProductImage({
  product,
  alt = '',
  className,
  placeholderClassName,
  loading = 'lazy',
  sizes,
  onClick,
}: ProductImageProps) {
  const candidates = useMemo(() => collectProductImageCandidates(product), [product]);
  const [index, setIndex] = useState(0);
  // odświeża kartę, gdy któryś host zdjęć zostanie uznany za niedostępny (albo wróci)
  useImageHostHealthVersion();

  useEffect(() => {
    setIndex(0);
  }, [candidates.join('|')]);

  // pierwszy adres od bieżącego, którego host nie jest uznany za niedostępny
  let at = index;
  while (at < candidates.length && isImageHostDown(candidates[at])) at++;
  const src = candidates[at] ?? null;
  const hostDown = !src && candidates.length > 0 && at >= candidates.length && candidates.slice(index).some((u) => isImageHostDown(u));

  if (!src) {
    return (
      <div
        className={placeholderClassName || 'flex h-full w-full items-center justify-center text-slate-500'}
        title={hostDown ? 'Zdjęcie chwilowo niedostępne — serwer zdjęć nie odpowiada' : undefined}
      >
        <ImageOff className="h-9 w-9" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading={loading}
      decoding="async"
      referrerPolicy="no-referrer"
      sizes={sizes}
      onClick={onClick}
      onLoad={() => recordImageOk(src)}
      onError={() => {
        recordImageError(src);
        setIndex(at + 1 < candidates.length ? at + 1 : candidates.length);
      }}
    />
  );
}

export function hasDisplayableProductImage(product: ProductImageSource & { hasImage?: boolean }): boolean {
  if (collectProductImageCandidates(product).length > 0) return true;
  return Boolean(product.hasImage);
}
