import { Plus, Trash2, Package, ChevronDown, ChevronUp, Save, X, ShoppingCart, Camera, Upload, Loader2, ImageOff } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import type { Kit, KitItem, Product } from '../types';
import { saveKit, deleteKit, getProductImage, uploadKitImage } from '../lib/products';
import {
  isBaselinkerKit,
  isOwnKit,
  KIT_SEGMENT_LABELS,
  OWN_KIT_DEFAULT_CATEGORY,
  type KitSegment,
} from '../lib/kitSource';
import { addKitToOrderDraft } from '../lib/orderDraft';
import { SearchBar } from './SearchBar';
import { BarcodeScanner } from './BarcodeScanner';
import { filterProducts } from '../lib/search';
import { showToast } from '../lib/toast';
import {
  buildProductLookup,
  kitLinkedCount,
  resolveKitItemProduct,
} from '../lib/kitResolve';

interface KitsViewProps {
  kits: Kit[];
  products: Product[];
  onKitsChange: () => void;
  canAddToOrder?: boolean;
  onOrderDraftChange?: () => void;
}

export function KitsView({
  kits,
  products,
  onKitsChange,
  canAddToOrder,
  onOrderDraftChange,
}: KitsViewProps) {
  const [segment, setSegment] = useState<KitSegment>(() =>
    kits.some(isBaselinkerKit) ? 'baselinker' : 'own',
  );
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [editingKit, setEditingKit] = useState<Kit | null>(null);

  const baselinkerKits = useMemo(() => kits.filter(isBaselinkerKit), [kits]);
  const ownKits = useMemo(() => kits.filter(isOwnKit), [kits]);
  const visibleKits = segment === 'baselinker' ? baselinkerKits : ownKits;
  const readOnlyList = segment === 'baselinker';

  const productLookup = useMemo(() => buildProductLookup(products), [products]);

  return (
    <div className="kits-view space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Zestawy</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {segment === 'baselinker'
              ? 'Import z BaseLinker — podgląd i dodawanie do zamówienia.'
              : 'Zestawy robocze i techniczne tworzone w katalogu.'}
          </p>
        </div>
        {!readOnlyList && (
          <button
            type="button"
            onClick={() => {
              setEditingKit(null);
              setShowEditor(true);
            }}
            className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-500"
          >
            <Plus className="h-4 w-4" />
            Nowy zestaw
          </button>
        )}
      </div>

      <div
        className="flex gap-1 rounded-xl border border-stone-200/90 bg-stone-100/90 p-1 dark:border-slate-800 dark:bg-slate-900/60"
        role="tablist"
        aria-label="Rodzaj zestawów"
      >
        {(['baselinker', 'own'] as const).map((key) => {
          const count = key === 'baselinker' ? baselinkerKits.length : ownKits.length;
          const active = segment === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                setSegment(key);
                setExpandedId(null);
              }}
              className={`min-w-0 flex-1 rounded-lg px-3 py-2 text-sm font-medium transition sm:flex-none sm:px-4 ${
                active
                  ? 'bg-white text-stone-900 shadow-sm ring-1 ring-stone-200/80 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700'
                  : 'text-stone-600 hover:text-stone-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              {KIT_SEGMENT_LABELS[key]}
              <span
                className={`ml-1.5 tabular-nums ${
                  active ? 'text-slate-500 dark:text-slate-400' : 'text-slate-400 dark:text-slate-500'
                }`}
              >
                ({count})
              </span>
            </button>
          );
        })}
      </div>

      {visibleKits.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50/80 py-16 text-center dark:border-slate-700 dark:bg-transparent">
          <Package className="mx-auto h-12 w-12 text-stone-400 dark:text-slate-600" />
          <p className="mt-3 text-stone-700 dark:text-slate-400">
            {readOnlyList ? 'Brak zestawów BaseLinker' : 'Brak własnych zestawów'}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {readOnlyList
              ? 'Zaimportuj plik Zestawy z Base (skrypt import-baselinker-kits).'
              : 'Dodaj pierwszy zestaw, np. „Lanca do myjni Karcher HD".'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleKits.map((kit) => (
            <KitCard
              key={kit.id}
              kit={kit}
              productLookup={productLookup}
              expanded={expandedId === kit.id}
              readOnly={readOnlyList}
              onToggle={() =>
                setExpandedId(expandedId === kit.id ? null : kit.id)
              }
              onEdit={() => {
                setEditingKit(kit);
                setShowEditor(true);
              }}
              onDelete={async () => {
                if (confirm(`Usunąć zestaw „${kit.name}"?`)) {
                  await deleteKit(kit.id);
                  onKitsChange();
                }
              }}
              onAddToOrder={
                canAddToOrder
                  ? () => {
                      addKitToOrderDraft(kit, 1, (id, sku) => {
                        const lookup = productLookup;
                        const p =
                          lookup.byId.get(id) ||
                          (sku ? lookup.bySku.get(sku.toUpperCase()) : undefined);
                        return p ? getProductImage(p) || undefined : undefined;
                      });
                      onOrderDraftChange?.();
                      showToast(`Zestaw „${kit.name}” dodany do zamówienia`, 'ok');
                    }
                  : undefined
              }
            />
          ))}
        </div>
      )}

      {showEditor && !readOnlyList && (
        <KitEditor
          kit={editingKit}
          products={products}
          productLookup={productLookup}
          onClose={() => {
            setShowEditor(false);
            setEditingKit(null);
          }}
          onSaved={() => {
            setShowEditor(false);
            setEditingKit(null);
            onKitsChange();
          }}
        />
      )}
    </div>
  );
}

