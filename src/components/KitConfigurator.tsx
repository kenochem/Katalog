import { useMemo, useRef, useState } from 'react';
import {
  Camera,
  Check,
  ImageOff,
  Loader2,
  Minus,
  Package,
  Plus,
  Save,
  ScanLine,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import type { Kit, KitItem, Product } from '../types';
import { getProductImage, saveKit, uploadKitImage } from '../lib/products';
import { filterProducts } from '../lib/search';
import { getProductDisplayCategory } from '../lib/catalogCategory';
import { getAvailableQty } from '../lib/reservedStock';
import { customerGrossPrice, formatPricePln } from '../lib/format';
import { hasBaselinkerLink } from '../lib/baselinkerLink';
import { kitAvailability } from '../lib/kitSync';
import { nextKitCode } from '../lib/kitMeta';
import { salesQty12m } from '../lib/catalogTasks';
import { buildProductLookup, resolveKitItemProduct } from '../lib/kitResolve';
import { OWN_KIT_DEFAULT_CATEGORY } from '../lib/kitSource';
import { showToast } from '../lib/toast';
import { BarcodeScanner } from './BarcodeScanner';

interface Props {
  kit: Kit | null;
  kits: Kit[];
  products: Product[];
  showPrices: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const PAGE = 48;

function unitGross(p: Product | undefined): number | null {
  return p ? customerGrossPrice(p.priceSaleGross, p.priceSaleNet) : null;
}

/** Konfigurator zestawu: wybór produktów po lewej, budowany zestaw po prawej (cena, dostępność, gotowość do BaseLinkera). */
export function KitConfigurator({ kit, kits, products, showPrices, onClose, onSaved }: Props) {
  const [name, setName] = useState(kit?.name ?? '');
  const [description, setDescription] = useState(kit?.description ?? '');
  const [category, setCategory] = useState(kit?.category ?? OWN_KIT_DEFAULT_CATEGORY);
  const [items, setItems] = useState<KitItem[]>(kit?.items ?? []);
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [preview, setPreview] = useState(kit?.imageUrl ?? '');
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState('Wszystkie');
  const [onlyStock, setOnlyStock] = useState(false);
  const [onlyBl, setOnlyBl] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const [pane, setPane] = useState<'products' | 'kit'>('products');
  const [saving, setSaving] = useState(false);
  const [scanner, setScanner] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);

  const lookup = useMemo(() => buildProductLookup(products), [products]);
  const pickable = useMemo(() => products.filter((p) => !p.isGroup && p.sku && !p.sku.toUpperCase().startsWith('GROUP-')), [products]);
  const code = kit?.code ?? nextKitCode(kits);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const p of pickable) set.add(getProductDisplayCategory(p));
    return ['Wszystkie', ...[...set].filter(Boolean).sort((a, b) => a.localeCompare(b, 'pl'))];
  }, [pickable]);

  const results = useMemo(() => {
    let list: Product[];
    if (search.trim().length >= 2) list = filterProducts(pickable, search, cat);
    else {
      list = cat === 'Wszystkie' ? pickable : pickable.filter((p) => getProductDisplayCategory(p) === cat);
      list = [...list].sort((a, b) => salesQty12m(b) - salesQty12m(a) || a.sku.localeCompare(b.sku));
    }
    if (onlyStock) list = list.filter((p) => getAvailableQty(p) > 0);
    if (onlyBl) list = list.filter((p) => hasBaselinkerLink(p));
    return list;
  }, [pickable, search, cat, onlyStock, onlyBl]);

  const qtyOf = (p: Product) => items.find((i) => i.productId === p.id)?.quantity ?? 0;

  function setQty(p: Product, qty: number) {
    setItems((cur) => {
      const idx = cur.findIndex((i) => i.productId === p.id);
      if (qty <= 0) return idx >= 0 ? cur.filter((_, i) => i !== idx) : cur;
      if (idx >= 0) return cur.map((i, k) => (k === idx ? { ...i, quantity: qty } : i));
      return [...cur, { productId: p.id, sku: p.sku, name: p.displayName || p.name, quantity: qty }];
    });
  }

  const totals = useMemo(() => {
    let gross = 0;
    let priced = 0;
    let notInBl = 0;
    for (const it of items) {
      const p = resolveKitItemProduct(it, lookup);
      const price = unitGross(p);
      if (price != null) {
        gross += price * it.quantity;
        priced++;
      }
      if (p && !hasBaselinkerLink(p)) notInBl++;
    }
    return { gross: Math.round(gross * 100) / 100, priced, notInBl };
  }, [items, lookup]);

  const avail = kitAvailability(items, lookup, getAvailableQty);

  function pickImage(file: File) {
    setPendingImage(file);
    setPreview(URL.createObjectURL(file));
  }

  async function save() {
    if (!name.trim() || items.length === 0) {
      showToast('Podaj nazwę i dodaj co najmniej 1 produkt', 'warn');
      return;
    }
    setSaving(true);
    try {
      const id = await saveKit({
        id: kit?.id,
        name: name.trim(),
        description: description.trim(),
        category: category.trim() || OWN_KIT_DEFAULT_CATEGORY,
        items,
        imageUrl: kit?.imageUrl,
        createdAt: kit?.createdAt ?? Date.now(),
        code,
        blId: kit?.blId,
        blActive: kit?.blActive,
      });
      if (pendingImage) await uploadKitImage(id, pendingImage);
      showToast(kit ? 'Zestaw zapisany' : `Zestaw ${code} utworzony`, 'ok');
      onSaved();
    } catch (err) {
      console.error(err);
      showToast(err instanceof Error ? err.message : 'Błąd zapisu zestawu', 'error', 7000);
    } finally {
      setSaving(false);
    }
  }

  const visible = results.slice(0, limit);

  return (
    <div className="fixed inset-0 z-[95] flex flex-col bg-white dark:bg-slate-950">
      <div className="flex items-center justify-between gap-3 border-b border-stone-200 px-4 py-3 dark:border-slate-800">
        <div className="flex min-w-0 items-center gap-2">
          <Package className="h-5 w-5 shrink-0 text-brand-500" />
          <h3 className="truncate font-semibold text-stone-900 dark:text-slate-100">
            {kit ? 'Konfigurator zestawu — edycja' : 'Konfigurator zestawu'}
          </h3>
          <span className="rounded-md bg-stone-900 px-2 py-0.5 font-mono text-xs font-bold text-white">{code}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Zapisz zestaw
          </button>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-800" aria-label="Zamknij">
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="flex gap-1 border-b border-stone-200 p-1 md:hidden dark:border-slate-800">
        {(
          [
            ['products', 'Produkty'],
            ['kit', `Zestaw (${items.length})`],
          ] as const
        ).map(([k, l]) => (
          <button
            key={k}
            type="button"
            onClick={() => setPane(k)}
            className={`flex-1 rounded-lg py-2 text-sm font-medium ${pane === k ? 'bg-slate-700 text-white' : 'text-slate-500'}`}
          >
            {l}
          </button>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 md:grid-cols-[1fr_26rem]">
        {/* produkty */}
        <section className={`${pane === 'products' ? 'flex' : 'hidden'} min-h-0 flex-col md:flex`}>
          <div className="space-y-2 border-b border-stone-200 p-3 dark:border-slate-800">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setLimit(PAGE);
                  }}
                  placeholder="Szukaj produktu: nazwa, SKU, EAN, gwint…"
                  className="input-field with-icon"
                />
              </div>
              <button
                type="button"
                onClick={() => setScanner(true)}
                className="rounded-xl border border-stone-300 px-3 text-slate-600 hover:bg-stone-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                title="Skanuj kod kreskowy"
              >
                <ScanLine className="h-5 w-5" />
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-stone-600 dark:text-slate-400">
              <select
                value={cat}
                onChange={(e) => {
                  setCat(e.target.value);
                  setLimit(PAGE);
                }}
                className="input-field"
                style={{ width: '14rem' }}
                aria-label="Kategoria"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c === 'Wszystkie' ? 'Wszystkie kategorie' : c}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={onlyStock} onChange={(e) => setOnlyStock(e.target.checked)} />
                Tylko dostępne
              </label>
              <label className="flex items-center gap-1.5" title="Produkty powiązane z BaseLinkerem — tylko takie można wysłać w zestawie do BL">
                <input type="checkbox" checked={onlyBl} onChange={(e) => setOnlyBl(e.target.checked)} />
                Tylko z BaseLinkera
              </label>
              <span className="ml-auto">
                {search.trim().length >= 2 ? 'Wyniki' : 'Najczęściej sprzedawane'}: {results.length}
              </span>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {visible.length === 0 ? (
              <p className="py-12 text-center text-sm text-slate-500">Brak produktów dla tych filtrów.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
                {visible.map((p) => {
                  const img = getProductImage(p);
                  const qty = qtyOf(p);
                  const price = unitGross(p);
                  const stock = getAvailableQty(p);
                  return (
                    <div
                      key={p.id}
                      className={`relative flex flex-col overflow-hidden rounded-xl border bg-white dark:bg-slate-900 ${
                        qty > 0 ? 'border-emerald-500 ring-1 ring-emerald-500/50' : 'border-stone-200 dark:border-slate-800'
                      }`}
                    >
                      <button type="button" onClick={() => setQty(p, qty + 1)} className="flex flex-1 flex-col text-left">
                        <div className="flex aspect-square items-center justify-center bg-white">
                          {img ? (
                            <img src={img} alt="" loading="lazy" className="h-full w-full object-contain" />
                          ) : (
                            <ImageOff className="h-6 w-6 text-stone-300" />
                          )}
                        </div>
                        <div className="space-y-0.5 p-2">
                          <p className="line-clamp-2 text-xs font-medium text-stone-900 dark:text-slate-100">{p.displayName || p.name}</p>
                          <p className="font-mono text-[10px] text-stone-500 dark:text-slate-500">{p.sku}</p>
                          <div className="flex items-center justify-between text-[11px]">
                            {showPrices && price != null ? (
                              <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatPricePln(price)}</span>
                            ) : (
                              <span />
                            )}
                            <span className={stock > 0 ? 'text-stone-500 dark:text-slate-400' : 'font-semibold text-red-500'}>stan: {stock}</span>
                          </div>
                          {!hasBaselinkerLink(p) && <p className="text-[10px] text-amber-600 dark:text-amber-400">brak w BaseLinkerze</p>}
                        </div>
                      </button>
                      {qty > 0 ? (
                        <div className="flex items-center justify-between border-t border-emerald-500/40 bg-emerald-500/10 px-1.5 py-1">
                          <button type="button" onClick={() => setQty(p, qty - 1)} className="rounded p-1 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300">
                            <Minus className="h-4 w-4" />
                          </button>
                          <span className="text-sm font-bold text-emerald-700 dark:text-emerald-300">{qty}×</span>
                          <button type="button" onClick={() => setQty(p, qty + 1)} className="rounded p-1 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300">
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setQty(p, 1)}
                          className="flex items-center justify-center gap-1 border-t border-stone-200 py-1.5 text-xs font-semibold text-brand-600 hover:bg-stone-50 dark:border-slate-800 dark:text-brand-400 dark:hover:bg-slate-800"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Dodaj
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {results.length > visible.length && (
              <button
                type="button"
                onClick={() => setLimit((l) => l + PAGE)}
                className="mt-3 w-full rounded-xl border border-stone-300 py-2 text-sm text-stone-700 hover:bg-stone-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Pokaż więcej ({results.length - visible.length})
              </button>
            )}
          </div>
        </section>

        {/* zestaw */}
        <aside className={`${pane === 'kit' ? 'flex' : 'hidden'} min-h-0 flex-col border-l border-stone-200 md:flex dark:border-slate-800`}>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
            <div className="flex items-start gap-3">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-stone-100 dark:bg-slate-800">
                {preview ? <img src={preview} alt="" className="h-full w-full object-contain" /> : <Package className="h-8 w-8 text-slate-500" />}
              </div>
              <div className="flex flex-1 flex-col gap-1.5">
                <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) pickImage(f); e.target.value = ''; }} />
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) pickImage(f); e.target.value = ''; }} />
                <button type="button" onClick={() => camRef.current?.click()} className="flex items-center justify-center gap-1.5 rounded-lg bg-brand-600 py-1.5 text-xs font-medium text-white">
                  <Camera className="h-3.5 w-3.5" /> Zdjęcie
                </button>
                <button type="button" onClick={() => fileRef.current?.click()} className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 py-1.5 text-xs font-medium text-slate-600 dark:border-slate-700 dark:text-slate-300">
                  <Upload className="h-3.5 w-3.5" /> Z pliku
                </button>
              </div>
            </div>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nazwa zestawu" className="input-field font-semibold" />
            <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Kategoria" className="input-field" />
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Opis (opcjonalnie)" rows={2} className="input-field resize-none" />

            <div>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">Skład ({items.length})</p>
              {items.length === 0 ? (
                <p className="rounded-xl border border-dashed border-stone-300 py-8 text-center text-sm text-slate-500 dark:border-slate-700">
                  Klikaj „Dodaj” przy produktach po lewej — pojawią się tutaj.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {items.map((it, i) => {
                    const p = resolveKitItemProduct(it, lookup);
                    const img = p ? getProductImage(p) : null;
                    const price = unitGross(p);
                    return (
                      <li key={`${it.productId}-${i}`} className="flex items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-800/50">
                        {img ? <img src={img} alt="" className="h-10 w-10 shrink-0 rounded-md bg-white object-contain" /> : <div className="h-10 w-10 shrink-0 rounded-md bg-stone-200 dark:bg-slate-900" />}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-stone-900 dark:text-slate-200">{p?.displayName || it.name}</p>
                          <p className="text-[10px] text-stone-500 dark:text-slate-500">
                            <span className="font-mono">{it.sku}</span>
                            {showPrices && price != null && (
                              <span className="ml-1.5 font-semibold text-emerald-600 dark:text-emerald-400">{formatPricePln(price)} / szt.</span>
                            )}
                            {p && !hasBaselinkerLink(p) && <span className="ml-1.5 text-amber-600 dark:text-amber-400">nie w BL</span>}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button type="button" onClick={() => setItems((c) => c.map((x, k) => (k === i ? { ...x, quantity: Math.max(1, x.quantity - 1) } : x)))} className="rounded p-1 text-slate-500 hover:bg-stone-200 dark:hover:bg-slate-700">
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="w-6 text-center text-sm font-bold">{it.quantity}</span>
                          <button type="button" onClick={() => setItems((c) => c.map((x, k) => (k === i ? { ...x, quantity: x.quantity + 1 } : x)))} className="rounded p-1 text-slate-500 hover:bg-stone-200 dark:hover:bg-slate-700">
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <button type="button" onClick={() => setItems((c) => c.filter((_, k) => k !== i))} className="rounded p-1 text-red-400 hover:bg-red-500/10">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          <div className="space-y-1.5 border-t border-stone-200 bg-stone-50/90 p-3 text-xs dark:border-slate-800 dark:bg-slate-950/60">
            {showPrices && (
              <p className="flex items-baseline justify-between">
                <span className="text-stone-600 dark:text-slate-400">Wartość składników (brutto)</span>
                <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{formatPricePln(totals.gross)}</span>
              </p>
            )}
            {avail && (
              <p className={avail.count > 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-600 dark:text-red-400'}>
                {avail.count > 0 ? `Do złożenia teraz: ${avail.count} (ogranicza: ${avail.limiting})` : `Brak składnika: ${avail.limiting}`}
              </p>
            )}
            {items.length > 0 &&
              (totals.notInBl === 0 ? (
                <p className="flex items-center gap-1 text-sky-700 dark:text-sky-300">
                  <Check className="h-3.5 w-3.5" /> Wszystkie składniki są w BaseLinkerze — zestaw można wysłać do BL.
                </p>
              ) : (
                <p className="text-amber-700 dark:text-amber-300">{totals.notInBl} składników nie ma w BaseLinkerze — do eksportu zestawu do BL trzeba je najpierw powiązać lub zaimportować.</p>
              ))}
          </div>
        </aside>
      </div>

      {scanner && (
        <BarcodeScanner
          onScan={(c) => {
            setSearch(c);
            setScanner(false);
          }}
          onClose={() => setScanner(false)}
        />
      )}
    </div>
  );
}
