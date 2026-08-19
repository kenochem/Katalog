import {
  X, Camera, Upload, Loader2, Package, Pencil, Save, Trash2,
  Minus, Plus, Images, Printer, Tag, ArrowLeft,
  FileText, Barcode, Copy, Check, Scissors, Undo2, Layers,
  Sparkles, TrendingUp,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { Product, ProductVariant } from '../types';
import { ACCESSORY_CATEGORIES } from '../types';
import { manufacturerOptions, normalizeManufacturer, effectiveManufacturer } from '../lib/waproManufacturers';
import {
  getProductImage, getProductImages, updateProductImage, addProductExtraImage,
  updateProduct, deleteProductImage, deleteProductExtraImage, fetchProductById,
  deleteProduct, isProductSkuTaken,
} from '../lib/products';
import {
  customerGrossPrice,
  formatStock,
  formatPricePln,
  formatMarginPercent,
  marginPercent,
  stripHtml,
} from '../lib/format';
import { addToLabelQueue } from '../lib/labelQueue';
import { showToast } from '../lib/toast';
import { roleCan, type AppRole } from '../lib/roles';
import { canUseCrmModule } from '../app/productAccess';
import {
  resolveProductLocation,
  setProductLocation,
} from '../lib/locationStore';
import { formatLocationCode, parseLocationCode } from '../lib/warehouseLocation';
import { RemoveBackgroundModal } from './RemoveBackgroundModal';
import {
  WarehouseLocationFields,
} from './warehouse/WarehouseLocationFields';
import { useWarehouseLayoutRevision } from './warehouse/WarehouseHubPanel';
import { REMOVE_BG_PRESETS } from '../lib/removeWhiteBackground';
import {
  backupPrimaryImageForRevert,
  getPrimaryImageRevertUrl,
  restorePrimaryImageFromRevert,
} from '../lib/productImageRevert';
import {
  ProductDetailDataPanel,
  ProductDetailPriceGrid,
  ProductDetailCatalogQuickActions,
  ProductDetailDescPanel,
  ProductDetailAiPanel,
  parametersToText,
  type ProductMeta,
} from './product/ProductDetailRichPanels';
import { ProductDetailSalesPanel } from './product/ProductDetailSalesPanel';
import {
  mergeProductMeta,
  parseParametersText,
} from '../lib/productMeta';
import { ProductKnowledgeStatus } from './product/ProductKnowledgeStatus';
import { suggestShortDescription } from '../lib/productKnowledge';
import { BaselinkerTag } from './BaselinkerTag';
import { baselinkerLinkLabel, hasBaselinkerLink } from '../lib/baselinkerLink';
import { getShopCategoryTree, walkShopLeaves } from '../lib/shopCategoryTree';

interface ProductDetailProps {
  product: Product;
  onClose: () => void;
  onImageUpdated?: (productId: string, url: string) => void;
  onProductUpdated?: (product: Product) => void;
  onProductDeleted?: (productId: string) => void;
  onLabelQueueChange?: () => void;
  onOrderDraftChange?: () => void;
  role?: AppRole;
  /** Układ jak Trade Hub (katalog / stock). */
  hubStyle?: boolean;
  isFavorite?: boolean;
  onToggleFavorite?: (productId: string) => void;
  collectionUserKey?: string;
  onCollectionsChange?: () => void;
}

export function ProductDetail({
  product,
  onClose,
  onImageUpdated,
  onProductUpdated,
  onProductDeleted,
  onLabelQueueChange,
  onOrderDraftChange,
  role = 'guest',
  hubStyle = false,
  isFavorite = false,
  onToggleFavorite,
  collectionUserKey,
  onCollectionsChange,
}: ProductDetailProps) {
  const [detail, setDetail] = useState(product);
  const [uploading, setUploading] = useState(false);
  const [uploadingExtra, setUploadingExtra] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState(product.displayName);
  const [editSku, setEditSku] = useState(product.sku);
  const [category, setCategory] = useState(product.category);
  const [manufacturer, setManufacturer] = useState(product.manufacturer || '');
  const [description, setDescription] = useState('');
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailLoadError, setDetailLoadError] = useState(false);
  const [ean, setEan] = useState(product.ean || '');
  const [stock, setStock] = useState(product.stock ?? 0);
  const [locationCode, setLocationCode] = useState(() =>
    formatLocationCode(resolveProductLocation(product.id, product.warehouseLocation)),
  );
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [localPrimaryImage, setLocalPrimaryImage] = useState<string | null>(null);
  const [localExtraImages, setLocalExtraImages] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const extraFileRef = useRef<HTMLInputElement>(null);
  const extraCameraRef = useRef<HTMLInputElement>(null);
  const [deleting, setDeleting] = useState(false);
  const [detailTab, setDetailTab] = useState<
    'info' | 'desc' | 'variants' | 'photos' | 'ai' | 'sales'
  >('info');
  const [copied, setCopied] = useState<'sku' | 'ean' | null>(null);
  const [stockSaving, setStockSaving] = useState(false);
  const [removeBgOpen, setRemoveBgOpen] = useState(false);
  const [removeBgBusy, setRemoveBgBusy] = useState(false);
  const [revertBusy, setRevertBusy] = useState(false);
  const [deleteProductBusy, setDeleteProductBusy] = useState(false);
  const [imageDragOver, setImageDragOver] = useState(false);
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);
  const [hasImageRevert, setHasImageRevert] = useState(
    () => !!getPrimaryImageRevertUrl(product.id),
  );
  const [editMeta, setEditMeta] = useState<ProductMeta>(() => ({ ...product.meta }));
  const [parametersText, setParametersText] = useState(() =>
    parametersToText(product.meta?.parameters),
  );
  const layoutRevision = useWarehouseLayoutRevision();

  const allImages = useMemo(() => {
    const base = getProductImages(detail);
    const withLocalPrimary = localPrimaryImage
      ? [localPrimaryImage, ...base.filter((url) => url !== localPrimaryImage)]
      : base;
    const merged = [...withLocalPrimary];
    for (const url of localExtraImages) {
      if (!merged.includes(url)) merged.push(url);
    }
    return merged;
  }, [detail, localPrimaryImage, localExtraImages]);

  useEffect(() => {
    let active = true;
    setDetail(product);
    setImagePreviewOpen(false);
    setDisplayName(product.displayName);
    setEditSku(product.sku);
    setCategory(product.category);
    setManufacturer(product.manufacturer || '');
    setDescription('');
    setDetailLoading(true);
    setDetailLoadError(false);
    setEan(product.ean || '');
    setStock(product.stock ?? 0);
    setLocationCode(
      formatLocationCode(resolveProductLocation(product.id, product.warehouseLocation)),
    );
    setLocalPrimaryImage(null);
    setLocalExtraImages([]);
    setSelectedIdx(0);
    setEditing(false);
    setEditMeta({ ...product.meta });
    setParametersText(parametersToText(product.meta?.parameters));
    const variantN = product.variants?.length ?? 0;
    setDetailTab(product.isGroup && variantN > 0 ? 'variants' : 'info');

    fetchProductById(product.id)
      .then((full) => {
        if (!active) return;
        if (full) {
          setDetail({
            ...full,
            variants: full.variants?.length ? full.variants : product.variants,
            isGroup: full.isGroup ?? product.isGroup ?? (full.variants?.length ?? 0) > 0,
          });
          setDescription(stripHtml(full.description));
          setEan(full.ean || '');
          setStock(full.stock ?? 0);
          setEditMeta({ ...full.meta });
          setParametersText(parametersToText(full.meta?.parameters));
        }
      })
      .catch((err) => {
        console.warn('fetchProductById', product.id, err);
        if (active) setDetailLoadError(true);
      })
      .finally(() => {
        if (active) setDetailLoading(false);
      });

    return () => {
      active = false;
    };
  }, [product]);

  useEffect(() => {
    if (selectedIdx >= allImages.length) {
      setSelectedIdx(Math.max(0, allImages.length - 1));
    }
  }, [allImages.length, selectedIdx]);

  const displayImage = allImages[selectedIdx] || null;
  const primaryImage = localPrimaryImage || getProductImage(detail);
  const isPrimarySelected = !!displayImage && displayImage === primaryImage;
  const isExtraSelected = !!displayImage && !isPrimarySelected;

  function syncProduct(updated: Product) {
    setDetail(updated);
    onProductUpdated?.(updated);
  }

  useEffect(() => {
    setHasImageRevert(!!getPrimaryImageRevertUrl(product.id));
  }, [product.id]);

  async function handleApplyRemoveBackground(
    preset: keyof typeof REMOVE_BG_PRESETS,
    processSource: string | Blob,
  ) {
    if (!displayImage || !isPrimarySelected) return;
    setRemoveBgBusy(true);
    try {
      await backupPrimaryImageForRevert(product.id, displayImage);
      setHasImageRevert(true);
      const { removeWhiteBackgroundToFile } = await import('../lib/removeWhiteBackground');
      const file = await removeWhiteBackgroundToFile(
        processSource,
        detail.sku || detail.id,
        REMOVE_BG_PRESETS[preset],
      );
      await handleUpload(file, { skipRevertToast: true });
      setRemoveBgOpen(false);
      showToast('Zapisano bez tła — możesz przywrócić poprzednie zdjęcie', 'ok', 5000);
    } catch (err) {
      console.error(err);
      showToast(
        err instanceof Error ? err.message : 'Nie udało się wyciąć tła',
        'error',
        5000,
      );
    } finally {
      setRemoveBgBusy(false);
    }
  }

  async function handleUpload(file: File, opts?: { skipRevertToast?: boolean }) {
    setUploading(true);
    try {
      const url = await updateProductImage(product.id, file);
      setLocalPrimaryImage(url);
      setSelectedIdx(0);
      onImageUpdated?.(product.id, url);
      syncProduct({
        ...detail,
        customImageUrl: url,
        hasImage: true,
      });
      if (!opts?.skipRevertToast) {
        showToast('Zdjęcie zapisane', 'ok');
      }
    } catch (err) {
      console.error(err);
      showToast('Błąd wgrywania zdjęcia', 'error');
    } finally {
      setUploading(false);
    }
  }

  async function handleRestoreImageBeforeNobg() {
    if (!hasImageRevert) return;
    if (!confirm('Przywrócić zdjęcie sprzed ostatniego wycinania tła?')) return;
    setRevertBusy(true);
    try {
      const url = await restorePrimaryImageFromRevert(product.id);
      setLocalPrimaryImage(url);
      setSelectedIdx(0);
      onImageUpdated?.(product.id, url);
      syncProduct({
        ...detail,
        customImageUrl: url,
        hasImage: true,
      });
      showToast('Przywrócono poprzednie zdjęcie', 'ok');
    } catch (err) {
      console.error(err);
      showToast(
        err instanceof Error ? err.message : 'Nie udało się przywrócić zdjęcia',
        'error',
      );
    } finally {
      setRevertBusy(false);
    }
  }

  async function handleUploadExtra(file: File) {
    setUploadingExtra(true);
    try {
      const url = await addProductExtraImage(product.id, file);
      setLocalExtraImages((prev) => [...prev, url]);
      setSelectedIdx(allImages.length);
      const extras = [...(detail.extraImageUrls || []), url];
      syncProduct({
        ...detail,
        extraImageUrls: extras,
        hasImage: true,
      });
      showToast('Dodano zdjęcie', 'ok');
    } catch (err) {
      console.error(err);
      showToast('Błąd wgrywania dodatkowego zdjęcia', 'error');
    } finally {
      setUploadingExtra(false);
    }
  }

  function applyImageFile(file: File) {
    if (!file.type.startsWith('image/')) {
      showToast('Wrzuć plik graficzny (JPG, PNG, WebP…)', 'warn');
      return;
    }
    const busy = uploading || uploadingExtra;
    if (busy) return;
    if (!hasPrimary) {
      void handleUpload(file);
      return;
    }
    if (detail.catalog !== 'shop') {
      void handleUploadExtra(file);
      return;
    }
    void handleUpload(file);
  }

  async function handleDeleteImage() {
    if (!displayImage) return;
    const message = allImages.length > 1
      ? 'Usunąć wybrane zdjęcie?'
      : 'Czy na pewno chcesz usunąć zdjęcie? Będziesz mógł wgrać nowe.';
    if (!confirm(message)) return;

    setDeleting(true);
    try {
      if (isExtraSelected) {
        await deleteProductExtraImage(product.id, displayImage);
        setLocalExtraImages((prev) => prev.filter((url) => url !== displayImage));
        const extras = (detail.extraImageUrls || []).filter((url) => url !== displayImage);
        syncProduct({
          ...detail,
          extraImageUrls: extras.length ? extras : undefined,
          hasImage: !!(getProductImage(detail) || extras.length),
        });
      } else {
        await deleteProductImage(product.id);
        setLocalPrimaryImage(null);
        const refreshed = await fetchProductById(product.id);
        if (refreshed) {
          syncProduct(refreshed);
          onImageUpdated?.(product.id, getProductImage(refreshed) || '');
        }
      }
      showToast('Zdjęcie usunięte', 'info');
    } catch (err) {
      console.error(err);
      showToast('Błąd usuwania zdjęcia', 'error');
    } finally {
      setDeleting(false);
    }
  }

  async function handleSaveEdits() {
    setSaving(true);
    try {
      const normalizedEan = ean.replace(/\D/g, '');
      const normalizedStock = Number.isFinite(stock) ? stock : 0;
      const normalizedSku = editSku.trim().toUpperCase();
      if (!normalizedSku) {
        showToast('Podaj SKU', 'warn');
        setSaving(false);
        return;
      }
      const skuChanged = normalizedSku !== detail.sku.toUpperCase();
      const stockTouched = normalizedStock !== detail.stock;
      const catalog = detail.catalog || 'accessories';
      if (skuChanged) {
        const taken = await isProductSkuTaken(catalog, normalizedSku, detail.id);
        if (taken) {
          showToast(`SKU ${normalizedSku} jest już używany w tym katalogu`, 'error');
          setSaving(false);
          return;
        }
      }
      const updates: Partial<Product> = {
        displayName,
        category,
        manufacturer: normalizeManufacturer(manufacturer.trim()),
        description,
        ean: normalizedEan,
      };
      if (skuChanged) {
        updates.sku = normalizedSku;
        updates.stockManual = stockTouched;
        updates.meta = mergeProductMeta(detail.meta, {
          ...editMeta,
          legacySku: detail.sku.trim() || editMeta.legacySku,
          parameters: parseParametersText(parametersText),
        });
        if (stockTouched) {
          updates.stock = normalizedStock;
        }
      } else {
        updates.stock = normalizedStock;
        updates.stockManual = stockTouched || detail.stockManual;
        updates.meta = mergeProductMeta(detail.meta, {
          ...editMeta,
          parameters: parseParametersText(parametersText),
        });
      }
      await updateProduct(product.id, updates);
      if (skuChanged && !stockTouched) {
        showToast('SKU zapisany — stan i ceny uzupełni sync WAPRO (jeśli indeks jest w Mag)', 'info', 6000);
      }
      if (roleCan(role, 'editStock')) {
        const parsed = parseLocationCode(locationCode);
        const loc = Object.values(parsed).some(Boolean) ? parsed : null;
        await setProductLocation(product.id, loc);
      }
      const next = {
        ...detail,
        ...updates,
        sku: normalizedSku,
        meta: updates.meta,
        warehouseLocation: Object.values(parseLocationCode(locationCode)).some(Boolean)
          ? parseLocationCode(locationCode)
          : undefined,
      };
      onProductUpdated?.(next);
      setDetail(next);
      setEditSku(normalizedSku);
      setEditing(false);
      showToast(
        normalizedSku !== detail.sku.toUpperCase()
          ? `Zapisano — SKU: ${normalizedSku}`
          : 'Zapisano zmiany',
        'ok',
      );
    } catch (err) {
      console.error(err);
      showToast('Błąd zapisu', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteProductCompletely() {
    const label = detail.sku || detail.displayName || detail.id;
    if (
      !confirm(
        `Trwale usunąć produkt „${label}” z katalogu?\n\nZniknie z listy (także wpisy ze sklepu/JSON). Użyj tego, gdy chcesz zmienić kod SKU — usuń stary wpis i dodaj produkt z nowym kodem.\n\nTej operacji nie można cofnąć.`,
      )
    ) {
      return;
    }
    setDeleteProductBusy(true);
    try {
      await deleteProduct(detail.id);
      onProductDeleted?.(detail.id);
      showToast('Produkt usunięty', 'ok');
      onClose();
    } catch (err) {
      console.error(err);
      showToast('Nie udało się usunąć produktu', 'error');
    } finally {
      setDeleteProductBusy(false);
    }
  }

  async function quickStockDelta(delta: number) {
    if (!roleCan(role, 'editStock') || editing) return;
    const next = Math.max(0, Math.round((detail.stock ?? 0) + delta));
    setStockSaving(true);
    setDetail((d) => ({ ...d, stock: next, stockManual: true }));
    setStock(next);
    try {
      await updateProduct(detail.id, { stock: next, stockManual: true });
      onProductUpdated?.({ ...detail, stock: next, stockManual: true });
      showToast(`Stan: ${next}`, 'ok', 1800);
    } catch {
      setDetail((d) => ({ ...d, stock: detail.stock, stockManual: detail.stockManual }));
      setStock(detail.stock ?? 0);
      showToast('Nie udało się zapisać stanu', 'error');
    } finally {
      setStockSaving(false);
    }
  }

  async function copyText(text: string, kind: 'sku' | 'ean') {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 1500);
      showToast(kind === 'sku' ? 'Skopiowano SKU' : 'Skopiowano EAN', 'ok');
    } catch {
      showToast('Nie udało się skopiować', 'error');
    }
  }

  const editCategories = useMemo(() => {
    const shopLeaves = walkShopLeaves(getShopCategoryTree().roots).map((leaf) => leaf.label);
    return Array.from(
      new Set([
        detail.category,
        ...shopLeaves,
        ...ACCESSORY_CATEGORIES.filter((c) => c !== 'Wszystkie'),
      ].filter(Boolean)),
    ).sort((a, b) => a.localeCompare(b, 'pl'));
  }, [detail.category]);
  const categoryListId = `product-category-options-${detail.id.replace(/[^a-z0-9_-]/gi, '-')}`;
  const editManufacturers = manufacturerOptions([detail.manufacturer, manufacturer]);
  const displayManufacturer = effectiveManufacturer(detail);
  const variantCount = detail.variants?.length ?? 0;
  const isGroup = detail.isGroup || variantCount > 0;
  const hasPrimary = !!primaryImage;

  const showPrices = roleCan(role, 'viewPrices');
  const customerPrice = customerGrossPrice(detail.priceSaleGross, detail.priceSaleNet, detail.meta?.vatRate);
  const customerPriceEstimated =
    detail.priceSaleGross == null && detail.priceSaleNet != null && customerPrice != null;
  const canDeleteProduct = roleCan(role, 'deleteProduct');
  const stockTone =
    detail.stock <= 0
      ? 'text-red-400 bg-red-500/10 border-red-500/30'
      : detail.stock <= 5
        ? 'text-amber-300 bg-amber-500/10 border-amber-500/30'
        : 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30';

  const canUploadImages = roleCan(role, 'uploadImage');
  const hubTabs = useMemo(() => {
    const tabs: {
      id: 'info' | 'desc' | 'variants' | 'photos' | 'ai' | 'sales';
      label: string;
      icon: typeof Package;
    }[] = [
      { id: 'info', label: 'Dane', icon: Package },
      ...(showPrices
        ? [{ id: 'sales' as const, label: 'Sprzedaż', icon: TrendingUp }]
        : []),
      ...(canUploadImages
        ? [{ id: 'photos' as const, label: 'Zdjęcia', icon: Images }]
        : []),
      ...(variantCount > 0
        ? [{ id: 'variants' as const, label: `Warianty (${variantCount})`, icon: Layers }]
        : []),
      { id: 'desc', label: 'Opisy', icon: FileText },
      { id: 'ai', label: 'AI', icon: Sparkles },
    ];
    return tabs;
  }, [variantCount, canUploadImages, showPrices]);

  const allowHubImageDrop = hubStyle && canUploadImages && detailTab === 'photos';

  const resolvedLocation = formatLocationCode(
    resolveProductLocation(detail.id, detail.warehouseLocation),
  );

  /** Na telefonie: zdjęcie i ceny tylko w zakładkach Dane / Zdjęcia — więcej miejsca na Sprzedaż itd. */
  const showHubMediaColumn =
    detailTab === 'info' || detailTab === 'photos';

  function renderCatalogVisibilityEdit() {
    const hidden = editMeta.catalogHidden === true;
    return (
      <div className="catalog-visibility-edit rounded-2xl border p-3">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={hidden}
            onChange={(e) => {
              const nextHidden = e.target.checked;
              setEditMeta((m: ProductMeta) => ({
                ...m,
                catalogHidden: nextHidden,
                catalogHiddenAt: nextHidden
                  ? m.catalogHiddenAt || new Date().toISOString()
                  : undefined,
                catalogHiddenReason: nextHidden ? m.catalogHiddenReason : undefined,
              }));
            }}
            className="catalog-visibility-edit__check mt-1 h-4 w-4 rounded"
          />
          <span className="min-w-0">
            <span className="catalog-visibility-edit__title block text-sm font-semibold">
              Ukryj w katalogu
            </span>
            <span className="catalog-visibility-edit__desc mt-0.5 block text-xs leading-relaxed">
              Produkt zostaje w bazie i nadal może dostawać stany/ceny z WAPRO, ale nie pokazuje się
              domyślnie na liście produktów.
            </span>
          </span>
        </label>
        {hidden && (
          <label className="mt-3 block">
            <span className="catalog-visibility-edit__label mb-1 block text-xs font-medium">
              Powód ukrycia
            </span>
            <input
              value={editMeta.catalogHiddenReason ?? ''}
              onChange={(e) =>
                setEditMeta((m: ProductMeta) => ({
                  ...m,
                  catalogHiddenReason: e.target.value,
                }))
              }
              placeholder="np. stara marka, produkt przestarzały, nie sprzedajemy"
              className="input-field"
            />
          </label>
        )}
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className={`animate-fade-in w-full border border-slate-700 bg-slate-900 ${
          hubStyle
            ? 'catalog-product-modal flex max-h-[min(96dvh,calc(100dvh-env(safe-area-inset-bottom)-0.25rem))] flex-col overflow-hidden rounded-t-3xl pb-[env(safe-area-inset-bottom)] sm:h-[94dvh] sm:max-h-[94dvh] sm:rounded-2xl sm:pb-0 lg:max-w-[90rem] xl:max-w-[96rem]'
            : 'max-h-[92dvh] max-w-lg overflow-y-auto rounded-t-3xl sm:rounded-3xl lg:max-w-2xl'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {hubStyle ? (
          <div className="catalog-product-modal__head shrink-0 border-b border-slate-800 bg-slate-900/95 backdrop-blur">
            <div className="flex items-center gap-2 border-b border-slate-800/60 px-4 py-2.5">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-slate-400 transition hover:bg-slate-800 hover:text-slate-100"
              >
                <ArrowLeft className="h-4 w-4 shrink-0" />
                Lista produktów
              </button>
            </div>
            <div className="flex items-start justify-between gap-2 px-4 py-3">
              <div className="min-w-0 flex-1">
                {editing ? (
                  <input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="input-field text-lg font-semibold"
                  />
                ) : (
                  <h2 className="line-clamp-2 text-lg font-semibold leading-snug text-slate-50 lg:text-xl">
                    {displayName}
                  </h2>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {isGroup && variantCount > 0 ? (
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-brand-500/30 bg-brand-500/10 px-3 py-1.5 text-sm font-medium text-brand-200">
                      <Layers className="h-4 w-4 shrink-0" />
                      Grupa · {variantCount} wariantów
                    </span>
                  ) : (
                  <button
                    type="button"
                    onClick={() => void copyText(detail.sku, 'sku')}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/90 px-3 py-1.5 font-mono text-sm font-medium text-brand-200 hover:bg-slate-700"
                    title="Kopiuj SKU"
                  >
                    {copied === 'sku' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    SKU {detail.sku}
                  </button>
                  )}
                  {detail.ean && (
                    <button
                      type="button"
                      onClick={() => void copyText(detail.ean, 'ean')}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/90 px-3 py-1.5 font-mono text-sm text-slate-200 hover:bg-slate-700"
                      title="Kopiuj EAN"
                    >
                      {copied === 'ean' ? <Check className="h-4 w-4" /> : <Barcode className="h-4 w-4" />}
                      EAN {detail.ean}
                    </button>
                  )}
                  <span className={`rounded-lg border px-2.5 py-1 text-xs font-medium ${stockTone}`}>
                    {detail.stock <= 0 ? 'Brak' : formatStock(detail.stock)}
                  </span>
                  {showPrices &&
                    (detail.priceSaleGross != null || detail.priceSaleNet != null) && (
                      <span className="catalog-product-price-chip rounded-lg px-2.5 py-1 text-xs font-bold tabular-nums">
                        {formatPricePln(customerPrice)}
                        <span className="catalog-product-price-chip__unit ml-1 text-[10px]">
                          brutto{customerPriceEstimated ? '*' : ''}
                        </span>
                      </span>
                    )}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {roleCan(role, 'editProduct') && (
                  <ProductEditActions
                    editing={editing}
                    saving={saving}
                    hubStyle
                    onSave={() => void handleSaveEdits()}
                    onStartEdit={() => setEditing(true)}
                    onCancelEdit={() => setEditing(false)}
                  />
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-full p-2 text-slate-400 hover:bg-slate-800 lg:hidden"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="catalog-product-tabs flex snap-x snap-mandatory gap-1 overflow-x-auto px-4 pb-2 scrollbar-none">
              {hubTabs.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setDetailTab(id)}
                  className={`catalog-product-tab inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ${
                    detailTab === id ? 'catalog-product-tab--active' : ''
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>
          </div>
        ) : (
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-800 bg-slate-900/95 px-4 py-3 backdrop-blur">
          <span className="font-mono text-sm text-brand-400">
            {isGroup ? `Grupa · ${variantCount} wariantów` : detail.sku}
          </span>
          <div className="flex items-center gap-2">
            {roleCan(role, 'editProduct') && (
              <ProductEditActions
                editing={editing}
                saving={saving}
                onSave={() => void handleSaveEdits()}
                onStartEdit={() => setEditing(true)}
                onCancelEdit={() => setEditing(false)}
              />
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        )}

        <div
          className={
            hubStyle
              ? 'flex min-h-0 flex-1 flex-col overflow-y-auto lg:overflow-hidden'
              : undefined
          }
        >
        <div
          className={
            hubStyle
              ? 'grid min-h-0 flex-1 gap-4 p-4 lg:grid-cols-[minmax(18rem,32rem)_minmax(0,1fr)] lg:gap-8 lg:overflow-y-auto lg:p-6'
              : undefined
          }
        >
        <div className={hubStyle ? `${showHubMediaColumn ? 'flex' : 'hidden lg:flex'} flex-col gap-2 lg:sticky lg:top-0 lg:self-start` : undefined}>
        <div
          className={`relative bg-slate-800 ${
            hubStyle
              ? `aspect-[4/3] max-h-[min(38dvh,13.5rem)] overflow-hidden rounded-2xl border bg-white sm:max-h-[min(46dvh,24rem)] lg:max-h-[min(48dvh,28rem)] dark:bg-slate-800 ${
                  imageDragOver
                    ? 'border-brand-500 ring-2 ring-brand-500/40'
                    : 'border-slate-700 dark:border-slate-800'
                }`
              : 'aspect-square'
          }`}
          onDragEnter={
            allowHubImageDrop
              ? (e) => {
                  e.preventDefault();
                  setImageDragOver(true);
                }
              : undefined
          }
          onDragOver={
            allowHubImageDrop
              ? (e) => {
                  e.preventDefault();
                  setImageDragOver(true);
                }
              : undefined
          }
          onDragLeave={
            allowHubImageDrop
              ? (e) => {
                  if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                  setImageDragOver(false);
                }
              : undefined
          }
          onDrop={
            allowHubImageDrop
              ? (e) => {
                  e.preventDefault();
                  setImageDragOver(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) applyImageFile(file);
                }
              : undefined
          }
        >
          {roleCan(role, 'viewImages') && displayImage ? (
            <>
              <button
                type="button"
                onClick={() => setImagePreviewOpen(true)}
                className="block h-full w-full cursor-zoom-in"
                title="Powiększ zdjęcie"
              >
                <img
                  src={displayImage}
                  alt={detail.displayName}
                  className="h-full w-full object-contain p-4"
                />
              </button>
              {roleCan(role, 'deleteImage') && (
                <button
                  type="button"
                  disabled={deleting || uploading || uploadingExtra}
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleDeleteImage();
                  }}
                  className="absolute right-3 top-3 flex items-center gap-1.5 rounded-lg bg-red-600/90 px-3 py-2 text-sm font-medium text-white shadow-lg backdrop-blur transition hover:bg-red-500 disabled:opacity-50"
                >
                  {deleting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  {allImages.length > 1 ? 'Usuń to zdjęcie' : 'Usuń zdjęcie'}
                </button>
              )}
              {allImages.length > 1 && !hubStyle && (
                <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5 rounded-xl bg-black/75 p-1.5 backdrop-blur">
                  {allImages.map((url, idx) => (
                    <button
                      key={url}
                      type="button"
                      onClick={() => setSelectedIdx(idx)}
                      className={`h-12 w-12 overflow-hidden rounded-lg border-2 transition ${
                        idx === selectedIdx
                          ? 'border-brand-400'
                          : 'border-transparent opacity-70 hover:opacity-100'
                      }`}
                    >
                      <img src={url} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-500">
              <Package className="h-16 w-16" />
              <p className="text-sm font-mono text-brand-400">{detail.sku}</p>
              <p className="px-6 text-center text-sm text-slate-300">{detail.displayName}</p>
              {!roleCan(role, 'viewImages') && (
                <p className="text-xs text-slate-500">Podgląd bez zdjęć (gość)</p>
              )}
              {roleCan(role, 'viewImages') && !displayImage && (
                <p className="text-sm">
                  Brak zdjęcia — dodaj w zakładce Zdjęcia
                </p>
              )}
            </div>
          )}
          {hubStyle &&
            allowHubImageDrop &&
            imageDragOver && (
            <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-brand-500/15 backdrop-blur-[1px]">
              <p className="rounded-xl bg-slate-950/80 px-4 py-2 text-sm font-medium text-brand-100">
                Upuść, aby dodać zdjęcie
              </p>
            </div>
          )}
        </div>
        {hubStyle && allImages.length > 1 && roleCan(role, 'viewImages') && (
          <div className="flex gap-1.5 overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/40 p-2 scrollbar-none">
            {allImages.map((url, idx) => (
              <button
                key={url}
                type="button"
                onClick={() => setSelectedIdx(idx)}
                className={`h-14 w-14 shrink-0 overflow-hidden rounded-xl border-2 transition ${
                  idx === selectedIdx
                    ? 'border-brand-500'
                    : 'border-slate-700 opacity-70 hover:opacity-100'
                }`}
                title={`Zdjęcie ${idx + 1}`}
              >
                <img src={url} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
        {hubStyle && showPrices && !editing && detailTab === 'info' && (
          <ProductDetailPriceGrid detail={detail} compact />
        )}
        {hubStyle && !editing && detailTab === 'info' && (
          <ProductDetailCatalogQuickActions
            detail={detail}
            isFavorite={isFavorite}
            onToggleFavorite={
              onToggleFavorite && roleCan(role, 'manageFavorites')
                ? onToggleFavorite
                : undefined
            }
            onOpenAiTab={() => setDetailTab('ai')}
            collectionUserKey={collectionUserKey}
            onCollectionsChange={onCollectionsChange}
          />
        )}
        </div>

        <div className={hubStyle ? 'min-w-0 space-y-4 pb-1 sm:pb-0' : 'space-y-4 p-4'}>
          {hubStyle && roleCan(role, 'editStock') && detailTab === 'info' && !editing && (
            <div className="flex items-center justify-center gap-4 rounded-2xl border border-slate-800 bg-slate-950/60 py-3">
              <button
                type="button"
                disabled={stockSaving}
                onClick={() => void quickStockDelta(-1)}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700 text-slate-200 disabled:opacity-50"
              >
                <Minus className="h-4 w-4" />
              </button>
              <div className="text-center">
                <p className="text-[10px] uppercase tracking-wide text-slate-500">Stan magazynowy</p>
                <p className="text-2xl font-bold tabular-nums text-slate-50">
                  {formatStock(detail.stock ?? 0)}
                </p>
              </div>
              <button
                type="button"
                disabled={stockSaving}
                onClick={() => void quickStockDelta(1)}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          )}

          {hubStyle &&
            !editing &&
            (detailTab === 'info' || detailTab === 'desc' || detailTab === 'ai') && (
              <ProductKnowledgeStatus
                product={detail}
                compact={detailTab === 'info'}
                onEditDescriptions={
                  roleCan(role, 'editProduct')
                    ? () => {
                        setEditing(true);
                        setDetailTab('info');
                      }
                    : undefined
                }
              />
            )}

          {hubStyle && !editing && detailTab === 'info' && (
            <ProductDetailDataPanel
              detail={detail}
              showPrices={showPrices}
              pricesInPreview={showPrices}
              locationCode={resolvedLocation}
              isGroup={isGroup}
              variantCount={variantCount}
            />
          )}

          {hubStyle && !editing && detailTab === 'sales' && showPrices && (
            <ProductDetailSalesPanel detail={detail} />
          )}

          {hubStyle && !editing && detailTab === 'ai' && <ProductDetailAiPanel detail={detail} />}

          {hubStyle && !editing && detailTab === 'variants' && variantCount > 0 && detail.variants && (
            <ProductVariantsPanel variants={detail.variants} />
          )}

          {hubStyle && !editing && detailTab === 'desc' && (
            <ProductDetailDescPanel
              description={description}
              shortDescription={detail.meta?.shortDescription}
              loading={detailLoading}
              loadError={detailLoadError}
            />
          )}

          {hubStyle && editing && detailTab === 'info' && (
            <div className="space-y-3">
              <label className="block rounded-2xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-500/25 dark:bg-amber-500/5">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-amber-900 dark:text-amber-300">
                  Notatka wewnętrzna
                </span>
                <textarea
                  value={editMeta.internalNote ?? ''}
                  onChange={(e) =>
                    setEditMeta((m: ProductMeta) => ({ ...m, internalNote: e.target.value }))
                  }
                  rows={3}
                  placeholder="Ważne uwagi dla handlowca, BOK albo magazynu..."
                  className="input-field resize-y text-sm"
                />
              </label>
              {renderCatalogVisibilityEdit()}
              <label className="block">
                <span className="mb-1 text-xs text-slate-500">SKU (kod magazynowy)</span>
                <input
                  value={editSku}
                  onChange={(e) => setEditSku(e.target.value.toUpperCase())}
                  className="input-field font-mono uppercase"
                  autoComplete="off"
                  spellCheck={false}
                />
                <span className="mt-1 block text-[10px] text-slate-500">
                  Np. poprawka z placeholdera Baselinkera (BL…) na właściwy kod WAPRO.
                </span>
              </label>
              <label className="block">
                <span className="mb-1 text-xs text-slate-500">Nazwa wyświetlana</span>
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="input-field"
                />
              </label>
              <label className="block">
                <span className="mb-1 text-xs text-slate-500">Producent / marka</span>
                <select
                  value={manufacturer}
                  onChange={(e) => setManufacturer(e.target.value)}
                  className="input-field"
                >
                  <option value="">— wybierz —</option>
                  {editManufacturers.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 text-xs text-slate-500">Kategoria</span>
                <input
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  list={categoryListId}
                  placeholder="Wybierz lub wpisz kategorię"
                  className="input-field"
                />
                <datalist id={categoryListId}>
                  {editCategories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </label>
              <label className="block">
                <span className="mb-1 text-xs text-slate-500">EAN / kod kreskowy</span>
                <input
                  value={ean}
                  onChange={(e) => setEan(e.target.value.replace(/\D/g, ''))}
                  inputMode="numeric"
                  placeholder="np. 5901234567890"
                  className="input-field font-mono"
                />
              </label>
              <label className="block">
                <span className="mb-1 text-xs text-slate-500">
                  Stan magazynowy
                  {detail.stockManual && (
                    <span className="ml-1 text-brand-400">(ręczny)</span>
                  )}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setStock((s) => Math.max(0, s - 1))}
                    className="rounded-lg border border-slate-700 p-2 text-slate-300 hover:bg-slate-800"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={stock}
                    onChange={(e) => setStock(parseFloat(e.target.value) || 0)}
                    className="input-field text-center font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setStock((s) => s + 1)}
                    className="rounded-lg border border-slate-700 p-2 text-slate-300 hover:bg-slate-800"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </label>
              {roleCan(role, 'editStock') && (
                <ProductWarehouseEditDetails
                  locationCode={locationCode}
                  onLocationCodeChange={setLocationCode}
                  layoutRevision={layoutRevision}
                />
              )}
              <div className="space-y-3 border-t border-slate-800 pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Rozszerzenia (oferta / BaseLinker)
                </p>
                <label className="block">
                  <span className="mb-1 text-xs text-slate-500">ID BaseLinker</span>
                  <input
                    value={editMeta.baselinkerProductId ?? ''}
                    onChange={(e) =>
                      setEditMeta((m: ProductMeta) => ({ ...m, baselinkerProductId: e.target.value }))
                    }
                    className="input-field font-mono text-sm"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                    <span>Krótki opis oferty</span>
                    {!(editMeta.shortDescription ?? '').trim() && (
                      <button
                        type="button"
                        onClick={() =>
                          setEditMeta((m: ProductMeta) => ({
                            ...m,
                            shortDescription: suggestShortDescription(detail),
                          }))
                        }
                        className="font-medium text-brand-400 hover:text-brand-300"
                      >
                        Wstaw propozycję
                      </button>
                    )}
                  </span>
                  <textarea
                    value={editMeta.shortDescription ?? ''}
                    onChange={(e) =>
                      setEditMeta((m: ProductMeta) => ({ ...m, shortDescription: e.target.value }))
                    }
                    rows={3}
                    className="input-field resize-y text-sm"
                  />
                </label>
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="block">
                    <span className="mb-1 text-xs text-slate-500">Waga (kg)</span>
                    <input
                      type="number"
                      step="0.001"
                      min={0}
                      value={editMeta.weightKg ?? ''}
                      onChange={(e) =>
                        setEditMeta((m: ProductMeta) => ({
                          ...m,
                          weightKg: e.target.value ? parseFloat(e.target.value) : undefined,
                        }))
                      }
                      className="input-field"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 text-xs text-slate-500">Jednostka</span>
                    <input
                      value={editMeta.unit ?? ''}
                      onChange={(e) => setEditMeta((m: ProductMeta) => ({ ...m, unit: e.target.value }))}
                      placeholder="szt."
                      className="input-field"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 text-xs text-slate-500">VAT (%)</span>
                    <input
                      type="number"
                      step="1"
                      min={0}
                      max={100}
                      value={editMeta.vatRate ?? ''}
                      onChange={(e) =>
                        setEditMeta((m: ProductMeta) => ({
                          ...m,
                          vatRate: e.target.value ? parseFloat(e.target.value) : undefined,
                        }))
                      }
                      className="input-field"
                    />
                  </label>
                </div>
                <label className="block">
                  <span className="mb-1 text-xs text-slate-500">Parametry (nazwa: wartość, linia po linii)</span>
                  <textarea
                    value={parametersText}
                    onChange={(e) => setParametersText(e.target.value)}
                    rows={5}
                    placeholder={'Pojemność: 5 L\nZastosowanie: myjnie ciśnieniowe'}
                    className="input-field resize-y font-mono text-xs"
                  />
                </label>
              </div>
              {canDeleteProduct && (
                <div className="border-t border-slate-200 pt-4 dark:border-slate-800">
                  <button
                    type="button"
                    disabled={deleteProductBusy || saving}
                    onClick={() => void handleDeleteProductCompletely()}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-600 bg-red-600 py-3 text-sm font-semibold text-white shadow-sm transition hover:border-red-500 hover:bg-red-500 disabled:opacity-50 dark:border-red-500"
                  >
                    {deleteProductBusy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                    Usuń produkt na stałe
                  </button>
                  <p className="mt-2 text-center text-[11px] text-slate-500">
                    Zwolnij kod SKU — potem dodaj produkt z nowym kodem.
                  </p>
                </div>
              )}
            </div>
          )}

          {hubStyle && editing && detailTab === 'desc' && (
            <label className="block">
              <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
                Opis produktu
              </span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={16}
                className="input-field min-h-[min(50vh,22rem)] resize-y leading-relaxed"
                placeholder="Opis widoczny w katalogu i ofercie…"
              />
              <span className="mt-2 block text-[11px] text-slate-500">
                Edytujesz w zakładce Opisy — zapis obejmuje też dane z zakładki Dane.
              </span>
            </label>
          )}

          {hubStyle && editing && detailTab === 'variants' && variantCount > 0 && detail.variants && (
            <div className="space-y-2">
              <p className="text-xs text-slate-500">
                Warianty tylko do podglądu — SKU i stany pochodzą z WAPRO.
              </p>
              <ProductVariantsPanel variants={detail.variants} />
            </div>
          )}

          {hubStyle && detailTab === 'photos' && canUploadImages && (
            <HubProductPhotosPanel
              busy={uploading || uploadingExtra}
              hasPrimary={hasPrimary}
              allowExtra={detail.catalog !== 'shop'}
              displayImage={displayImage}
              isPrimarySelected={isPrimarySelected}
              hasImageRevert={hasImageRevert}
              removeBgBusy={removeBgBusy}
              revertBusy={revertBusy}
              onPickFile={applyImageFile}
              onOpenRemoveBg={() => setRemoveBgOpen(true)}
              onRestoreBeforeNobg={() => void handleRestoreImageBeforeNobg()}
              fileRef={fileRef}
              cameraRef={cameraRef}
              extraFileRef={extraFileRef}
              extraCameraRef={extraCameraRef}
              onUploadPrimary={handleUpload}
              onUploadExtra={handleUploadExtra}
            />
          )}

          {!hubStyle && (
          <>
          {editing ? (
            <div className="space-y-3">
              <label className="block rounded-2xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-500/25 dark:bg-amber-500/5">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-amber-900 dark:text-amber-300">
                  Notatka wewnętrzna
                </span>
                <textarea
                  value={editMeta.internalNote ?? ''}
                  onChange={(e) =>
                    setEditMeta((m: ProductMeta) => ({ ...m, internalNote: e.target.value }))
                  }
                  rows={3}
                  placeholder="Ważne uwagi dla handlowca, BOK albo magazynu..."
                  className="input-field resize-y text-sm"
                />
              </label>
              {renderCatalogVisibilityEdit()}
              <label className="block">
                <span className="mb-1 text-xs text-slate-500">SKU (kod magazynowy)</span>
                <input
                  value={editSku}
                  onChange={(e) => setEditSku(e.target.value.toUpperCase())}
                  className="input-field font-mono uppercase"
                  autoComplete="off"
                  spellCheck={false}
                />
                <span className="mt-1 block text-[10px] text-slate-500">
                  Np. poprawka z placeholdera Baselinkera (BL…) na właściwy kod WAPRO.
                </span>
              </label>
              <label className="block">
                <span className="mb-1 text-xs text-slate-500">Nazwa wyświetlana</span>
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="input-field"
                />
              </label>
              <label className="block">
                <span className="mb-1 text-xs text-slate-500">Producent / marka</span>
                <select
                  value={manufacturer}
                  onChange={(e) => setManufacturer(e.target.value)}
                  className="input-field"
                >
                  <option value="">— wybierz —</option>
                  {editManufacturers.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 text-xs text-slate-500">Kategoria</span>
                <input
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  list={categoryListId}
                  placeholder="Wybierz lub wpisz kategorię"
                  className="input-field"
                />
                <datalist id={categoryListId}>
                  {editCategories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </label>
              <label className="block">
                <span className="mb-1 text-xs text-slate-500">EAN / kod kreskowy</span>
                <input
                  value={ean}
                  onChange={(e) => setEan(e.target.value.replace(/\D/g, ''))}
                  inputMode="numeric"
                  placeholder="np. 5901234567890"
                  className="input-field font-mono"
                />
              </label>
              <label className="block">
                <span className="mb-1 text-xs text-slate-500">Opis / notatki</span>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="input-field resize-none"
                />
              </label>
              <label className="block">
                <span className="mb-1 text-xs text-slate-500">
                  Stan magazynowy
                  {detail.stockManual && (
                    <span className="ml-1 text-brand-400">(ręczny)</span>
                  )}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setStock((s) => Math.max(0, s - 1))}
                    className="rounded-lg border border-slate-700 p-2 text-slate-300 hover:bg-slate-800"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={stock}
                    onChange={(e) => setStock(parseFloat(e.target.value) || 0)}
                    className="input-field text-center font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setStock((s) => s + 1)}
                    className="rounded-lg border border-slate-700 p-2 text-slate-300 hover:bg-slate-800"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </label>
              {roleCan(role, 'editStock') && (
                <ProductWarehouseEditDetails
                  locationCode={locationCode}
                  onLocationCodeChange={setLocationCode}
                  layoutRevision={layoutRevision}
                />
              )}
              {canDeleteProduct && (
                <div className="border-t border-slate-200 pt-4 dark:border-slate-800">
                  <button
                    type="button"
                    disabled={deleteProductBusy || saving}
                    onClick={() => void handleDeleteProductCompletely()}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-600 bg-red-600 py-3 text-sm font-semibold text-white shadow-sm transition hover:border-red-500 hover:bg-red-500 disabled:opacity-50 dark:border-red-500"
                  >
                    {deleteProductBusy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                    Usuń produkt na stałe
                  </button>
                  <p className="mt-2 text-center text-[11px] text-slate-500">
                    Zwolnij kod SKU — potem dodaj produkt z nowym kodem.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <>
              <div>
                <h2 className="text-lg font-semibold text-slate-100">{displayName}</h2>
                {detail.name.trim() &&
                  detail.name.trim().toLowerCase() !== displayName.trim().toLowerCase() && (
                    <p className="mt-1 text-sm text-slate-400">{detail.name}</p>
                  )}
              </div>

              <div className="flex flex-wrap gap-2">
                {displayManufacturer ? (
                  <Badge label={`Producent: ${displayManufacturer}`} muted />
                ) : null}
                <Badge label={`Kategoria: ${category}`} />
                {hasBaselinkerLink(detail) ? (
                  <span
                    className="inline-flex items-center gap-1.5 rounded-lg border border-sky-500/40 bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-900 dark:bg-sky-500/10 dark:text-sky-200"
                    title={baselinkerLinkLabel(detail) ?? 'BaseLinker'}
                  >
                    <BaselinkerTag product={detail} size="md" />
                    BaseLinker
                  </span>
                ) : null}
                {detail.ean && <Badge label={`EAN: ${detail.ean}`} muted />}
                {!detail.ean && !editing && (
                  <Badge label="Brak EAN" muted />
                )}
                <Badge
                  label={`Stan: ${formatStock(detail.stock ?? 0)}${
                    detail.stockManual ? ' · ręczny' : ''
                  }`}
                  muted={detail.stock > 0}
                  warning={detail.stock <= 0}
                />
                {formatLocationCode(
                  resolveProductLocation(detail.id, detail.warehouseLocation),
                ) && (
                  <Badge
                    label={`Lok: ${formatLocationCode(
                      resolveProductLocation(detail.id, detail.warehouseLocation),
                    )}`}
                    muted
                  />
                )}
              </div>

              {roleCan(role, 'viewPrices') &&
                (detail.pricePurchaseNet != null ||
                  detail.priceSaleNet != null ||
                  detail.priceSaleGross != null) && (
                  <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-800 bg-slate-950/40 p-3 sm:grid-cols-4">
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                        Zakup netto
                      </p>
                      <p className="mt-0.5 text-sm font-semibold tabular-nums text-slate-100">
                        {formatPricePln(detail.pricePurchaseNet)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                        Sprzedaż netto
                      </p>
                      <p className="mt-0.5 text-sm font-semibold tabular-nums text-slate-100">
                        {formatPricePln(detail.priceSaleNet)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-wide text-brand-400">
                        Sprzedaż brutto
                      </p>
                      <p className="mt-0.5 text-sm font-semibold tabular-nums text-brand-300">
                        {formatPricePln(customerPrice)}
                        {customerPriceEstimated ? (
                          <span className="ml-1 text-[10px] font-medium text-brand-400/80">
                            wylicz.
                          </span>
                        ) : null}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                        Marża
                      </p>
                      <p className="mt-0.5 text-sm font-semibold tabular-nums text-slate-100">
                        {formatMarginPercent(
                          marginPercent(detail.pricePurchaseNet, detail.priceSaleNet),
                        )}
                      </p>
                    </div>
                  </div>
                )}

              {description && (
                <p className="text-sm leading-relaxed text-slate-400">{description}</p>
              )}

              {variantCount > 0 && detail.variants && (
                <ProductVariantsPanel variants={detail.variants} />
              )}
            </>
          )}

          {roleCan(role, 'uploadImage') && !hubStyle && (
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUpload(f);
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
                  if (f) handleUpload(f);
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                disabled={uploading || uploadingExtra}
                onClick={() => cameraRef.current?.click()}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-600 py-3 text-sm font-medium text-white transition hover:bg-brand-500 disabled:opacity-50"
              >
                {uploading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Camera className="h-5 w-5" />
                )}
                {hasPrimary ? 'Zmień główne' : 'Zrób zdjęcie'}
              </button>
              <button
                type="button"
                disabled={uploading || uploadingExtra}
                onClick={() => fileRef.current?.click()}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-700 py-3 text-sm font-medium text-slate-300 transition hover:bg-slate-800 disabled:opacity-50"
              >
                <Upload className="h-5 w-5" />
                {hasPrimary ? 'Wgraj główne' : 'Wgraj plik'}
              </button>
            </div>

            {displayImage && (
              <button
                type="button"
                disabled={uploading || uploadingExtra || removeBgBusy}
                onClick={() => setRemoveBgOpen(true)}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-600 bg-slate-800/80 py-3 text-sm font-medium text-slate-200 transition hover:border-brand-500/40 hover:bg-slate-800 disabled:opacity-50"
              >
                <Scissors className="h-5 w-5 text-brand-300" />
                Wytnij białe tło (podgląd)
              </button>
            )}

            {hasImageRevert && isPrimarySelected && (
              <button
                type="button"
                disabled={uploading || revertBusy || removeBgBusy}
                onClick={() => void handleRestoreImageBeforeNobg()}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 py-3 text-sm font-medium text-amber-200 transition hover:bg-amber-500/15 disabled:opacity-50"
              >
                {revertBusy ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Undo2 className="h-5 w-5" />
                )}
                Przywróć zdjęcie sprzed wycinania tła
              </button>
            )}

            {hasPrimary && detail.catalog !== 'shop' && (
              <div className="flex gap-2">
                <input
                  ref={extraFileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUploadExtra(f);
                    e.target.value = '';
                  }}
                />
                <input
                  ref={extraCameraRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUploadExtra(f);
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  disabled={uploading || uploadingExtra}
                  onClick={() => extraCameraRef.current?.click()}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-brand-500/40 bg-brand-500/10 py-3 text-sm font-medium text-brand-200 transition hover:bg-brand-500/20 disabled:opacity-50"
                >
                  {uploadingExtra ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Images className="h-5 w-5" />
                  )}
                  Dodaj kolejne
                </button>
                <button
                  type="button"
                  disabled={uploading || uploadingExtra}
                  onClick={() => extraFileRef.current?.click()}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-700 py-3 text-sm font-medium text-slate-300 transition hover:bg-slate-800 disabled:opacity-50"
                >
                  <Upload className="h-5 w-5" />
                  Wgraj dodatkowe
                </button>
              </div>
            )}
          </div>
          )}

          {roleCan(role, 'printLabels') && (hubStyle ? detailTab === 'info' : true) && (
          <div className="border-t border-slate-800 pt-3">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-500">
              Etykiety
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  void import('../lib/printLabel').then(({ printShelfLabels }) => {
                    printShelfLabels([
                      {
                        id: detail.id,
                        sku: detail.sku,
                        displayName: detail.displayName,
                        ean: ean || detail.ean || detail.sku,
                        catalog: detail.catalog || 'accessories',
                      },
                    ]);
                    showToast('Otwarto podgląd druku etykiety', 'info');
                  });
                }}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-700 py-2.5 text-sm font-medium text-slate-400 transition hover:bg-slate-800 hover:text-slate-200"
              >
                <Printer className="h-4 w-4" />
                Drukuj
              </button>
              <button
                type="button"
                onClick={() => {
                  addToLabelQueue(detail);
                  onLabelQueueChange?.();
                  showToast('Dodano do kolejki druku', 'ok');
                }}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-700 py-2.5 text-sm font-medium text-slate-400 transition hover:bg-slate-800 hover:text-slate-200"
              >
                <Tag className="h-4 w-4" />
                Do kolejki
              </button>
            </div>
          </div>
          )}

          {canUseCrmModule(role) && !hubStyle && !detail.isGroup && (
            <div className="border-t border-slate-800 pt-3">
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-500">
                Zamówienie
              </p>
              <button
                type="button"
                onClick={() => {
                  void import('../lib/orderDraft').then(({ addToOrderDraft }) => {
                    addToOrderDraft({
                      ...detail,
                      imageUrl: getProductImage(detail) || undefined,
                    });
                    onOrderDraftChange?.();
                    showToast('Dodano do zamówienia', 'ok');
                  });
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-brand-500/40 bg-brand-500/10 py-2.5 text-sm font-medium text-brand-200 transition hover:bg-brand-500/20"
              >
                Do zamówienia
              </button>
            </div>
          )}
          </>
          )}
        </div>
        </div>
        </div>

        {hubStyle && editing && roleCan(role, 'editProduct') && (
          <div className="flex shrink-0 gap-2 border-t border-slate-200 bg-white/95 px-4 py-3 supports-[backdrop-filter]:backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/95">
            {canDeleteProduct ? (
              <button
                type="button"
                disabled={deleteProductBusy || saving}
                onClick={() => void handleDeleteProductCompletely()}
                className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-red-300 bg-red-50 px-3 text-sm font-semibold text-red-900 hover:bg-red-100 disabled:opacity-50 dark:border-red-500/50 dark:bg-red-500/10 dark:text-red-200 dark:hover:bg-red-500/20"
                title="Usuń produkt na stałe (zwolnij kod SKU)"
              >
                {deleteProductBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                <span className="hidden sm:inline">Usuń</span>
              </button>
            ) : null}
            <button
              type="button"
              disabled={saving}
              onClick={() => setEditing(false)}
              className="flex min-h-11 flex-1 items-center justify-center rounded-xl border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Anuluj
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSaveEdits()}
              className="flex min-h-11 flex-[1.4] items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-brand-500 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Save className="h-5 w-5" />
              )}
              Zapisz zmiany
            </button>
          </div>
        )}
      </div>
      {imagePreviewOpen && displayImage && (
        <ProductImagePreviewModal
          title={detail.displayName}
          images={allImages}
          selectedIdx={selectedIdx}
          onSelect={setSelectedIdx}
          onClose={() => setImagePreviewOpen(false)}
        />
      )}
      <RemoveBackgroundModal
        open={removeBgOpen}
        sourceUrl={displayImage}
        productName={detail.displayName}
        busy={removeBgBusy || uploading}
        onClose={() => !removeBgBusy && !uploading && setRemoveBgOpen(false)}
        onApply={(preset, src) => void handleApplyRemoveBackground(preset, src)}
      />
    </div>
  );
}

function HubProductPhotosPanel({
  busy,
  hasPrimary,
  allowExtra,
  displayImage,
  isPrimarySelected,
  hasImageRevert,
  removeBgBusy,
  revertBusy,
  onPickFile,
  onOpenRemoveBg,
  onRestoreBeforeNobg,
  fileRef,
  cameraRef,
  extraFileRef,
  extraCameraRef,
  onUploadPrimary,
  onUploadExtra,
}: {
  busy: boolean;
  hasPrimary: boolean;
  allowExtra: boolean;
  displayImage: string | null;
  isPrimarySelected: boolean;
  hasImageRevert: boolean;
  removeBgBusy: boolean;
  revertBusy: boolean;
  onPickFile: (file: File) => void;
  onOpenRemoveBg: () => void;
  onRestoreBeforeNobg: () => void;
  fileRef: RefObject<HTMLInputElement | null>;
  cameraRef: RefObject<HTMLInputElement | null>;
  extraFileRef: RefObject<HTMLInputElement | null>;
  extraCameraRef: RefObject<HTMLInputElement | null>;
  onUploadPrimary: (file: File) => void;
  onUploadExtra: (file: File) => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">
        Podgląd po lewej — możesz też przeciągnąć plik na zdjęcie. Miniaturki u dołu
        przełączają galerię.
      </p>
      <HubImageDropZone
        busy={busy}
        hasPrimary={hasPrimary}
        allowExtra={allowExtra}
        onPickFile={onPickFile}
      />
      <div className="space-y-2">
        <div className="flex gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onUploadPrimary(f);
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
              if (f) onUploadPrimary(f);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => cameraRef.current?.click()}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-600 py-3 text-sm font-medium text-white transition hover:bg-brand-500 disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Camera className="h-5 w-5" />
            )}
            {hasPrimary ? 'Zmień główne' : 'Zrób zdjęcie'}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-700 py-3 text-sm font-medium text-slate-300 transition hover:bg-slate-800 disabled:opacity-50"
          >
            <Upload className="h-5 w-5" />
            {hasPrimary ? 'Wgraj główne' : 'Wgraj plik'}
          </button>
        </div>

        {displayImage && (
          <button
            type="button"
            disabled={busy || removeBgBusy}
            onClick={onOpenRemoveBg}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-600 bg-slate-800/80 py-3 text-sm font-medium text-slate-200 transition hover:border-brand-500/40 hover:bg-slate-800 disabled:opacity-50"
          >
            <Scissors className="h-5 w-5 text-brand-300" />
            Wytnij białe tło (podgląd)
          </button>
        )}

        {hasImageRevert && isPrimarySelected && (
          <button
            type="button"
            disabled={busy || revertBusy || removeBgBusy}
            onClick={onRestoreBeforeNobg}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 py-3 text-sm font-medium text-amber-200 transition hover:bg-amber-500/15 disabled:opacity-50"
          >
            {revertBusy ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Undo2 className="h-5 w-5" />
            )}
            Przywróć zdjęcie sprzed wycinania tła
          </button>
        )}

        {hasPrimary && allowExtra && (
          <div className="flex gap-2">
            <input
              ref={extraFileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onUploadExtra(f);
                e.target.value = '';
              }}
            />
            <input
              ref={extraCameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onUploadExtra(f);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => extraCameraRef.current?.click()}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-brand-500/40 bg-brand-500/10 py-3 text-sm font-medium text-brand-200 transition hover:bg-brand-500/20 disabled:opacity-50"
            >
              <Images className="h-5 w-5" />
              Dodaj kolejne
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => extraFileRef.current?.click()}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-700 py-3 text-sm font-medium text-slate-300 transition hover:bg-slate-800 disabled:opacity-50"
            >
              <Upload className="h-5 w-5" />
              Wgraj dodatkowe
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ProductImagePreviewModal({
  title,
  images,
  selectedIdx,
  onSelect,
  onClose,
}: {
  title: string;
  images: string[];
  selectedIdx: number;
  onSelect: (idx: number) => void;
  onClose: () => void;
}) {
  const current = images[selectedIdx] || images[0];
  const hasMany = images.length > 1;

  function move(delta: number) {
    if (!images.length) return;
    onSelect((selectedIdx + delta + images.length) % images.length);
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') move(-1);
      if (e.key === 'ArrowRight') move(1);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  if (!current) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col bg-slate-950/95 text-white backdrop-blur"
      role="dialog"
      aria-label="Podgląd zdjęcia produktu"
      onClick={onClose}
    >
      <div className="flex shrink-0 items-center justify-between gap-3 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <p className="min-w-0 truncate text-sm font-semibold">{title}</p>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
          aria-label="Zamknij podgląd"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div
        className="relative min-h-0 flex-1 px-2 pb-2 sm:px-5"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={current}
          alt={title}
          className="h-full w-full object-contain"
        />
        {hasMany && (
          <>
            <button
              type="button"
              onClick={() => move(-1)}
              className="absolute left-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-xl font-bold text-white hover:bg-black/65"
              aria-label="Poprzednie zdjęcie"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => move(1)}
              className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-xl font-bold text-white hover:bg-black/65"
              aria-label="Następne zdjęcie"
            >
              ›
            </button>
          </>
        )}
      </div>

      {hasMany && (
        <div className="flex shrink-0 gap-2 overflow-x-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 scrollbar-none">
          {images.map((url, idx) => (
            <button
              key={url}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelect(idx);
              }}
              className={`h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 ${
                idx === selectedIdx ? 'border-brand-400' : 'border-white/20 opacity-70'
              }`}
              aria-label={`Pokaż zdjęcie ${idx + 1}`}
            >
              <img src={url} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function HubImageDropZone({
  busy,
  hasPrimary,
  allowExtra,
  onPickFile,
}: {
  busy: boolean;
  hasPrimary: boolean;
  allowExtra: boolean;
  onPickFile: (file: File) => void;
}) {
  const localFileRef = useRef<HTMLInputElement>(null);
  const localCameraRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const hint = !hasPrimary
    ? 'Dodaj główne zdjęcie produktu'
    : allowExtra
      ? 'Dodaj kolejne zdjęcie (galeria)'
      : 'Zastąp główne zdjęcie';

  return (
    <div
      className={`rounded-xl border-2 border-dashed px-3 py-4 transition ${
        dragOver
          ? 'border-brand-500 bg-brand-500/10'
          : 'border-slate-600 bg-slate-900/40 hover:border-slate-500'
      } ${busy ? 'pointer-events-none opacity-60' : ''}`}
      onDragEnter={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setDragOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file) onPickFile(file);
      }}
    >
      <input
        ref={localFileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPickFile(f);
          e.target.value = '';
        }}
      />
      <input
        ref={localCameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPickFile(f);
          e.target.value = '';
        }}
      />
      <div className="flex flex-col items-center gap-2 text-center">
        <Upload className="h-6 w-6 text-slate-400" />
        <p className="text-sm font-medium text-slate-200">Przeciągnij zdjęcie tutaj</p>
        <p className="text-xs text-slate-500">{hint}</p>
        <div className="mt-1 flex w-full max-w-xs gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => localCameraRef.current?.click()}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand-600 py-2 text-xs font-medium text-white hover:bg-brand-500 disabled:opacity-50"
          >
            <Camera className="h-4 w-4" />
            Aparat
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => localFileRef.current?.click()}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-600 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-50"
          >
            <Upload className="h-4 w-4" />
            Plik
          </button>
        </div>
      </div>
    </div>
  );
}

function ProductEditActions({
  editing,
  saving,
  hubStyle,
  onSave,
  onStartEdit,
  onCancelEdit,
}: {
  editing: boolean;
  saving: boolean;
  hubStyle?: boolean;
  onSave: () => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
}) {
  if (editing) {
    if (hubStyle) {
      return (
        <button
          type="button"
          onClick={onCancelEdit}
          disabled={saving}
          className="rounded-lg px-2 py-1.5 text-xs font-medium text-slate-400 hover:bg-slate-800 hover:text-slate-200 disabled:opacity-50"
        >
          Anuluj
        </button>
      );
    }
    return (
      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-500 disabled:opacity-50"
      >
        {saving ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <Save className="h-5 w-5" />
        )}
        Zapisz
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onStartEdit}
      disabled={saving}
      className={
        hubStyle
          ? 'rounded-full p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-100'
          : 'inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-700 px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800'
      }
      title="Edytuj"
    >
      <Pencil className="h-5 w-5" />
      {!hubStyle && <span>Edytuj</span>}
    </button>
  );
}

function ProductWarehouseEditDetails({
  locationCode,
  onLocationCodeChange,
  layoutRevision,
}: {
  locationCode: string;
  onLocationCodeChange: (value: string) => void;
  layoutRevision: number;
}) {
  return (
    <details className="group rounded-2xl border border-slate-700 bg-slate-950/30 dark:border-slate-800">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-slate-100 marker:hidden">
        <span>Magazyn i lokalizacja</span>
        <span className="flex items-center gap-2 text-xs font-medium text-slate-500">
          <span className="max-w-[12rem] truncate font-mono">
            {locationCode || 'Brak adresu'}
          </span>
          <span className="transition group-open:rotate-180">v</span>
        </span>
      </summary>
      <div className="border-t border-slate-800 px-4 pb-4 pt-3">
        <WarehouseLocationFields
          value={parseLocationCode(locationCode)}
          onChange={(loc) => onLocationCodeChange(formatLocationCode(loc))}
          onApplyQuickCode={(c) => onLocationCodeChange(formatLocationCode(parseLocationCode(c)))}
          layoutRevision={layoutRevision}
          compact
        />
      </div>
    </details>
  );
}

function ProductVariantsPanel({
  variants,
  compact,
}: {
  variants: ProductVariant[];
  compact?: boolean;
}) {
  async function copySku(sku: string) {
    try {
      await navigator.clipboard.writeText(sku);
      showToast('Skopiowano SKU', 'ok');
    } catch {
      showToast('Nie udało się skopiować', 'error');
    }
  }

  const totalStock = variants.reduce((sum, v) => sum + (v.stock ?? 0), 0);
  const list = compact ? variants.slice(0, 5) : variants;
  const hidden = compact ? Math.max(0, variants.length - list.length) : 0;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/40">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-brand-400" />
          <h3 className="text-sm font-semibold text-slate-100">
            Warianty SKU ({variants.length})
          </h3>
        </div>
        <p className="text-xs text-slate-500">
          Łączny stan:{' '}
          <span className="font-semibold tabular-nums text-slate-300">
            {formatStock(totalStock)}
          </span>
        </p>
      </div>
      <ul
        className={`divide-y divide-slate-800/80 overflow-y-auto ${
          compact ? 'max-h-48' : 'max-h-[min(28rem,50vh)]'
        }`}
      >
        {list.map((v) => (
          <li
            key={v.sku}
            className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-slate-900/50"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm leading-snug text-slate-200">{v.name}</p>
              {v.ean && (
                <p className="mt-0.5 font-mono text-[11px] text-slate-500">EAN {v.ean}</p>
              )}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <button
                type="button"
                onClick={() => void copySku(v.sku)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 font-mono text-xs font-medium text-brand-300 hover:border-brand-500/40 hover:bg-slate-800"
                title="Kopiuj SKU"
              >
                {v.sku}
                <Copy className="h-3 w-3 opacity-70" />
              </button>
              <span
                className={`text-xs font-medium tabular-nums ${
                  (v.stock ?? 0) <= 0 ? 'text-red-400' : 'text-slate-400'
                }`}
              >
                stan {formatStock(v.stock ?? 0)}
              </span>
            </div>
          </li>
        ))}
      </ul>
      {hidden > 0 && (
        <p className="border-t border-slate-800 px-4 py-2 text-center text-xs text-slate-500">
          + {hidden} kolejnych w zakładce Warianty
        </p>
      )}
    </div>
  );
}

function Badge({ label, muted, warning }: { label: string; muted?: boolean; warning?: boolean }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
        warning
          ? 'bg-red-500/15 text-red-300'
          : muted
            ? 'bg-slate-800 text-slate-400'
            : 'bg-brand-500/15 text-brand-300'
      }`}
    >
      {label}
    </span>
  );
}