function KitCard({
  kit,
  productLookup,
  expanded,
  onToggle,
  onEdit,
  onDelete,
  onAddToOrder,
  readOnly = false,
}: {
  kit: Kit;
  productLookup: ReturnType<typeof buildProductLookup>;
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddToOrder?: () => void;
  readOnly?: boolean;
}) {
  const linked = kitLinkedCount(kit.items, productLookup);
  const total = kit.items.length;

  return (
    <div className="overflow-hidden rounded-2xl border border-stone-200/90 bg-white shadow-sm shadow-stone-200/40 dark:border-slate-800 dark:bg-slate-900/80 dark:shadow-none">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 p-4 text-left"
      >
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-emerald-800/10 ring-1 ring-stone-200/80 dark:bg-brand-500/15 dark:ring-transparent">
          {kit.imageUrl ? (
            <img src={kit.imageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <Package className="h-6 w-6 text-brand-400" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-medium text-stone-900 dark:text-slate-100">{kit.name}</h3>
            {readOnly && (
              <span className="rounded-md bg-stone-200/90 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-stone-600 dark:bg-slate-800 dark:text-slate-400">
                Base
              </span>
            )}
            {readOnly && total > 0 && linked < total && (
              <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                {linked}/{total} w katalogu
              </span>
            )}
          </div>
          <p className="text-sm text-stone-600 dark:text-slate-400">
            {kit.items.length} elementów · {kit.category}
          </p>
        </div>
        {expanded ? (
          <ChevronUp className="h-5 w-5 shrink-0 text-slate-500" />
        ) : (
          <ChevronDown className="h-5 w-5 shrink-0 text-slate-500" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-stone-200 bg-stone-50/90 px-4 pb-4 dark:border-slate-800 dark:bg-slate-950/30">
          {kit.description && (
            <p className="py-3 text-sm text-stone-600 dark:text-slate-400">{kit.description}</p>
          )}
          <ul className="space-y-2">
            {kit.items.map((item, i) => {
              const prod = resolveKitItemProduct(item, productLookup);
              const img = prod ? getProductImage(prod) : null;
              const unmatched = !prod;
              return (
                <li
                  key={`${item.productId}-${item.sku}-${i}`}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 ${
                    unmatched
                      ? 'border border-dashed border-amber-300/80 bg-amber-50/90 dark:border-amber-800/50 dark:bg-amber-950/20'
                      : 'border border-stone-200/80 bg-white dark:border-slate-700/50 dark:bg-slate-800/50'
                  }`}
                >
                  {img ? (
                    <img
                      src={img}
                      alt=""
                      className="h-10 w-10 shrink-0 rounded-md object-contain bg-stone-100 dark:bg-slate-900"
                    />
                  ) : (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-stone-100 text-stone-400 dark:bg-slate-900 dark:text-slate-600">
                      <ImageOff className="h-4 w-4" />
                    </div>
                  )}
                  <span className="font-mono text-xs font-semibold text-emerald-700 dark:text-brand-400">
                    {item.quantity}×
                  </span>
                  <span className="font-mono text-xs text-stone-500 dark:text-slate-500">
                    {item.sku || '—'}
                  </span>
                  <span className="flex-1 truncate text-sm text-stone-800 dark:text-slate-300">
                    {prod?.displayName || item.name}
                  </span>
                  {unmatched && (
                    <span className="shrink-0 text-[10px] font-medium text-amber-700 dark:text-amber-400">
                      brak SKU
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            {onAddToOrder && (
              <button
                type="button"
                onClick={onAddToOrder}
                className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-500"
              >
                <ShoppingCart className="h-3.5 w-3.5" />
                Do zamówienia
              </button>
            )}
            {!readOnly && (
              <>
                <button
                  type="button"
                  onClick={onEdit}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Edytuj
                </button>
                <button
                  type="button"
                  onClick={onDelete}
                  className="rounded-lg border border-red-300 px-3 py-1.5 text-xs text-red-700 hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/50"
                >
                  <Trash2 className="inline h-3 w-3" /> Usuń
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function KitEditor({
  kit,
  products,
  productLookup,
  onClose,
  onSaved,
}: {
  kit: Kit | null;
  products: Product[];
  productLookup: ReturnType<typeof buildProductLookup>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(kit?.name ?? '');
  const [description, setDescription] = useState(kit?.description ?? '');
  const [category, setCategory] = useState(
    kit?.category ?? OWN_KIT_DEFAULT_CATEGORY,
  );
  const [items, setItems] = useState<KitItem[]>(kit?.items ?? []);
  const [imageUrl, setImageUrl] = useState(kit?.imageUrl ?? '');
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState(kit?.imageUrl ?? '');
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const filtered = search.trim().length >= 2
    ? filterProducts(products, search, 'Wszystkie').slice(0, 8)
    : [];

  function addItem(product: Product) {
    const existing = items.find((i) => i.productId === product.id);
    if (existing) {
      setItems(
        items.map((i) =>
          i.productId === product.id
            ? { ...i, quantity: i.quantity + 1 }
            : i,
        ),
      );
    } else {
      setItems([
        ...items,
        {
          productId: product.id,
          sku: product.sku,
          name: product.displayName,
          quantity: 1,
        },
      ]);
    }
    setSearch('');
  }

  function pickImage(file: File) {
    setPendingImage(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  async function handleSave() {
    if (!name.trim() || items.length === 0) {
      showToast('Podaj nazwę i dodaj co najmniej 1 element', 'warn');
      return;
    }
    setSaving(true);
    try {
      const id = await saveKit({
        id: kit?.id,
        name: name.trim(),
        description: description.trim(),
        category,
        items,
        imageUrl: imageUrl || undefined,
        createdAt: kit?.createdAt ?? Date.now(),
      });
      if (pendingImage) {
        const url = await uploadKitImage(id, pendingImage);
        setImageUrl(url);
      }
      showToast('Zestaw zapisany', 'ok');
      onSaved();
    } catch (err) {
      console.error(err);
      showToast('Błąd zapisu zestawu', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="animate-fade-in max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-stone-200 bg-white sm:rounded-3xl dark:border-slate-700 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-stone-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
          <h3 className="font-semibold text-stone-900 dark:text-slate-100">
            {kit ? 'Edytuj zestaw' : 'Nowy zestaw'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-4">
          <Field label="Zdjęcie zestawu">
            <div className="flex items-center gap-3">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-stone-100 dark:bg-slate-800">
                {previewUrl ? (
                  <img src={previewUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Package className="h-8 w-8 text-slate-600" />
                )}
              </div>
              <div className="flex flex-1 flex-col gap-2">
                <input
                  ref={cameraRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) pickImage(f);
                    e.target.value = '';
                  }}
                />
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) pickImage(f);
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  onClick={() => cameraRef.current?.click()}
                  className="flex items-center justify-center gap-1.5 rounded-lg bg-brand-600 py-2 text-xs font-medium text-white"
                >
                  <Camera className="h-3.5 w-3.5" />
                  Zdjęcie
                </button>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-700 py-2 text-xs font-medium text-slate-300"
                >
                  <Upload className="h-3.5 w-3.5" />
                  Plik
                </button>
              </div>
            </div>
          </Field>

          <Field label="Nazwa zestawu">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="np. Lanca kompletna — myjnia Karcher HD"
              className="input-field"
            />
          </Field>

          <Field label="Opis (opcjonalnie)">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Do czego służy, na jaką myjnię..."
              rows={2}
              className="input-field resize-none"
            />
          </Field>

          <Field label="Kategoria">
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="np. Lance, Myjnia samochodowa"
              className="input-field"
            />
          </Field>

          <Field label="Dodaj elementy">
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Szukaj produktu po SKU, nazwie lub EAN..."
              onScanClick={() => setShowScanner(true)}
            />
            {filtered.length > 0 && (
              <ul className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-stone-200 dark:border-slate-700">
                {filtered.map((p) => {
                  const img = getProductImage(p);
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => addItem(p)}
                        className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-stone-100 dark:hover:bg-slate-800"
                      >
                        {img ? (
                          <img
                            src={img}
                            alt=""
                            className="h-9 w-9 shrink-0 rounded-md object-contain bg-stone-100 dark:bg-slate-900"
                          />
                        ) : (
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-stone-100 text-stone-400 dark:bg-slate-900 dark:text-slate-600">
                            <ImageOff className="h-4 w-4" />
                          </div>
                        )}
                        <span className="font-mono text-xs text-emerald-700 dark:text-brand-400">
                          {p.sku}
                        </span>
                        <span className="truncate text-stone-800 dark:text-slate-300">
                          {p.displayName}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Field>

          {items.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                Elementy ({items.length})
              </p>
              <ul className="space-y-1">
                {items.map((item, i) => {
                  const prod = resolveKitItemProduct(item, productLookup);
                  const img = prod ? getProductImage(prod) : null;
                  return (
                    <li
                      key={`${item.productId}-${item.sku}-${i}`}
                      className="flex items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/50"
                    >
                      {img ? (
                        <img
                          src={img}
                          alt=""
                          className="h-9 w-9 shrink-0 rounded-md object-contain bg-white dark:bg-slate-900"
                        />
                      ) : (
                        <div className="h-9 w-9 shrink-0 rounded-md bg-stone-200 dark:bg-slate-900" />
                      )}
                      <input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) => {
                          const qty = parseInt(e.target.value) || 1;
                          setItems(
                            items.map((it, idx) =>
                              idx === i ? { ...it, quantity: qty } : it,
                            ),
                          );
                        }}
                        className="w-12 rounded border border-stone-300 bg-white px-1 py-0.5 text-center text-sm dark:border-slate-600 dark:bg-slate-900"
                      />
                      <span className="font-mono text-xs text-emerald-700 dark:text-brand-400">
                        {item.sku}
                      </span>
                      <span className="flex-1 truncate text-sm text-stone-800 dark:text-slate-300">
                        {prod?.displayName || item.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => setItems(items.filter((_, idx) => idx !== i))}
                        className="text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-3 text-sm font-medium text-white transition hover:bg-brand-500 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
            {saving ? 'Zapisywanie...' : 'Zapisz zestaw'}
          </button>
        </div>
      </div>

      {showScanner && (
        <BarcodeScanner
          onScan={(code) => {
            setSearch(code);
            setShowScanner(false);
          }}
          onClose={() => setShowScanner(false)}
        />
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}
