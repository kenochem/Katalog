import { Plus, Trash2, Package, ChevronDown, ChevronUp, Save, X, ShoppingCart, Camera, Upload, Loader2, ImageOff } from 'lucide-react';
import { useRef, useState } from 'react';
import type { Kit, KitItem, Product } from '../types';
import { saveKit, deleteKit, getProductImage, uploadKitImage } from '../lib/products';
import { addKitToOrderDraft } from '../lib/orderDraft';
import { SearchBar } from './SearchBar';
import { BarcodeScanner } from './BarcodeScanner';
import { filterProducts } from '../lib/search';
import { showToast } from '../lib/toast';

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
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [editingKit, setEditingKit] = useState<Kit | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Gotowe zestawy</h2>
          <p className="text-sm text-slate-400">
            Składane przez Piotrka — gotowe komplety na tacy
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditingKit(null);
            setShowEditor(true);
          }}
          className="flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-500"
        >
          <Plus className="h-4 w-4" />
          Nowy zestaw
        </button>
      </div>

      {kits.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-700 py-16 text-center">
          <Package className="mx-auto h-12 w-12 text-slate-600" />
          <p className="mt-3 text-slate-400">Brak zestawów</p>
          <p className="mt-1 text-sm text-slate-500">
            Dodaj pierwszy zestaw, np. „Lanca do myjni Karcher HD"
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {kits.map((kit) => (
            <KitCard
              key={kit.id}
              kit={kit}
              products={products}
              expanded={expandedId === kit.id}
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
                        const p =
                          products.find((x) => x.id === id) ||
                          products.find((x) => x.sku === sku);
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

      {showEditor && (
        <KitEditor
          kit={editingKit}
          products={products}
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
  products,
  expanded,
  onToggle,
  onEdit,
  onDelete,
  onAddToOrder,
}: {
  kit: Kit;
  products: Product[];
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddToOrder?: () => void;
}) {
  const productMap = new Map(products.map((p) => [p.id, p]));

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 p-4 text-left"
      >
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-brand-500/15">
          {kit.imageUrl ? (
            <img src={kit.imageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <Package className="h-6 w-6 text-brand-400" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-medium text-slate-100">{kit.name}</h3>
          <p className="text-sm text-slate-400">
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
        <div className="border-t border-slate-800 px-4 pb-4">
          {kit.description && (
            <p className="py-3 text-sm text-slate-400">{kit.description}</p>
          )}
          <ul className="space-y-2">
            {kit.items.map((item, i) => {
              const prod = productMap.get(item.productId);
              const img = prod ? getProductImage(prod) : null;
              return (
                <li
                  key={`${item.productId}-${i}`}
                  className="flex items-center gap-3 rounded-lg bg-slate-800/50 px-3 py-2"
                >
                  {img ? (
                    <img
                      src={img}
                      alt=""
                      className="h-10 w-10 shrink-0 rounded-md object-contain bg-slate-900"
                    />
                  ) : (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-slate-900 text-slate-600">
                      <ImageOff className="h-4 w-4" />
                    </div>
                  )}
                  <span className="font-mono text-xs text-brand-400">
                    {item.quantity}×
                  </span>
                  <span className="font-mono text-xs text-slate-500">
                    {item.sku}
                  </span>
                  <span className="flex-1 truncate text-sm text-slate-300">
                    {prod?.displayName || item.name}
                  </span>
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
            <button
              type="button"
              onClick={onEdit}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
            >
              Edytuj
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="rounded-lg border border-red-900/50 px-3 py-1.5 text-xs text-red-400 hover:bg-red-950/50"
            >
              <Trash2 className="inline h-3 w-3" /> Usuń
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function KitEditor({
  kit,
  products,
  onClose,
  onSaved,
}: {
  kit: Kit | null;
  products: Product[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(kit?.name ?? '');
  const [description, setDescription] = useState(kit?.description ?? '');
  const [category, setCategory] = useState(kit?.category ?? 'Zestawy');
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
        className="animate-fade-in max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-slate-700 bg-slate-900 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-800 bg-slate-900/95 px-4 py-3 backdrop-blur">
          <h3 className="font-semibold text-slate-100">
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
              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-800">
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
              <ul className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-slate-700">
                {filtered.map((p) => {
                  const img = getProductImage(p);
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => addItem(p)}
                        className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-slate-800"
                      >
                        {img ? (
                          <img
                            src={img}
                            alt=""
                            className="h-9 w-9 shrink-0 rounded-md object-contain bg-slate-900"
                          />
                        ) : (
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-900 text-slate-600">
                            <ImageOff className="h-4 w-4" />
                          </div>
                        )}
                        <span className="font-mono text-xs text-brand-400">
                          {p.sku}
                        </span>
                        <span className="truncate text-slate-300">
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
                  const prod = products.find((p) => p.id === item.productId);
                  const img = prod ? getProductImage(prod) : null;
                  return (
                    <li
                      key={`${item.productId}-${i}`}
                      className="flex items-center gap-2 rounded-lg bg-slate-800/50 px-3 py-2"
                    >
                      {img ? (
                        <img
                          src={img}
                          alt=""
                          className="h-9 w-9 shrink-0 rounded-md object-contain bg-slate-900"
                        />
                      ) : (
                        <div className="h-9 w-9 shrink-0 rounded-md bg-slate-900" />
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
                        className="w-12 rounded border border-slate-600 bg-slate-900 px-1 py-0.5 text-center text-sm"
                      />
                      <span className="font-mono text-xs text-brand-400">
                        {item.sku}
                      </span>
                      <span className="flex-1 truncate text-sm text-slate-300">
                        {item.name}
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
