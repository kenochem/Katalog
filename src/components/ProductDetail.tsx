import {
  X, Camera, Upload, Loader2, Package, Pencil, Save, Trash2,
  Minus, Plus, Images, Printer, Tag, ShoppingCart,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Product } from '../types';
import { ACCESSORY_CATEGORIES } from '../types';
import {
  getProductImage, getProductImages, updateProductImage, addProductExtraImage,
  updateProduct, deleteProductImage, deleteProductExtraImage, fetchProductById,
} from '../lib/products';
import { formatStock, formatPricePln, formatMarginPercent, marginPercent, stripHtml } from '../lib/format';
import { addToLabelQueue } from '../lib/labelQueue';
import { addToOrderDraft } from '../lib/orderDraft';
import { showToast } from '../lib/toast';
import { roleCan, type AppRole } from '../lib/roles';

interface ProductDetailProps {
  product: Product;
  onClose: () => void;
  onImageUpdated?: (productId: string, url: string) => void;
  onProductUpdated?: (product: Product) => void;
  onLabelQueueChange?: () => void;
  onOrderDraftChange?: () => void;
  role?: AppRole;
}

export function ProductDetail({
  product,
  onClose,
  onImageUpdated,
  onProductUpdated,
  onLabelQueueChange,
  onOrderDraftChange,
  role = 'guest',
}: ProductDetailProps) {
  const [detail, setDetail] = useState(product);
  const [uploading, setUploading] = useState(false);
  const [uploadingExtra, setUploadingExtra] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState(product.displayName);
  const [category, setCategory] = useState(product.category);
  const [description, setDescription] = useState(() => stripHtml(product.description));
  const [ean, setEan] = useState(product.ean || '');
  const [stock, setStock] = useState(product.stock ?? 0);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [localPrimaryImage, setLocalPrimaryImage] = useState<string | null>(null);
  const [localExtraImages, setLocalExtraImages] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const extraFileRef = useRef<HTMLInputElement>(null);
  const extraCameraRef = useRef<HTMLInputElement>(null);
  const [deleting, setDeleting] = useState(false);

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
    setDetail(product);
    setDisplayName(product.displayName);
    setCategory(product.category);
    setDescription(stripHtml(product.description));
    setEan(product.ean || '');
    setStock(product.stock ?? 0);
    setLocalPrimaryImage(null);
    setLocalExtraImages([]);
    setSelectedIdx(0);
    setEditing(false);

    fetchProductById(product.id).then((full) => {
      if (full) {
        setDetail(full);
        setDescription(stripHtml(full.description));
        setEan(full.ean || '');
        setStock(full.stock ?? 0);
      }
    });
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

  async function handleUpload(file: File) {
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
      showToast('Zdjęcie zapisane', 'ok');
    } catch (err) {
      console.error(err);
      showToast('Błąd wgrywania zdjęcia', 'error');
    } finally {
      setUploading(false);
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
      const updates = {
        displayName,
        category,
        description,
        ean: normalizedEan,
        stock: normalizedStock,
        stockManual: true,
      };
      await updateProduct(product.id, updates);
      onProductUpdated?.({ ...detail, ...updates });
      setDetail((prev) => ({ ...prev, ...updates }));
      setEditing(false);
      showToast('Zapisano zmiany', 'ok');
    } catch (err) {
      console.error(err);
      showToast('Błąd zapisu', 'error');
    } finally {
      setSaving(false);
    }
  }

  const editCategories =
    detail.catalog === 'shop'
      ? Array.from(
          new Set([
            detail.category,
            'Chemia',
            'Odświeżacze',
            'Szczotki',
            'Myjki',
            'Opryskiwacze',
            'Akcesoria sklepowe',
            'Smary',
            'Abel Auto',
            'Dom i ogród',
            'Inne',
          ]),
        )
      : ACCESSORY_CATEGORIES.filter((c) => c !== 'Wszystkie');
  const variantCount = detail.variants?.length ?? 0;
  const isGroup = detail.isGroup || variantCount > 0;
  const hasPrimary = !!primaryImage;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="animate-fade-in max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-slate-700 bg-slate-900 sm:rounded-3xl lg:max-w-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-800 bg-slate-900/95 px-4 py-3 backdrop-blur">
          <span className="font-mono text-sm text-brand-400">
            {isGroup ? `Grupa · ${variantCount} wariantów` : detail.sku}
          </span>
          <div className="flex items-center gap-1">
            {roleCan(role, 'editProduct') && (
              <button
                type="button"
                onClick={() => (editing ? handleSaveEdits() : setEditing(true))}
                disabled={saving}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                title={editing ? 'Zapisz' : 'Edytuj'}
              >
                {saving ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : editing ? (
                  <Save className="h-5 w-5 text-brand-400" />
                ) : (
                  <Pencil className="h-5 w-5" />
                )}
              </button>
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

        <div className="relative aspect-square bg-slate-800">
          {roleCan(role, 'viewImages') && displayImage ? (
            <>
              <img
                src={displayImage}
                alt={detail.displayName}
                className="h-full w-full object-contain p-4"
              />
              {roleCan(role, 'deleteImage') && (
                <button
                  type="button"
                  disabled={deleting || uploading || uploadingExtra}
                  onClick={handleDeleteImage}
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
              {allImages.length > 1 && (
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
                <p className="text-sm">Brak zdjęcia — dodaj poniżej</p>
              )}
            </div>
          )}
        </div>

        <div className="space-y-4 p-4">
          {editing ? (
            <div className="space-y-3">
              <label className="block">
                <span className="mb-1 text-xs text-slate-500">Nazwa wyświetlana</span>
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="input-field"
                />
              </label>
              <label className="block">
                <span className="mb-1 text-xs text-slate-500">Kategoria</span>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="input-field"
                >
                  {editCategories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
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
                <Badge label={category} />
                {detail.manufacturer &&
                  detail.manufacturer.trim().toLowerCase() !== 'wapro' &&
                  !displayName
                    .toLowerCase()
                    .includes(detail.manufacturer.trim().toLowerCase()) && (
                    <Badge label={detail.manufacturer} muted />
                  )}
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
                        {formatPricePln(detail.priceSaleGross)}
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
                <div>
                  <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                    Dostępne rozmiary / SKU ({variantCount})
                  </h3>
                  <ul className="max-h-64 space-y-1 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/50 p-2">
                    {detail.variants.map((v) => (
                      <li
                        key={v.sku}
                        className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-800/60"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-slate-300">{v.name}</p>
                          {v.ean && (
                            <p className="font-mono text-[10px] text-slate-500">EAN {v.ean}</p>
                          )}
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-0.5">
                          <span className="font-mono text-xs text-brand-400">{v.sku}</span>
                          <span
                            className={`text-xs font-medium ${
                              (v.stock ?? 0) <= 0 ? 'text-red-400' : 'text-slate-300'
                            }`}
                          >
                            stan {formatStock(v.stock ?? 0)}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}

          {roleCan(role, 'uploadImage') && (
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

          {roleCan(role, 'printLabels') && (
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

          {roleCan(role, 'useCrm') && !detail.isGroup && (
            <div className="border-t border-slate-800 pt-3">
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-500">
                Zamówienie
              </p>
              <button
                type="button"
                onClick={() => {
                  addToOrderDraft({
                    ...detail,
                    imageUrl: getProductImage(detail) || undefined,
                  });
                  onOrderDraftChange?.();
                  showToast('Dodano do zamówienia', 'ok');
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-brand-500/40 bg-brand-500/10 py-2.5 text-sm font-medium text-brand-200 transition hover:bg-brand-500/20"
              >
                <ShoppingCart className="h-4 w-4" />
                Do zamówienia
              </button>
            </div>
          )}
        </div>
      </div>
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
