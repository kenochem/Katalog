import { useEffect, useRef, useState, Fragment } from 'react';
import type { Product } from '../types';

const BATCH = 32;

interface ProductGridProps {
  products: Product[];
  className: string;
  resetKey: string;
  renderItem: (product: Product) => React.ReactNode;
}

/** Montuje karty partiami przy scrollu — unika 1000+ węzłów DOM naraz. */
export function ProductGrid({ products, className, resetKey, renderItem }: ProductGridProps) {
  const [visible, setVisible] = useState(() => Math.min(BATCH, products.length));
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setVisible(Math.min(BATCH, products.length));
  }, [resetKey, products.length]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || visible >= products.length) return;

    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        setVisible((v) => Math.min(v + BATCH, products.length));
      },
      { rootMargin: '800px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible, products.length]);

  const slice = products.slice(0, visible);

  return (
    <>
      <div className={`grid ${className}`}>
        {slice.map((p) => (
          <Fragment key={p.id}>{renderItem(p)}</Fragment>
        ))}
      </div>
      {visible < products.length && (
        <div
          ref={sentinelRef}
          className="flex justify-center py-3 text-xs text-slate-500"
          aria-hidden
        >
          {visible} / {products.length}
        </div>
      )}
    </>
  );
}
