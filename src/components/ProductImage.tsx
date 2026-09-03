import { useEffect, useMemo, useState } from 'react';
import { ImageOff } from 'lucide-react';
import { collectProductImageCandidates, type ProductImageSource } from '../lib/products';

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

  useEffect(() => {
    setIndex(0);
  }, [candidates.join('|')]);

  const src = candidates[index] ?? null;

  if (!src) {
    return (
      <div
        className={
          placeholderClassName ||
          'flex h-full w-full items-center justify-center text-slate-500'
        }
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
      onError={() => {
        setIndex((i) => (i + 1 < candidates.length ? i + 1 : candidates.length));
      }}
    />
  );
}

export function hasDisplayableProductImage(product: ProductImageSource & { hasImage?: boolean }): boolean {
  if (collectProductImageCandidates(product).length > 0) return true;
  return Boolean(product.hasImage);
}
