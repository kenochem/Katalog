import { confirmDialog } from '../lib/dialog';
import { HIDE_REASON_PRESETS } from '../lib/hideReasons';
import { CopyName } from './CopyName';
import { BatchPrepareModal } from './BatchPrepareModal';
import { isMobileDevice } from '../lib/device';
import {
  X, Camera, Upload, Loader2, Package, Pencil, Save, Trash2,
  Minus, Plus, Images, Printer, Tag, ArrowLeft,
  FileText, Barcode, Copy, Check, Scissors, Undo2, Layers,
  Sparkles, TrendingUp, Star, Maximize2, History as HistoryIcon, ChevronLeft, ChevronRight, ImageOff,
} from 'lucide-react';
import { ProductHistoryPanel } from './product/ProductHistoryPanel';
import { ProductAttributesPanel } from './product/ProductAttributesPanel';
import { attrValuesOf, type AttrValue } from '../lib/attributes';
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { Product, ProductVariant } from '../types';
import { ACCESSORY_CATEGORIES } from '../types';
import { normalizeManufacturer, effectiveManufacturer } from '../lib/waproManufacturers';
import { ManufacturerSelect } from './ManufacturerSelect';
import { ManufacturerLogo } from './ManufacturerLogo';


import { ProductImage } from './ProductImage';
import { getProductImage, getProductImages, updateProductImage, addProductExtraImage, setProductPrimaryImage, reorderProductImages, replaceProductImages,
  updateProduct, deleteProductImage, deleteProductExtraImage, fetchProductById,
  deleteProduct, isProductSkuTaken, fetchProductsBySkus, copyImagesToProducts,
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
import {
  blTextFromDesc,
  DESC_FIELDS,
  descFromBlText,
  descValuesOf,
  sanitizeDescriptionHtml,
  toEditorHtml,
  type DescKey,
  type DescValues,
} from '../lib/productDescriptions';
import { fetchBlDescriptions, pushBlDescriptions } from '../lib/baselinkerApi';
import { DescriptionBlBar, ProductDescriptionsEditor, ProductDescriptionsView } from './product/ProductDescriptionsTab';
import { RichTextField } from './product/RichTextField';

import { showToast } from '../lib/toast';
import { withAuditBatch } from '../lib/auditLog';
import { roleCan, type AppRole } from '../lib/roles';
import { ProductTechPanel } from './product/ProductTechPanel';
import { canUseCrmModule } from '../app/productAccess';
import {
  resolveProductLocation,
  setProductLocation,
} from '../lib/locationStore';
import { formatLocationCode, parseLocationCode } from '../lib/warehouseLocation';
import { RemoveBackgroundModal } from './RemoveBackgroundModal';
import { PrepareImageModal } from './PrepareImageModal';
import { useReservedQty } from '../lib/reservedStock';
import { useLivePromo } from '../lib/promotions';
import { prepareImage, type PrepareMode, type PrepareResult } from '../lib/imagePrepare';
import { ContextHelp } from './ContextHelp';
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
  ProductDetailAiPanel,
  parametersToText,
  type ProductMeta,
} from './product/ProductDetailRichPanels';
import { ProductDetailSalesPanel } from './product/ProductDetailSalesPanel';
import { BaselinkerProductPanel } from './product/BaselinkerProductPanel';
import {
  mergeProductMeta,
  parseParametersText,
} from '../lib/productMeta';
import { ProductKnowledgeStatus } from './product/ProductKnowledgeStatus';
import { suggestShortDescription } from '../lib/productKnowledge';
import { BaselinkerTag, WaproMagTag } from './BaselinkerTag';
import { baselinkerLinkLabel, hasBaselinkerLink } from '../lib/baselinkerLink';
import { useBaselinkerLinksVersion } from '../lib/baselinkerLive';
import { addCategory, cleanCategoryName, getAssignableCategories, useCategoryRegistry } from '../lib/categoryRegistry';

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
  /** Wszystkie produkty — do rozwiązania wariantów grupy na pełne produkty (zdjęcie, cena, znaczniki W/B). */
  catalogProducts?: Product[];
  /** Otwórz wariant grupy jako osobny podgląd produktu. */
  onOpenVariant?: (variant: Product) => void;
  /** Gdy produkt otwarto z grupy: powrót do grupy i przechodzenie między wariantami. */
  /** Po skopiowaniu zdjęć do wariantów — odśwież je na liście. */
  onVariantPatched?: (id: string, patch: Partial<Product>) => void;
  groupNav?: { groupName: string; index: number; total: number; onBack: () => void; onPrev?: () => void; onNext?: () => void; items?: string[]; onJump?: (i: number) => void };
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
  catalogProducts,
  onOpenVariant,
  onVariantPatched,
  groupNav,
}: ProductDetailProps) {
  useBaselinkerLinksVersion();
  const [detail, setDetail] = useState(product);
  const [uploading, setUploading] = useState(false);
  const [uploadingExtra, setUploadingExtra] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<[number, number] | null>(null);
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
  const [imgDrag, setImgDrag] = useState<{ from: number; over: number | null } | null>(null);
  const [reordering, setReordering] = useState(false);
  const [batchPrepareOpen, setBatchPrepareOpen] = useState(false);
  const isMobile = useMemo(() => isMobileDevice(), []);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const extraFileRef = useRef<HTMLInputElement>(null);
  const extraCameraRef = useRef<HTMLInputElement>(null);
  const [deleting, setDeleting] = useState(false);
  const [detailTab, setDetailTab] = useState<
    'info' | 'desc' | 'variants' | 'photos' | 'ai' | 'sales' | 'history'
  >('info');
  const [copied, setCopied] = useState<'sku' | 'ean' | null>(null);
  const [removeBgOpen, setRemoveBgOpen] = useState(false);
  const [blMissing, setBlMissing] = useState<string[]>([]);
  const reservedQty = useReservedQty(detail?.sku ?? product.sku);
  const livePromo = useLivePromo(detail?.isGroup ? undefined : (detail?.sku ?? product.sku));
  const isMissingInBl = (url: string) => {
    const base = url.split('?')[0].toLowerCase();
    return blMissing.some((m) => m.split('?')[0].toLowerCase() === base);
  };
  const [prepareOpen, setPrepareOpen] = useState(false);
  const [prepareBusy, setPrepareBusy] = useState(false);
  const [removeBgBusy, setRemoveBgBusy] = useState(false);
  const [revertBusy, setRevertBusy] = useState(false);
  const [deleteProductBusy, setDeleteProductBusy] = useState(false);
  const [settingPrimary, setSettingPrimary] = useState(false);
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

  const lastProductIdRef = useRef<string | null>(null);

  useEffect(() => {
    // ten sam produkt, tylko zaktualizowany (np. po wgraniu zdjęcia): zostajemy w tej samej zakładce i bez resetu formularza
    if (lastProductIdRef.current === product.id) {
      setDetail((prev) => ({ ...prev, ...product, description: prev.description || product.description }));
      return;
    }
    lastProductIdRef.current = product.id;
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
    setBlMissing([]);
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
          setDescription(full.description ?? '');
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

  async function handleApplyPrepare(result: PrepareResult) {
    if (!displayImage || !isPrimarySelected) {
      showToast('Wybierz zdjęcie główne (pierwsze w galerii)', 'warn', 4000);
      return;
    }
    setPrepareBusy(true);
    try {
      await backupPrimaryImageForRevert(product.id, displayImage);
      setHasImageRevert(true);
      const ext = result.blob.type === 'image/png' ? 'png' : result.blob.type === 'image/webp' ? 'webp' : 'jpg';
      const file = new File([result.blob], `${detail.sku || detail.id}.${ext}`, {
        type: result.blob.type || 'image/jpeg',
      });
      await handleUpload(file, { skipRevertToast: true });
      setPrepareOpen(false);
      showToast(
        `Zdjęcie przygotowane (${result.width}×${result.height}) — możesz przywrócić poprzednie`,
        'ok',
        5000,
      );
    } catch (err) {
      console.error(err);
      showToast(
        err instanceof Error ? err.message : 'Nie udało się przygotować zdjęcia',
        'error',
        5000,
      );
    } finally {
      setPrepareBusy(false);
    }
  }

  /** Dopasowuje wskazane zdjęcia produktu pod BaseLinker (min. 500×500) i podmienia je w tej samej kolejności. */
  async function handleBatchPrepare(
    urls: string[],
    mode: PrepareMode,
    onProgress: (done: number, total: number) => void,
  ): Promise<number> {
    const files = new Map<string, File>();
    let failed = 0;
    let done = 0;
    for (const url of urls) {
      try {
        const res = await prepareImage(url, mode);
        const ext = res.blob.type === 'image/png' ? 'png' : res.blob.type === 'image/webp' ? 'webp' : 'jpg';
        files.set(url, new File([res.blob], `${detail.sku || detail.id}.${ext}`, { type: res.blob.type || 'image/jpeg' }));
      } catch (err) {
        console.error(err);
        failed++;
      }
      onProgress(++done, urls.length);
    }
    if (files.size === 0) {
      showToast('Nie udało się przetworzyć zdjęć (blokada CORS?) — wgraj pliki z dysku', 'error', 6000);
      return 0;
    }
    try {
      const primary = allImages[0];
      if (primary && files.has(primary)) {
        try {
          await backupPrimaryImageForRevert(product.id, primary);
          setHasImageRevert(true);
        } catch (err) {
          console.warn('Kopia zdjęcia głównego pominięta', err);
        }
      }
      const order = await replaceProductImages(product.id, allImages, files);
      setLocalPrimaryImage(order[0]);
      setLocalExtraImages([]);
      syncProduct({ ...detail, customImageUrl: order[0], extraImageUrls: order.slice(1), hasImage: true });
      if (order[0] !== primaryImage) onImageUpdated?.(product.id, order[0]);
      showToast(failed ? `Dopasowano ${files.size}, błędy: ${failed}` : `Dopasowano zdjęcia pod BaseLinker: ${files.size}`, failed ? 'warn' : 'ok', 5000);
      return files.size;
    } catch (err) {
      console.error(err);
      showToast(err instanceof Error ? err.message : 'Nie udało się zapisać zdjęć', 'error', 6000);
      return 0;
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
    if (
      !(await confirmDialog({
        title: 'Przywrócić poprzednie zdjęcie?',
        tone: 'warn',
        confirmLabel: 'Przywróć',
        message: 'Zdjęcie sprzed ostatniej zmiany (wycinanie tła / skalowanie) zastąpi obecne zdjęcie główne.',
      }))
    )
      return;
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

  /** Wgrywa kilka zdjęć naraz (po kolei): bez zdjęcia głównego pierwsze zostaje głównym, reszta trafia do galerii. */
  async function handleUploadFiles(files: File[]) {
    const images = files.filter((f) => f.type.startsWith('image/'));
    if (images.length === 0) {
      showToast('Wrzuć pliki graficzne (JPG, PNG, WebP…)', 'warn');
      return;
    }
    if (uploading || uploadingExtra) return;
    setUploadingExtra(true);
    setUploadProgress([0, images.length]);
    let newPrimary: string | null = null;
    const added: string[] = [];
    let failed = 0;
    try {
      const queue = [...images];
      let done = 0;
      if (!hasPrimary) {
        const first = queue.shift()!;
        try {
          newPrimary = await updateProductImage(product.id, first);
        } catch (err) {
          console.error(err);
          failed++;
        }
        setUploadProgress([++done, images.length]);
      }
      for (const file of queue) {
        try {
          added.push(await addProductExtraImage(product.id, file));
        } catch (err) {
          console.error(err);
          failed++;
        }
        setUploadProgress([++done, images.length]);
      }
    } finally {
      setUploadingExtra(false);
      setUploadProgress(null);
    }
    if (!newPrimary && added.length === 0) {
      showToast('Nie udało się wgrać zdjęć', 'error');
      return;
    }
    if (newPrimary) {
      setLocalPrimaryImage(newPrimary);
      onImageUpdated?.(product.id, newPrimary);
    }
    if (added.length) setLocalExtraImages((prev) => [...prev, ...added.filter((u) => !prev.includes(u))]);
    syncProduct({
      ...detail,
      customImageUrl: newPrimary ?? detail.customImageUrl,
      extraImageUrls: [...(detail.extraImageUrls || []), ...added],
      hasImage: true,
    });
    setSelectedIdx(newPrimary ? 0 : allImages.length);
    const ok = (newPrimary ? 1 : 0) + added.length;
    showToast(failed ? `Wgrano ${ok}, błędy: ${failed}` : ok === 1 ? 'Dodano zdjęcie' : `Dodano zdjęcia: ${ok}`, failed ? 'warn' : 'ok');
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
    // Przeciągnięty plik na produkt, który ma już zdjęcie główne, dodaje zdjęcie dodatkowe
    // (we wszystkich katalogach, także w sklepie).
    void handleUploadExtra(file);
  }

  async function handleReorderImages(from: number, to: number) {
    if (reordering || from === to || from < 0 || to < 0 || from >= allImages.length || to >= allImages.length) return;
    const order = [...allImages];
    const [moved] = order.splice(from, 1);
    order.splice(to, 0, moved);
    const selectedUrl = displayImage;
    setReordering(true);
    try {
      await reorderProductImages(product.id, order);
      setLocalPrimaryImage(order[0]);
      setLocalExtraImages([]);
      syncProduct({ ...detail, customImageUrl: order[0], extraImageUrls: order.slice(1), hasImage: true });
      if (selectedUrl) setSelectedIdx(Math.max(0, order.indexOf(selectedUrl)));
      if (order[0] !== primaryImage) onImageUpdated?.(product.id, order[0]);
      showToast('Zmieniono kolejność zdjęć', 'ok', 1800);
    } catch (err) {
      console.error(err);
      showToast('Nie udało się zmienić kolejności zdjęć', 'error');
    } finally {
      setReordering(false);
    }
  }

  /** Miniatury przeciągane myszą (tylko dla osób z prawem wgrywania zdjęć). */
  function thumbDnd(idx: number) {
    if (!canUploadImages || allImages.length < 2) return {};
    return {
      draggable: true,
      onDragStart: (e: React.DragEvent) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(idx));
        setImgDrag({ from: idx, over: null });
      },
      onDragOver: (e: React.DragEvent) => {
        if (!imgDrag) return;
        e.preventDefault();
        e.stopPropagation();
        if (imgDrag.over !== idx) setImgDrag({ ...imgDrag, over: idx });
      },
      onDrop: (e: React.DragEvent) => {
        if (!imgDrag) return;
        e.preventDefault();
        e.stopPropagation();
        const from = imgDrag.from;
        setImgDrag(null);
        void handleReorderImages(from, idx);
      },
      onDragEnd: () => setImgDrag(null),
    };
  }

  function thumbDndClass(idx: number): string {
    if (!imgDrag) return '';
    if (imgDrag.from === idx) return ' opacity-30';
    if (imgDrag.over === idx) return ' ring-2 ring-brand-300 ring-offset-1 ring-offset-slate-900';
    return '';
  }

  async function handleSetAsPrimary() {
    if (!displayImage || isPrimarySelected) return;
    setSettingPrimary(true);
    try {
      await setProductPrimaryImage(product.id, displayImage);
      setLocalPrimaryImage(displayImage);
      setLocalExtraImages((prev) => prev.filter((url) => url !== displayImage));
      const oldPrimary = primaryImage;
      const extras = (detail.extraImageUrls || []).filter((url) => url !== displayImage);
      if (oldPrimary && !extras.includes(oldPrimary)) extras.push(oldPrimary);
      syncProduct({
        ...detail,
        customImageUrl: displayImage,
        extraImageUrls: extras,
        hasImage: true,
      });
      onImageUpdated?.(product.id, displayImage);
      showToast('Ustawiono jako zdjęcie główne', 'ok');
    } catch (err) {
      console.error(err);
      showToast('Nie udało się ustawić zdjęcia głównego', 'error');
    } finally {
      setSettingPrimary(false);
    }
  }

  async function handleDeleteImage() {
    if (!displayImage) return;
    const message = allImages.length > 1
      ? 'Usunąć wybrane zdjęcie?'
      : 'Czy na pewno chcesz usunąć zdjęcie? Będziesz mógł wgrać nowe.';
    if (
      !(await confirmDialog({
        title: allImages.length > 1 ? 'Usunąć to zdjęcie?' : 'Usunąć zdjęcie produktu?',
        tone: 'danger',
        message,
      }))
    )
      return;

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
        ean: normalizedEan,
      };
      // opis zapisujemy tylko po zmianie (nie nadpisujemy pełnego HTML-a skróconą/uproszczoną kopią)
      if (description !== (detail.description ?? '')) {
        updates.description = sanitizeDescriptionHtml(description);
      }
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
      !(await confirmDialog({
        title: 'Trwale usunąć produkt?',
        tone: 'danger',
        confirmLabel: 'Usuń produkt',
        message: `Produkt „${label}” zostanie usunięty z katalogu.\n\nZniknie z listy (także wpisy ze sklepu/JSON). Użyj tego, gdy chcesz zmienić kod SKU — usuń stary wpis i dodaj produkt z nowym kodem.\n\nTej operacji nie można cofnąć.`,
      }))
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

  const categoryTreeVersion = useCategoryRegistry();
  const editCategories = useMemo(() => {
    // pełna lista: drzewo kategorii (sklep + własne z bazy) + kategorie akcesoriów + obecna kategoria produktu
    return Array.from(
      new Set([
        detail.category,
        ...getAssignableCategories(),
        ...ACCESSORY_CATEGORIES.filter((c) => c !== 'Wszystkie'),
      ].filter(Boolean)),
    ).sort((a, b) => a.localeCompare(b, 'pl'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail.category, categoryTreeVersion]);
  const displayManufacturer = effectiveManufacturer(detail);

  // ---- opisy: bieżące wartości (w edycji z edytora, poza edycją z zapisanego produktu) + BaseLinker ----
  const [descBusy, setDescBusy] = useState<'pull' | 'push' | null>(null);
  const [descReset, setDescReset] = useState(0);
  const canBlDesc = roleCan(role, 'manageBaselinker');
  const currentDescValues: DescValues = editing
    ? {
        description,
        shortDescription: editMeta.shortDescription ?? '',
        descUsage: editMeta.descUsage ?? '',
        descComposition: editMeta.descComposition ?? '',
        descSafety: editMeta.descSafety ?? '',
      }
    : descValuesOf({ description: description || detail.description || '', meta: detail.meta });

  async function pullDescFromBl() {
    setDescBusy('pull');
    try {
      const res = await fetchBlDescriptions(detail.sku);
      if (!res.found) {
        showToast(`Nie znaleziono produktu ${detail.sku} w BaseLinkerze`, 'warn', 5000);
        return;
      }
      const fromBl = descFromBlText(res.text);
      const keys = Object.keys(fromBl) as DescKey[];
      if (keys.length === 0) {
        showToast('W BaseLinkerze ten produkt nie ma opisów', 'info', 5000);
        return;
      }
      const names = DESC_FIELDS.filter((d) => keys.includes(d.key)).map((d) => d.label);
      const ok = await confirmDialog({
        title: 'Pobranie opisów z BaseLinkera',
        message: `Z BaseLinkera zostaną wczytane pola: ${names.join(', ')}. Zastąpią obecne teksty w edytorze (zapis dopiero po kliknięciu „Zapisz”). Kontynuować?`,
        confirmLabel: 'Wczytaj',
        tone: 'info',
      });
      if (!ok) return;
      setEditing(true);
      setDetailTab('desc');
      if (fromBl.description !== undefined) setDescription(fromBl.description);
      setEditMeta((m: ProductMeta) => ({
        ...m,
        ...(fromBl.shortDescription !== undefined ? { shortDescription: fromBl.shortDescription } : {}),
        ...(fromBl.descUsage !== undefined ? { descUsage: fromBl.descUsage } : {}),
        ...(fromBl.descComposition !== undefined ? { descComposition: fromBl.descComposition } : {}),
        ...(fromBl.descSafety !== undefined ? { descSafety: fromBl.descSafety } : {}),
      }));
      setDescReset((r) => r + 1);
      showToast(`Wczytano z BaseLinkera: ${names.join(', ')} — sprawdź i zapisz`, 'ok', 6000);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Nie udało się pobrać opisów z BaseLinkera', 'error', 7000);
    } finally {
      setDescBusy(null);
    }
  }

  async function pushDescToBl() {
    const fields = blTextFromDesc(currentDescValues);
    const count = Object.keys(fields).length;
    if (count === 0) {
      showToast('Brak opisów do wysłania', 'info');
      return;
    }
    const ok = await confirmDialog({
      title: 'Wysłanie opisów do BaseLinkera',
      message: `Wysłać ${count} ${count === 1 ? 'pole' : 'pól'} opisowych do produktu ${detail.sku} w BaseLinkerze? Nadpisze odpowiadające im opisy w BL${editing ? ' (zostaną wysłane aktualne treści z edytora, także niezapisane)' : ''}.`,
      confirmLabel: 'Wyślij do BL',
      tone: 'warn',
    });
    if (!ok) return;
    setDescBusy('push');
    try {
      const res = await pushBlDescriptions(detail.sku, fields);
      if (res.found === false) showToast(`Nie znaleziono produktu ${detail.sku} w BaseLinkerze`, 'warn', 5000);
      else showToast(`Wysłano do BaseLinkera: ${res.sent.length} pól`, 'ok', 5000);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Nie udało się wysłać opisów do BaseLinkera', 'error', 7000);
    } finally {
      setDescBusy(null);
    }
  }

  const variantCount = detail.variants?.length ?? 0;
  const isGroup = detail.isGroup || variantCount > 0;
  const hasPrimary = !!primaryImage;

  const showPrices = roleCan(role, 'viewPrices');
  const customerPrice = customerGrossPrice(detail.priceSaleGross, detail.priceSaleNet, detail.meta?.vatRate);
  const customerPriceEstimated =
    detail.priceSaleGross == null && detail.priceSaleNet != null && customerPrice != null;
  const canDeleteProduct = roleCan(role, 'deleteProduct');
  // stan REALNY (dostępny) = stan WAPRO − zarezerwowane; R pokazujemy obok
  const availableStock = Math.max(0, (detail.stock ?? 0) - reservedQty);
  const stockTone =
    availableStock <= 0
      ? 'bg-red-600 text-white border-red-500'
      : availableStock <= 5
        ? 'bg-amber-500 text-amber-950 border-amber-400'
        : 'bg-emerald-600 text-white border-emerald-500';

  const canUploadImages = roleCan(role, 'uploadImage');
  const hubTabs = useMemo(() => {
    const tabs: {
      id: 'info' | 'desc' | 'variants' | 'photos' | 'ai' | 'sales' | 'history';
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
      ...(roleCan(role, 'viewProgress') ? [{ id: 'history' as const, label: 'Historia', icon: HistoryIcon }] : []),
    ];
    return tabs;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variantCount, canUploadImages, showPrices, role]);

  /** Odświeża otwarty produkt z bazy (po przywróceniu wartości z historii). */
  async function refreshDetailFromDb() {
    try {
      const full = await fetchProductById(product.id);
      if (!full) return;
      syncProduct({
        ...full,
        variants: full.variants?.length ? full.variants : detail.variants,
        isGroup: full.isGroup ?? detail.isGroup,
      });
      setDescription(full.description ?? '');
      setEan(full.ean || '');
      setStock(full.stock ?? 0);
      setEditMeta({ ...full.meta });
    } catch (err) {
      console.warn('refreshDetailFromDb', err);
    }
  }

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
            <span className="mt-2 flex flex-wrap gap-1.5">
              {HIDE_REASON_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setEditMeta((m: ProductMeta) => ({ ...m, catalogHiddenReason: preset }))}
                  className="rounded-full border border-slate-300 bg-white px-2.5 py-0.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                >
                  {preset}
                </button>
              ))}
            </span>

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
            <div className="hidden items-center gap-2 border-b border-slate-800/60 px-4 py-2.5 lg:flex">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-slate-400 transition hover:bg-slate-800 hover:text-slate-100"
              >
                <ArrowLeft className="h-4 w-4 shrink-0" />
                Lista produktów
              </button>
            </div>
            {groupNav && <GroupNavStrip nav={groupNav} />}
            <div className="flex items-start justify-between gap-2 px-3 py-2.5 sm:px-4 sm:py-3">
              <div className="min-w-0 flex-1">
                {editing ? (
                  <input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="input-field text-lg font-semibold"
                  />
                ) : (
                  <h2 className="line-clamp-2 text-base font-semibold leading-snug text-slate-50 sm:text-lg lg:text-xl">
                    <CopyName text={displayName}>{displayName}</CopyName>
                  </h2>
                )}
                <div className="-mx-3 mt-1.5 flex flex-nowrap items-center gap-1.5 overflow-x-auto px-3 scrollbar-none sm:mx-0 sm:mt-2 sm:flex-wrap sm:gap-2 sm:overflow-visible sm:px-0 [&>*]:shrink-0">
                  {isGroup && variantCount > 0 ? (
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-brand-500/30 bg-brand-500/10 px-2 py-1 text-xs font-medium text-brand-200 sm:px-3 sm:py-1.5 sm:text-sm">
                      <Layers className="h-4 w-4 shrink-0" />
                      Grupa · {variantCount} wariantów
                    </span>
                  ) : (
                  <button
                    type="button"
                    onClick={() => void copyText(detail.sku, 'sku')}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/90 px-2 py-1 font-mono text-xs font-medium text-brand-200 hover:bg-slate-700 sm:px-3 sm:py-1.5 sm:text-sm"
                    title="Kopiuj SKU"
                  >
                    {copied === 'sku' ? <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : <Copy className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
                    <span className="hidden sm:inline">SKU </span>{detail.sku}
                  </button>
                  )}
                  {detail.ean && (
                    <button
                      type="button"
                      onClick={() => void copyText(detail.ean, 'ean')}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/90 px-2 py-1 font-mono text-xs text-slate-200 hover:bg-slate-700 sm:px-3 sm:py-1.5 sm:text-sm"
                      title="Kopiuj EAN"
                    >
                      {copied === 'ean' ? <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : <Barcode className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
                      <span className="hidden sm:inline">EAN </span>{detail.ean}
                    </button>
                  )}
                  <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs font-semibold sm:px-3 sm:py-1.5 sm:text-sm ${stockTone}`}>
                    <span className="hidden sm:inline">Stan: </span>{availableStock <= 0 ? 'Brak' : formatStock(availableStock)}
                    {reservedQty > 0 && (
                      <span
                        className="rounded bg-amber-400 px-1.5 text-xs font-bold text-amber-950"
                        title={`Zarezerwowane w zamówieniach: ${formatStock(reservedQty)} · dostępne: ${formatStock(availableStock)} · stan WAPRO: ${formatStock(detail.stock ?? 0)}`}
                      >
                        R {formatStock(reservedQty)}
                      </span>
                    )}
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
                  {livePromo && (
                    <span
                      className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-2.5 py-1 text-xs font-bold text-white"
                      title={livePromo.campaign ? `Kampania: ${livePromo.campaign}` : undefined}
                    >
                      PROMOCJA {formatPricePln(livePromo.promoGross)}
                      {livePromo.regularGross != null && (
                        <span className="font-medium text-white/80 line-through">
                          {formatPricePln(livePromo.regularGross)}
                        </span>
                      )}
                      {livePromo.endsAt && (
                        <span className="font-medium text-white/90">
                          do {new Date(livePromo.endsAt).toLocaleDateString('pl-PL')}
                        </span>
                      )}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="hidden sm:block">
                  <ManufacturerLogo name={displayManufacturer} className="!h-12 !w-24" />
                </span>
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
            <div className="catalog-product-tabs flex snap-x snap-mandatory gap-1 overflow-x-auto px-3 pb-1.5 scrollbar-none sm:px-4 sm:pb-2">
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
        <>
        {groupNav && <GroupNavStrip nav={groupNav} sticky />}
        <div className={`sticky ${groupNav ? 'top-9' : 'top-0'} flex items-center justify-between border-b border-slate-800 bg-slate-900/95 px-4 py-3 backdrop-blur`}>
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
        </>
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
              ? `aspect-[4/3] max-h-[min(38dvh,13.5rem)] overflow-hidden rounded-2xl border bg-white sm:max-h-[min(46dvh,24rem)] lg:max-h-[min(40dvh,22rem)] dark:bg-slate-800 ${
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
                  const dropped = Array.from(e.dataTransfer.files ?? []);
                  if (dropped.length > 1) void handleUploadFiles(dropped);
                  else if (dropped[0]) applyImageFile(dropped[0]);
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
                <ProductImage
                  product={{
                    customImageUrl: displayImage || undefined,
                    imageUrl: detail.imageUrl,
                    extraImageUrls: allImages.filter((url) => url !== displayImage),
                  }}
                  alt={detail.displayName}
                  className="h-full w-full object-contain p-4"
                />
              </button>
              <div className="absolute right-3 top-3 flex items-center gap-1.5">
                {canUploadImages && allImages.length > 1 && (
                  <div className="flex overflow-hidden rounded-lg bg-slate-800/90 shadow-lg backdrop-blur">
                    <button
                      type="button"
                      disabled={reordering || selectedIdx === 0}
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleReorderImages(selectedIdx, selectedIdx - 1);
                      }}
                      className="px-2 py-2 text-white hover:bg-slate-700 disabled:opacity-30"
                      title="Przesuń zdjęcie w lewo (wcześniej)"
                      aria-label="Przesuń zdjęcie w lewo"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      disabled={reordering || selectedIdx >= allImages.length - 1}
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleReorderImages(selectedIdx, selectedIdx + 1);
                      }}
                      className="border-l border-slate-700 px-2 py-2 text-white hover:bg-slate-700 disabled:opacity-30"
                      title="Przesuń zdjęcie w prawo (później)"
                      aria-label="Przesuń zdjęcie w prawo"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                )}
                {canUploadImages && isExtraSelected && (
                  <button
                    type="button"
                    disabled={settingPrimary || deleting || uploading || uploadingExtra}
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleSetAsPrimary();
                    }}
                    className="flex items-center gap-1.5 rounded-lg bg-brand-600/90 px-3 py-2 text-sm font-medium text-white shadow-lg backdrop-blur transition hover:bg-brand-500 disabled:opacity-50"
                  >
                    {settingPrimary ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Star className="h-4 w-4" />
                    )}
                    Ustaw jako główne
                  </button>
                )}
                {roleCan(role, 'deleteImage') && (
                  <button
                    type="button"
                    disabled={deleting || uploading || uploadingExtra}
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleDeleteImage();
                    }}
                    className="flex items-center gap-1.5 rounded-lg bg-red-600/90 px-3 py-2 text-sm font-medium text-white shadow-lg backdrop-blur transition hover:bg-red-500 disabled:opacity-50"
                  >
                    {deleting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                    {allImages.length > 1 ? 'Usuń to zdjęcie' : 'Usuń zdjęcie'}
                  </button>
                )}
              </div>
              {allImages.length > 1 && !hubStyle && (
                <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5 rounded-xl bg-black/75 p-1.5 backdrop-blur">
                  {allImages.map((url, idx) => (
                    <button
                      key={url}
                      type="button"
                      onClick={() => setSelectedIdx(idx)}
                      {...thumbDnd(idx)}
                      className={`relative h-12 w-12 overflow-hidden rounded-lg border-2 transition ${
                        idx === selectedIdx
                          ? 'border-brand-400'
                          : isMissingInBl(url)
                            ? 'border-amber-400'
                            : 'border-transparent opacity-70 hover:opacity-100'
                      }${thumbDndClass(idx)}`}
                      title={isMissingInBl(url) ? 'Brak tego zdjęcia w BaseLinkerze' : canUploadImages && allImages.length > 1 ? 'Przeciągnij, aby zmienić kolejność' : undefined}
                    >
                      <img src={url} alt="" className="h-full w-full object-cover" />
                      {isMissingInBl(url) && (
                        <span className="absolute inset-x-0 bottom-0 bg-amber-400 text-center text-[8px] font-bold leading-3 text-amber-950">
                          brak w BL
                        </span>
                      )}
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
                {...thumbDnd(idx)}
                className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border-2 transition ${
                  idx === selectedIdx
                    ? 'border-brand-500'
                    : isMissingInBl(url)
                      ? 'border-amber-400'
                      : 'border-slate-700 opacity-70 hover:opacity-100'
                }${thumbDndClass(idx)}`}
                title={
                  isMissingInBl(url)
                    ? `Zdjęcie ${idx + 1} — brak w BaseLinkerze`
                    : canUploadImages && allImages.length > 1
                      ? `Zdjęcie ${idx + 1} — przeciągnij, aby zmienić kolejność`
                      : `Zdjęcie ${idx + 1}`
                }
              >
                <img src={url} alt="" className="h-full w-full object-cover" />
                {isMissingInBl(url) && (
                  <span className="absolute inset-x-0 bottom-0 bg-amber-400 text-center text-[9px] font-bold leading-3 text-amber-950">
                    brak w BL
                  </span>
                )}
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

        <div className={hubStyle ? 'min-w-0 space-y-3 pb-1 sm:pb-0' : 'space-y-4 p-4'}>
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
                        setDetailTab('desc');
                      }
                    : undefined
                }
              />
            )}

          {hubStyle && showPrices && !editing && detailTab === 'info' && detail.sku && (
            <BaselinkerProductPanel
              product={detail}
              onMissingImages={setBlMissing}
              onProductPatched={(patch) => syncProduct({ ...detail, ...patch })}
            />
          )}

          {hubStyle && detailTab === 'info' && !isGroup && (
            <ProductTechPanel product={detail} canEdit={roleCan(role, 'editProduct')} />
          )}

          {hubStyle && detailTab === 'info' && !isGroup && (
            <ProductAttributesPanel
              product={detail}
              values={editing ? (editMeta.attrs ?? {}) : attrValuesOf(detail)}
              editing={editing}
              onChange={(key, value) =>
                setEditMeta((m: ProductMeta) => {
                  const next: Record<string, AttrValue> = { ...(m.attrs ?? {}) };
                  if (value === undefined) delete next[key];
                  else next[key] = value;
                  return { ...m, attrs: Object.keys(next).length ? next : undefined };
                })
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

          {hubStyle && detailTab === 'history' && (
            <ProductHistoryPanel
              sku={detail.sku}
              canEdit={roleCan(role, 'editProduct') && !editing}
              onReverted={() => void refreshDetailFromDb()}
            />
          )}


          {hubStyle && !editing && detailTab === 'variants' && variantCount > 0 && detail.variants && (
            <ProductVariantsPanel variants={detail.variants} catalogProducts={catalogProducts} onOpenVariant={onOpenVariant} showPrices={showPrices} canEditImages={roleCan(role, 'uploadImage')} onVariantPatched={onVariantPatched} groupProduct={detail} onGroupPatched={(p) => setDetail((d) => ({ ...d, ...p }))} />
          )}

          {hubStyle && !editing && detailTab === 'desc' && (
            <div className="space-y-3">
              {canBlDesc && <DescriptionBlBar busy={descBusy} onPull={() => void pullDescFromBl()} onPush={() => void pushDescToBl()} />}
              <ProductDescriptionsView
                values={currentDescValues}
                loading={detailLoading}
                loadError={detailLoadError}
              />
            </div>
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
                <ManufacturerSelect value={manufacturer} onChange={setManufacturer} extra={[detail.manufacturer]} />
              </label>
              <label className="block">
                <span className="mb-1 text-xs text-slate-500">Kategoria</span>
                <CategoryPicker value={category} options={editCategories} onChange={setCategory} />

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
                <span className="mb-1 inline-flex items-center gap-1 text-xs text-slate-500">
                  Stan magazynowy
                  {detail.stockManual && (
                    <span className="text-brand-400">(ręczny)</span>
                  )}
                  <ContextHelp id="catalogStockManual" />
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
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
            <div className="space-y-3">
              {canBlDesc && <DescriptionBlBar busy={descBusy} onPull={() => void pullDescFromBl()} onPush={() => void pushDescToBl()} />}
              <ProductDescriptionsEditor
                values={currentDescValues}
                resetKey={descReset}
                onChange={(key, value) => {
                  if (key === 'description') setDescription(value);
                  else setEditMeta((m: ProductMeta) => ({ ...m, [key]: value }));
                }}
              />
              <span className="block text-[11px] text-slate-500">
                Zapis obejmuje też dane z zakładki Dane. Opis pełny i dodatkowe opisy mają formatowanie (HTML) zgodne z BaseLinkerem.
              </span>
            </div>
          )}

          {hubStyle && editing && detailTab === 'variants' && variantCount > 0 && detail.variants && (
            <div className="space-y-2">
              <p className="text-xs text-slate-500">
                Warianty tylko do podglądu — SKU i stany pochodzą z WAPRO.
              </p>
              <ProductVariantsPanel variants={detail.variants} catalogProducts={catalogProducts} onOpenVariant={onOpenVariant} showPrices={showPrices} canEditImages={roleCan(role, 'uploadImage')} onVariantPatched={onVariantPatched} groupProduct={detail} onGroupPatched={(p) => setDetail((d) => ({ ...d, ...p }))} />
            </div>
          )}

          {hubStyle && detailTab === 'photos' && canUploadImages && (
            <HubProductPhotosPanel
              busy={uploading || uploadingExtra}
              uploadProgress={uploadProgress}
              imageCount={allImages.length}
              hasPrimary={hasPrimary}
              displayImage={displayImage}
              isPrimarySelected={isPrimarySelected}
              hasImageRevert={hasImageRevert}
              removeBgBusy={removeBgBusy}
              revertBusy={revertBusy}
              onPickFiles={(files) => void handleUploadFiles(files)}
              onOpenRemoveBg={() => setRemoveBgOpen(true)}
              onOpenPrepare={() => setPrepareOpen(true)}
              onOpenBatchPrepare={() => setBatchPrepareOpen(true)}
              isMobile={isMobile}
              onRestoreBeforeNobg={() => void handleRestoreImageBeforeNobg()}
              fileRef={fileRef}
              cameraRef={cameraRef}
              onUploadPrimary={handleUpload}
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
                <ManufacturerSelect value={manufacturer} onChange={setManufacturer} extra={[detail.manufacturer]} />

              </label>
              <label className="block">
                <span className="mb-1 text-xs text-slate-500">Kategoria</span>
                <CategoryPicker value={category} options={editCategories} onChange={setCategory} />

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
                <RichTextField value={toEditorHtml(description)} onChange={setDescription} minHeight={110} />
              </label>
              <label className="block">
                <span className="mb-1 inline-flex items-center gap-1 text-xs text-slate-500">
                  Stan magazynowy
                  {detail.stockManual && (
                    <span className="text-brand-400">(ręczny)</span>
                  )}
                  <ContextHelp id="catalogStockManual" />
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
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold text-slate-100">{displayName}</h2>
                  {detail.name.trim() &&
                    detail.name.trim().toLowerCase() !== displayName.trim().toLowerCase() && (
                      <p className="mt-1 text-sm text-slate-400">{detail.name}</p>
                    )}
                </div>
                <ManufacturerLogo name={displayManufacturer} />
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
                  label={`Stan: ${formatStock(availableStock)}${
                    reservedQty > 0
                      ? ` · R ${formatStock(reservedQty)} (stan WAPRO ${formatStock(detail.stock ?? 0)})`
                      : ''
                  }${detail.stockManual ? ' · ręczny' : ''}`}
                  muted={availableStock > 0}
                  warning={availableStock <= 0}
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
                  <div className="space-y-1.5">
                  <p className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    Ceny i marża
                    <ContextHelp id="catalogPricing" />
                  </p>
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
                  </div>
                )}

              {description && (
                <p className="text-sm leading-relaxed text-slate-400">{stripHtml(description, 600)}</p>
              )}

              {variantCount > 0 && detail.variants && (
                <ProductVariantsPanel variants={detail.variants} catalogProducts={catalogProducts} onOpenVariant={onOpenVariant} showPrices={showPrices} canEditImages={roleCan(role, 'uploadImage')} onVariantPatched={onVariantPatched} groupProduct={detail} onGroupPatched={(p) => setDetail((d) => ({ ...d, ...p }))} />
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
              {isMobile && (
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
              )}
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
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={uploading || uploadingExtra || removeBgBusy}
                  onClick={() => setRemoveBgOpen(true)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-600 bg-slate-800/80 py-3 text-sm font-medium text-slate-200 transition hover:border-brand-500/40 hover:bg-slate-800 disabled:opacity-50"
                >
                  <Scissors className="h-5 w-5 text-brand-300" />
                  Wytnij białe tło (podgląd)
                </button>
                <ContextHelp id="catalogRemoveBackground" />
              </div>
            )}

            {displayImage && (
              <button
                type="button"
                disabled={uploading || uploadingExtra || removeBgBusy || prepareBusy}
                onClick={() => setPrepareOpen(true)}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-600 bg-slate-800/80 py-3 text-sm font-medium text-slate-200 transition hover:border-brand-500/40 hover:bg-slate-800 disabled:opacity-50"
              >
                <Maximize2 className="h-5 w-5 text-brand-300" />
                Przygotuj pod BaseLinker (min. 500×500)
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
                Przywróć poprzednie zdjęcie (przed zmianą)
              </button>
            )}

            {hasPrimary && (
              <div className="flex gap-2">
                <input
                  ref={extraFileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const list = Array.from(e.target.files ?? []);
                    if (list.length) void handleUploadFiles(list);
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
                {isMobile && (
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
                )}
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
      {/* okna zdjęć leżą wewnątrz tła produktu — kliknięcie w nich nie może zamykać produktu */}
      <div onClick={(e) => e.stopPropagation()}>
      <BatchPrepareModal
        open={batchPrepareOpen}
        images={allImages}
        productName={detail.displayName}
        onClose={() => setBatchPrepareOpen(false)}
        onApply={handleBatchPrepare}
      />
      <PrepareImageModal
        open={prepareOpen}
        sourceUrl={displayImage}
        productName={detail.displayName}
        busy={prepareBusy || uploading}
        onClose={() => !prepareBusy && !uploading && setPrepareOpen(false)}
        onApply={(res) => void handleApplyPrepare(res)}
      />
      <RemoveBackgroundModal
        open={removeBgOpen}
        sourceUrl={displayImage}
        productName={detail.displayName}
        busy={removeBgBusy || uploading}
        onClose={() => !removeBgBusy && !uploading && setRemoveBgOpen(false)}
        onApply={(preset, src) => void handleApplyRemoveBackground(preset, src)}
      />
      </div>
    </div>
  );
}

function HubProductPhotosPanel({
  busy,
  uploadProgress,
  imageCount,
  hasPrimary,
  displayImage,
  isPrimarySelected,
  hasImageRevert,
  removeBgBusy,
  revertBusy,
  onPickFiles,
  onOpenRemoveBg,
  onOpenPrepare,
  onOpenBatchPrepare,
  isMobile,
  onRestoreBeforeNobg,
  fileRef,
  cameraRef,
  onUploadPrimary,
}: {
  busy: boolean;
  uploadProgress: [number, number] | null;
  imageCount: number;
  hasPrimary: boolean;
  displayImage: string | null;
  isPrimarySelected: boolean;
  hasImageRevert: boolean;
  removeBgBusy: boolean;
  revertBusy: boolean;
  onPickFiles: (files: File[]) => void;
  onOpenRemoveBg: () => void;
  onOpenPrepare: () => void;
  onOpenBatchPrepare: () => void;
  isMobile: boolean;
  onRestoreBeforeNobg: () => void;
  fileRef: RefObject<HTMLInputElement | null>;
  cameraRef: RefObject<HTMLInputElement | null>;
  onUploadPrimary: (file: File) => void;
}) {
  const toolBtn =
    'flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2.5 text-left text-xs font-medium text-slate-200 transition hover:border-brand-500/40 hover:bg-slate-800 disabled:opacity-50';
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
          <Images className="h-4 w-4 text-brand-300" /> Zdjęcia produktu
        </h4>
        <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-slate-300">
          {imageCount} {imageCount === 1 ? 'zdjęcie' : 'zdjęć'}
        </span>
      </div>

      <HubImageDropZone busy={busy} hasPrimary={hasPrimary} isMobile={isMobile} onPickFiles={onPickFiles} />

      {uploadProgress && (
        <div className="space-y-1.5 rounded-xl border border-brand-500/30 bg-brand-500/10 px-3 py-2.5">
          <div className="flex items-center justify-between text-xs font-medium text-brand-100">
            <span className="flex items-center gap-1.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Wgrywanie zdjęć
            </span>
            <span className="tabular-nums">
              {uploadProgress[0]} / {uploadProgress[1]}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-brand-400 transition-all"
              style={{ width: `${Math.round((uploadProgress[0] / Math.max(1, uploadProgress[1])) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {hasPrimary && (
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Podmień zdjęcie główne</p>
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
          <div className={`grid gap-2 ${isMobile ? 'grid-cols-2' : 'grid-cols-1'}`}>
            <button type="button" disabled={busy} onClick={() => fileRef.current?.click()} className={toolBtn}>
              <Upload className="h-4 w-4 shrink-0 text-brand-300" /> Z pliku
            </button>
            {isMobile && (
              <button type="button" disabled={busy} onClick={() => cameraRef.current?.click()} className={toolBtn}>
                <Camera className="h-4 w-4 shrink-0 text-brand-300" /> Z aparatu
              </button>
            )}
          </div>
        </div>
      )}

      {displayImage && (
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Obróbka wybranego zdjęcia</p>
          <button
            type="button"
            disabled={busy || removeBgBusy || imageCount === 0}
            onClick={onOpenBatchPrepare}
            className="mb-2 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-3 py-2.5 text-xs font-semibold text-white transition hover:bg-brand-500 disabled:opacity-50"
          >
            <Maximize2 className="h-4 w-4 shrink-0" /> Dopasuj wszystkie zdjęcia pod BaseLinker ({imageCount})
          </button>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button type="button" disabled={busy || removeBgBusy} onClick={onOpenRemoveBg} className={toolBtn}>
              <Scissors className="h-4 w-4 shrink-0 text-brand-300" /> Wytnij białe tło
            </button>
            <button type="button" disabled={busy || removeBgBusy} onClick={onOpenPrepare} className={toolBtn}>
              <Maximize2 className="h-4 w-4 shrink-0 text-brand-300" /> Tylko to zdjęcie pod BaseLinker
            </button>
          </div>
          {hasImageRevert && isPrimarySelected && (
            <button
              type="button"
              disabled={busy || revertBusy || removeBgBusy}
              onClick={onRestoreBeforeNobg}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 py-2.5 text-xs font-medium text-amber-200 transition hover:bg-amber-500/15 disabled:opacity-50"
            >
              {revertBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />}
              Przywróć poprzednie zdjęcie (przed zmianą)
            </button>
          )}
        </div>
      )}

      <p className="text-[11px] leading-relaxed text-slate-500">
        Kolejność zmienisz przeciągając miniatury pod podglądem — pierwsze zdjęcie jest zdjęciem głównym (widocznym na liście katalogu).
      </p>
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
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
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
      // podgląd jest wewnątrz okna produktu — bez stopPropagation kliknięcie bąbelkowałoby do tła produktu i zamykało go
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div className="flex shrink-0 items-center justify-between gap-3 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <p className="min-w-0 truncate text-sm font-semibold">{title}</p>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
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
  isMobile,
  onPickFiles,
}: {
  busy: boolean;
  hasPrimary: boolean;
  isMobile: boolean;
  onPickFiles: (files: File[]) => void;
}) {
  const localFileRef = useRef<HTMLInputElement>(null);
  const localCameraRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const hint = !hasPrimary ? 'Pierwsze zdjęcie zostanie zdjęciem głównym' : 'Zdjęcia zostaną dodane do galerii produktu';

  return (
    <div
      className={`rounded-2xl border-2 border-dashed px-4 py-6 transition ${
        dragOver ? 'border-brand-400 bg-brand-500/10' : 'border-slate-600 bg-slate-900/40 hover:border-slate-500'
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
        const files = Array.from(e.dataTransfer.files ?? []);
        if (files.length) onPickFiles(files);
      }}
    >
      <input
        ref={localFileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) onPickFiles(files);
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
          const files = Array.from(e.target.files ?? []);
          if (files.length) onPickFiles(files);
          e.target.value = '';
        }}
      />
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-500/15 text-brand-300">
          <Upload className="h-6 w-6" />
        </span>
        <p className="text-sm font-semibold text-slate-100">Przeciągnij tutaj jedno lub kilka zdjęć</p>
        <p className="text-xs text-slate-500">{hint}</p>
        <div className="mt-1 flex w-full max-w-sm gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => localFileRef.current?.click()}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand-600 py-2.5 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-50"
          >
            <Images className="h-4 w-4" />
            Wybierz pliki
          </button>
          {isMobile && (
            <button
              type="button"
              disabled={busy}
              onClick={() => localCameraRef.current?.click()}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-600 px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-50"
            >
              <Camera className="h-4 w-4" />
              Aparat
            </button>
          )}
        </div>
        <p className="text-[11px] text-slate-600">{isMobile ? 'Możesz zaznaczyć kilka zdjęć naraz.' : 'W oknie wyboru zaznacz kilka plików naraz (Ctrl / Shift).'}</p>
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

/** Pasek grupy nad kartą produktu: powrót do wizytówki grupy, lista wszystkich produktów grupy i przejścia poprzedni/następny. */
function GroupNavStrip({ nav, sticky }: { nav: NonNullable<ProductDetailProps['groupNav']>; sticky?: boolean }) {
  return (
    <div className={`flex items-center gap-1.5 border-b border-slate-800/60 bg-brand-500/10 px-3 py-1.5 sm:px-4 ${sticky ? 'sticky top-0 z-10 backdrop-blur' : ''}`}>
      <button
        type="button"
        onClick={nav.onBack}
        className="inline-flex min-w-0 items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-brand-300 hover:bg-brand-500/15"
        title="Wróć do wizytówki grupy"
      >
        <ArrowLeft className="h-3.5 w-3.5 shrink-0" />
        <Layers className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">Grupa: {nav.groupName}</span>
      </button>
      {nav.items && nav.onJump && (
        <select
          value={nav.index}
          onChange={(e) => nav.onJump?.(Number(e.target.value))}
          className="ml-auto min-w-0 max-w-[45%] truncate rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200"
          aria-label="Przejdź do produktu w grupie"
        >
          {nav.items.map((label, i) => (
            <option key={i} value={i}>
              {i + 1}. {label}
            </option>
          ))}
        </select>
      )}
      <span className={`${nav.items ? '' : 'ml-auto'} text-xs tabular-nums text-slate-500`}>
        {nav.index + 1} / {nav.total}
      </span>
      <button type="button" onClick={nav.onPrev} disabled={!nav.onPrev} className="rounded-lg p-1.5 text-slate-300 hover:bg-slate-800 disabled:opacity-30" aria-label="Poprzedni produkt" title="Poprzedni produkt">
        <ChevronLeft className="h-4 w-4" />
      </button>
      <button type="button" onClick={nav.onNext} disabled={!nav.onNext} className="rounded-lg p-1.5 text-slate-300 hover:bg-slate-800 disabled:opacity-30" aria-label="Następny produkt" title="Następny produkt">
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

/** Kopiowanie zdjęć między produktami grupy: wybierasz, z którego produktu wziąć zdjęcia i do których je wgrać (także jako zdjęcie samej grupy). */
function CopyImagesDialog({
  members,
  group,
  initialSource,
  onClose,
  onDone,
}: {
  members: Product[];
  group?: Product;
  initialSource?: string;
  onClose: () => void;
  onDone: (patches: Map<string, string[]>) => void;
}) {
  const withImg = members.filter((m) => getProductImages(m).length > 0);
  const [sourceId, setSourceId] = useState<string>(initialSource ?? withImg[0]?.id ?? '');
  const source = members.find((m) => m.id === sourceId);
  const targets = useMemo(() => [...(group ? [group] : []), ...members.filter((m) => m.id !== sourceId)], [group, members, sourceId]);
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const [busy, setBusy] = useState<[number, number] | null>(null);
  const urls = useMemo(() => (source ? getProductImages(source) : []), [source]);

  useEffect(() => {
    setPicked(new Set(targets.filter((t) => getProductImages(t).length === 0).map((t) => t.id)));
  }, [sourceId]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  async function run() {
    const ids = targets.filter((t) => picked.has(t.id)).map((t) => t.id);
    if (!ids.length || !urls.length || !source) return;
    setBusy([0, ids.length]);
    try {
      const result = await withAuditBatch(`Kopiowanie zdjęć z ${source.sku} do ${ids.length} produktów`, () =>
        copyImagesToProducts(urls, ids, (d, t) => setBusy([d, t])),
      );
      showToast(`Skopiowano zdjęcia do ${ids.length} produktów`, 'ok');
      onDone(result);
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Nie udało się skopiować zdjęć', 'error', 7000);
      setBusy(null);
    }
  }

  const thumb = (p: Product, has: boolean) => (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-800 bg-white">
      {has ? <ProductImage product={p} className="h-full w-full object-contain" /> : <ImageOff className="h-4 w-4 text-slate-400" />}
    </span>
  );

  return (
    <div className="fixed inset-0 z-[95] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" onClick={busy ? undefined : onClose}>
      <div className="flex max-h-[92dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl border border-slate-700 bg-slate-900 shadow-2xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-slate-800 px-4 py-3">
          <h3 className="text-base font-bold text-slate-50">Kopiowanie zdjęć w grupie</h3>
          <p className="mt-0.5 text-xs text-slate-400">Żaden produkt nie jest „główny” — wybierz źródło, potem produkty docelowe. Zdjęcia zaznaczonych zostaną zastąpione.</p>
        </div>
        <div className="border-b border-slate-800 px-4 py-2">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">1. Skopiuj zdjęcia z</p>
          <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
            {withImg.length === 0 && <span className="text-xs text-slate-500">Żaden wariant nie ma jeszcze zdjęcia.</span>}
            {withImg.map((m) => (
              <button
                key={m.id}
                type="button"
                disabled={!!busy}
                onClick={() => setSourceId(m.id)}
                title={m.displayName}
                className={`flex items-center gap-1.5 rounded-lg border px-1.5 py-1 text-left text-[11px] ${m.id === sourceId ? 'border-brand-500 bg-brand-500/10 text-brand-200' : 'border-slate-700 text-slate-300 hover:bg-slate-800'}`}
              >
                <span className="h-7 w-7 shrink-0 overflow-hidden rounded bg-white"><ProductImage product={m} className="h-full w-full object-contain" /></span>
                <span className="max-w-[9rem] truncate">{m.displayName}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-2 text-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">2. Wgraj do</span>
          <button type="button" className="text-brand-300 hover:underline" onClick={() => setPicked(new Set(targets.map((t) => t.id)))}>Wszystkie</button>
          <button type="button" className="text-brand-300 hover:underline" onClick={() => setPicked(new Set(targets.filter((t) => getProductImages(t).length === 0).map((t) => t.id)))}>Tylko bez zdjęcia</button>
          <button type="button" className="text-slate-400 hover:underline" onClick={() => setPicked(new Set())}>Żadne</button>
        </div>
        <ul className="min-h-0 flex-1 divide-y divide-slate-800 overflow-y-auto">
          {targets.map((t) => {
            const has = getProductImages(t).length > 0;
            const isGroupRow = !!group && t.id === group.id;
            return (
              <li key={t.id}>
                <label className="flex cursor-pointer items-center gap-3 px-4 py-2 hover:bg-slate-800/50">
                  <input type="checkbox" checked={picked.has(t.id)} onChange={() => toggle(t.id)} disabled={!!busy} />
                  {thumb(t, has)}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-slate-200">{isGroupRow ? `Zdjęcie grupy: ${t.displayName}` : t.displayName}</span>
                    <span className="block font-mono text-[11px] text-slate-500">{isGroupRow ? 'grupa' : t.sku}{has ? ' · ma zdjęcia' : ' · brak zdjęcia'}</span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
        <div className="flex items-center justify-end gap-2 border-t border-slate-800 px-4 py-3">
          <button type="button" onClick={onClose} disabled={!!busy} className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-40">Anuluj</button>
          <button type="button" onClick={() => void run()} disabled={!!busy || picked.size === 0 || !urls.length} className="rounded-xl bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-40">
            {busy ? `Kopiuję… ${busy[0]}/${busy[1]}` : `Skopiuj do ${picked.size}`}
          </button>
        </div>
      </div>
    </div>
  );
}

function ProductVariantsPanel({
  variants,
  compact,
  catalogProducts,
  onOpenVariant,
  showPrices,
  canEditImages,
  onVariantPatched,
  groupProduct,
  onGroupPatched,
}: {
  variants: ProductVariant[];
  compact?: boolean;
  catalogProducts?: Product[];
  onOpenVariant?: (variant: Product) => void;
  showPrices?: boolean;
  canEditImages?: boolean;
  onVariantPatched?: (id: string, patch: Partial<Product>) => void;
  groupProduct?: Product;
  onGroupPatched?: (patch: Partial<Product>) => void;
}) {
  // pełne produkty wariantów (zdjęcie, cena, znaczniki W/B) — po SKU
  const baseResolved = useMemo(() => {
    const m = new Map<string, Product>();
    if (!catalogProducts) return m;
    const want = new Set(variants.map((v) => String(v.sku).toUpperCase()));
    for (const p of catalogProducts) {
      const k = p.sku.toUpperCase();
      if (want.has(k) && !p.isGroup) m.set(k, p);
    }
    return m;
  }, [catalogProducts, variants]);
  // warianty, których nie ma na załadowanej liście (np. ukryte, inny katalog) — dociągamy z bazy po SKU
  const [fetched, setFetched] = useState<Map<string, Product>>(new Map());
  useEffect(() => {
    const missing = variants.map((v) => String(v.sku).trim().toUpperCase()).filter((k) => k && !baseResolved.has(k));
    if (!missing.length) return;
    let cancelled = false;
    fetchProductsBySkus(missing)
      .then((rows) => {
        if (cancelled || !rows.length) return;
        setFetched(new Map(rows.filter((p) => !p.isGroup).map((p) => [p.sku.toUpperCase(), p] as const)));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [variants, baseResolved]);
  const resolved = useMemo(() => {
    if (!fetched.size) return baseResolved;
    const m = new Map(fetched);
    for (const [k, v] of baseResolved) m.set(k, v);
    return m;
  }, [baseResolved, fetched]);
  const [copyOpen, setCopyOpen] = useState<{ source?: string } | null>(null);
  // zdjęcia widoczne od razu po skopiowaniu (bez czekania na odświeżenie listy)
  const [localImages, setLocalImages] = useState<Map<string, string[]>>(new Map());
  const withLocal = (p: Product): Product => {
    const urls = localImages.get(p.id);
    return urls ? { ...p, customImageUrl: urls[0], extraImageUrls: urls.slice(1), hasImage: true } : p;
  };

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
        {canEditImages && resolved.size > 0 && (
          <button
            type="button"
            onClick={() => setCopyOpen({})}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] font-medium text-slate-300 hover:border-brand-500/40 hover:bg-slate-800"
            title="Wybierz produkt ze zdjęciami i wgraj je pozostałym oraz jako zdjęcie grupy"
          >
            <Images className="h-3 w-3" /> Zdjęcia dla grupy / wszystkich
          </button>
        )}
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
        {list.map((v) => {
          const found = resolved.get(String(v.sku).trim().toUpperCase());
          const full = found ? withLocal(found) : undefined;
          const price = full?.priceSaleGross ?? 0;
          const openable = !!(full && onOpenVariant);
          return (
          <li
            key={v.sku}
            onClick={openable ? () => onOpenVariant!(full!) : undefined}
            className={`flex items-start justify-between gap-3 px-4 py-3 hover:bg-slate-900/50 ${openable ? 'cursor-pointer' : ''}`}
          >
            {full && (
              <span className="mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-800 bg-white">
                {full.hasImage || full.imageUrl ? (
                  <ProductImage product={full} className="h-full w-full object-contain" />
                ) : (
                  <ImageOff className="h-5 w-5 text-slate-400" aria-label="Brak zdjęcia" />
                )}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                {full && <BaselinkerTag product={full} />}
                {full && <WaproMagTag product={full} />}
                {full && !(full.hasImage || full.imageUrl) && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-red-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-red-300">
                    <ImageOff className="h-3 w-3" /> brak zdjęcia
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-sm leading-snug text-slate-200">{v.name}</p>
              {v.ean && (
                <p className="mt-0.5 font-mono text-[11px] text-slate-500">EAN {v.ean}</p>
              )}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              {showPrices && price > 0 && (
                <span className="text-sm font-semibold tabular-nums text-slate-100">{formatPricePln(price)}</span>
              )}
              {canEditImages && full && (full.hasImage || full.imageUrl) && resolved.size > 1 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCopyOpen({ source: full.id });
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] font-medium text-slate-300 hover:border-brand-500/40 hover:bg-slate-800"
                  title="Skopiuj zdjęcia tego wariantu do pozostałych"
                >
                  <Images className="h-3 w-3" /> zdjęcia → inne
                </button>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  void copySku(v.sku);
                }}
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
          );
        })}
      </ul>
      {copyOpen && (
        <CopyImagesDialog
          members={[...resolved.values()].map(withLocal)}
          group={groupProduct}
          initialSource={copyOpen.source}
          onClose={() => setCopyOpen(null)}
          onDone={(res) => {
            const gid = groupProduct?.id;
            setLocalImages((prev) => new Map([...prev, ...[...res].filter(([id]) => id !== gid)]));
            for (const [id, urls] of res) {
              const patch = { customImageUrl: urls[0], extraImageUrls: urls.slice(1), hasImage: true };
              if (id === gid) onGroupPatched?.(patch);
              onVariantPatched?.(id, patch);
            }
          }}
        />
      )}
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

const NEW_CATEGORY = '__new__';

/** Lista kategorii do wyboru (zawsze pełna) + możliwość wpisania nowej. */
function CategoryPicker({
  value,
  options,
  onChange,
}: {
  value: string;
  options: string[];
  onChange: (next: string) => void;
}) {
  const [custom, setCustom] = useState(false);
  const [draft, setDraft] = useState('');
  const [adding, setAdding] = useState(false);
  const all = useMemo(() => {
    const set = new Set(options.filter(Boolean));
    if (value) set.add(value);
    return [...set].sort((a, b) => a.localeCompare(b, 'pl'));
  }, [options, value]);
  async function commit() {
    setAdding(true);
    try {
      // zapis na stałe w bazie: kategoria trafia do wspólnej listy i jest dostępna w każdym produkcie
      const saved = await addCategory(draft, null);
      onChange(saved);
      showToast(`Kategoria „${saved}” zapisana — dopracujesz jej położenie w sekcji Kategorie`, 'ok', 5000);
      setCustom(false);
      setDraft('');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Nie udało się dodać kategorii', 'error', 8000);
    } finally {
      setAdding(false);
    }
  }

  return (
    <>
      <select
        value={custom ? NEW_CATEGORY : value}

        onChange={(e) => {
          if (e.target.value === NEW_CATEGORY) {
            setCustom(true);
            return;
          }
          setCustom(false);
          onChange(e.target.value);
        }}
        className="input-field"
      >
        {!value && <option value="">— wybierz kategorię —</option>}
        {all.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
        <option value={NEW_CATEGORY}>+ Nowa kategoria…</option>
      </select>
      {custom && (
        <div className="mt-2 flex gap-2">
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void commit();
              }
            }}
            placeholder="Nazwa nowej kategorii"
            className="input-field min-w-0 flex-1"
          />
          <button
            type="button"
            disabled={adding || !cleanCategoryName(draft)}
            onClick={() => void commit()}
            className="rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
          >
            {adding ? 'Dodaję…' : 'Dodaj'}
          </button>
        </div>
      )}
    </>
  );
}

