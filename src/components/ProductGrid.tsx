import { useEffect, useRef, useState, Fragment, startTransition } from 'react';
import type { Product } from '../types';

function initialBatch(): number {
  if (typeof window === 'undefined') return 24;
  return window.innerWidth < 640 ? 16 : 28;
}

function loadBatch(): number {
  if (typeof window === 'undefined') return 32;
  return window.innerWidth < 640 ? 16 : 32;
}

interface ProductGridProps {
  products: Product[];
  className: string;
  resetKey: string;
  renderItem: (product: Product) => React.ReactNode;
}

/** Montuje karty partiami przy scrollu — unika 1000+ węzłów DOM naraz. */
export function ProductGrid({ products, className, resetKey, renderItem }: ProductGridProps) {
  const [visible, setVisible] = useState(() =>
    Math.min(initialBatch(), products.length),
  );
  const sentinelRef = useRef<HTMLDivElement>(null);
  const batchRef = useRef(loadBatch());

  useEffect(() => {
    batchRef.current = loadBatch();
    setVisible(Math.min(initialBatch(), products.length));
  }, [resetKey, products.length]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || visible >= products.length) return;

    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        startTransition(() => {
          setVisible((v) => Math.min(v + batchRef.current, products.length));
        });
      },
      {
        // Mniejszy rootMargin na telefonie = mniej kart „z wyprzedzeniem”
        rootMargin: typeof window !== 'undefined' && window.innerWidth < 640
          ? '280px 0px'
          : '600px 0px',
      },
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
