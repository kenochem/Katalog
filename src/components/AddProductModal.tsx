import { Camera, Loader2, Save, Upload, X } from 'lucide-react';
import { useRef, useState } from 'react';
import type { Product, CatalogType } from '../types';
import { ACCESSORY_CATEGORIES, deriveCategories } from '../types';
import { createProduct } from '../lib/products';

interface AddProductModalProps {
  onClose: () => void;
  onSaved: (product: Product) => void;
  catalog?: CatalogType;
  existingProducts?: Product[];
}

export function AddProductModal({
  onClose,
  onSaved,
  catalog = 'accessories',
  existingProducts = [],
}: AddProductModalProps) {
  const categoryOptions =
    catalog === 'shop'
      ? deriveCategories(existingProducts).filter((c) => c !== 'Wszystkie')
      : ACCESSORY_CATEGORIES.filter((c) => c !== 'Wszystkie');
  const defaultCategory =
    catalog === 'shop' ? categoryOptions[0] || 'Inne' : 'Inne części';

  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [category, setCategory] = useState(defaultCategory);
  const [manufacturer, setManufacturer] = useState('');
  const [ean, setEan] = useState('');
  const [description, setDescription] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File) {
    setImageFile(file);
    setPreview(URL.createObjectURL(file));
  }

  async function handleSave() {
    if (!sku.trim() || !name.trim()) {
      alert('Podaj SKU i nazwę produktu.');
      return;
    }

    setSaving(true);
    try {
      const product = await createProduct(
        {
          sku: sku.trim().toUpperCase(),
          name: name.trim(),
          displayName: (displayName || name).trim(),
          category,
          manufacturer: manufacturer.trim(),
          ean: ean.replace(/\D/g, ''),
          imageUrl: '',
          description: description.trim(),
          stock: 0,
          catalog,
        },
        imageFile || undefined,
      );
      onSaved(product);
    } catch (err) {
      console.error(err);
      alert('Błąd zapisu produktu.');
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
            Dodaj produkt {catalog === 'shop' ? '(Produkty)' : '(Akcesoria)'}
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
          <div className="relative mx-auto flex aspect-square w-40 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-slate-600 bg-slate-800">
            {preview ? (
              <img src={preview} alt="" className="h-full w-full object-contain" />
            ) : (
              <span className="text-center text-xs text-slate-500">
                Zdjęcie opcjonalne
              </span>
            )}
          </div>

          <div className="flex gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
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
                if (f) handleFile(f);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-600 py-2.5 text-sm text-white hover:bg-brand-500"
            >
              <Camera className="h-4 w-4" />
              Zrób zdjęcie
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-700 py-2.5 text-sm text-slate-300 hover:bg-slate-800"
            >
              <Upload className="h-4 w-4" />
              Plik
            </button>
          </div>

          <Field label="SKU / Indeks katalogowy *">
            <input
              value={sku}
              onChange={(e) => setSku(e.target.value.toUpperCase())}
              placeholder="np. HYD000520"
              className="input-field font-mono uppercase"
            />
          </Field>

          <Field label="Nazwa *">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nazwa produktu"
              className="input-field"
            />
          </Field>

          <Field label="Nazwa wyświetlana">
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Zostaw puste = nazwa powyżej"
              className="input-field"
            />
          </Field>

          <Field label="Kategoria">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="input-field"
            >
              {categoryOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Producent">
            <input
              value={manufacturer}
              onChange={(e) => setManufacturer(e.target.value)}
              placeholder="opcjonalnie"
              className="input-field"
            />
          </Field>

          <Field label="EAN / kod kreskowy">
            <input
              value={ean}
              onChange={(e) => setEan(e.target.value.replace(/\D/g, ''))}
              inputMode="numeric"
              placeholder="opcjonalnie"
              className="input-field font-mono"
            />
          </Field>

          <Field label="Opis / notatki">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="input-field resize-none"
            />
          </Field>

          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-3 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Save className="h-5 w-5" />
            )}
            {saving ? 'Zapisywanie...' : 'Zapisz produkt'}
          </button>
        </div>
      </div>
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
