import { memo, useCallback } from 'react';
import type { Product } from '../types';
import { ProductCard } from './ProductCard';
import { ProductRow } from './ProductRow';

export interface CatalogGridCardProps {
  product: Product;
  editMode: boolean;
  isFavorite: boolean;
  onProductClick: (product: Product) => void;
  onToggleFavorite?: (productId: string) => void;
  onStockDelta?: (product: Product, delta: number) => void;
  stockBusy: boolean;
  density: 'sm' | 'md' | 'lg' | 'list';
  orderQty: number;
  onOrderDelta?: (product: Product, delta: number) => void;
  hideImages: boolean;
  showPrices: boolean;
  showCatalogKind: boolean;
  collectionUserKey?: string;
  onCollectionsChange?: () => void;
}

export const CatalogGridCard = memo(function CatalogGridCard({
  product,
  editMode,
  isFavorite,
  onProductClick,
  onToggleFavorite,
  onStockDelta,
  stockBusy,
  density,
  orderQty,
  onOrderDelta,
  hideImages,
  showPrices,
  showCatalogKind,
  collectionUserKey,
  onCollectionsChange,
}: CatalogGridCardProps) {
  const handleClick = useCallback(() => {
    onProductClick(product);
  }, [onProductClick, product]);

  // wiersz (telefon) nie obsługuje edycji stanów ani zamówień — wtedy zostaje karta
  if (density === 'list' && !editMode && !onOrderDelta) {
    return (
      <ProductRow
        product={product}
        onClick={handleClick}
        isFavorite={isFavorite}
        onToggleFavorite={onToggleFavorite}
        hideImages={hideImages}
        showPrices={showPrices}
      />
    );
  }

  return (
    <ProductCard
      product={product}
      onClick={handleClick}
      editMode={editMode}
      isFavorite={isFavorite}
      onToggleFavorite={onToggleFavorite}
      onStockDelta={onStockDelta}
      stockBusy={stockBusy}
      density={density === 'list' ? 'md' : density}
      orderQty={orderQty}
      onOrderDelta={onOrderDelta}
      hideImages={hideImages}
      showPrices={showPrices}
      showCatalogKind={showCatalogKind}
      collectionUserKey={collectionUserKey}
      onCollectionsChange={onCollectionsChange}
    />
  );
});
